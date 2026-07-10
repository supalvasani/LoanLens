"""Bank Statement Upload — POST /upload/bank-statement

Accepts any bank statement CSV (any layout) and runs it through the
universal ingestion pipeline. The pipeline handles:
  - Duplicate detection (SHA-256 file hash, checked before parsing)
  - Header-row detection (handles preamble rows, e.g. Axis Bank)
  - format_registry fast path (exact header-set match → skip classifier)
  - Generic column classifier (heuristic path for unknown banks)
  - Balance reconciliation gate
  - Deterministic row-level dedup (UUID5 raw_id)

The applicant must already have a raw_applicants record linked to their user_id.
Canonical rows are bulk-inserted into raw_transactions with ON CONFLICT DO NOTHING.
"""

import json
import os
import subprocess
import sys
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_role
from app.core.database import get_db
from app.core.logger import logger
from app.core.rate_limit import limiter
from app.enums import RoleEnum
from app.ingestion.dedup import file_hash as compute_file_hash
from app.ingestion.pipeline import (
    STATUS_LOW_CONFIDENCE,
    STATUS_NOT_A_BANK_STATEMENT,
    STATUS_RECONCILIATION_FAILED,
    STATUS_RECONCILIATION_WARN,
    STATUS_TOO_FEW_ROWS,
    ingest_statement,
)
from app.models.user import User

router = APIRouter(prefix="/upload", tags=["Upload"])

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


class StatementUploadResult(BaseModel):
    rows_inserted: int
    rows_skipped: int
    errors: list[str]
    applicant_id: str | None
    reconciliation_verdict: str | None = None
    source_format: str | None = None
    confidence: float | None = None


# ── Registry lookup (injected into pipeline, async DB wrapper) ────────────────

async def _build_registry_lookup(db: AsyncSession):
    """Fetch format_registry into memory for this request and return a lookup fn."""
    result = await db.execute(
        text("SELECT match_headers, column_map, amount_pattern FROM format_registry")
    )
    entries = result.mappings().all()

    def _lookup(header_key: frozenset) -> dict | None:
        for entry in entries:
            registry_key = frozenset(h.strip().lower() for h in entry["match_headers"])
            if registry_key == header_key:
                return {
                    "column_map": entry["column_map"],
                    "amount_pattern": entry["amount_pattern"],
                }
        return None

    return _lookup


async def _file_hash_lookup(db: AsyncSession, applicant_id: str, fhash: str) -> bool:
    """Return True if this (applicant_id, file_hash) pair already exists."""
    result = await db.execute(
        text(
            "SELECT 1 FROM statement_uploads "
            "WHERE applicant_id = :aid AND file_hash = :fh LIMIT 1"
        ),
        {"aid": applicant_id, "fh": fhash},
    )
    return result.fetchone() is not None


# ── Bulk insert helpers ───────────────────────────────────────────────────────

_INSERT_TXN_SQL = text("""
    INSERT INTO raw_transactions
        (raw_id, raw_applicant_id, txn_date, amount, txn_type, description,
         balance_after, source_format, source_file_hash, ingested_at)
    VALUES
        (:raw_id, :raw_applicant_id, :txn_date, :amount, :txn_type, :description,
         :balance_after, :source_format, :source_file_hash, :ingested_at)
    ON CONFLICT (raw_id) DO NOTHING
""")

_INSERT_UPLOAD_SQL = text("""
    INSERT INTO statement_uploads
        (upload_id, applicant_id, file_hash, file_name, source_format,
         row_count, reconciliation_verdict, reconciliation_match_rate,
         date_range_start, date_range_end, uploaded_at)
    VALUES
        (:upload_id, :applicant_id, :file_hash, :file_name, :source_format,
         :row_count, :reconciliation_verdict, :reconciliation_match_rate,
         :date_range_start, :date_range_end, :uploaded_at)
    ON CONFLICT (applicant_id, file_hash) DO NOTHING
""")

_INSERT_REVIEW_SQL = text("""
    INSERT INTO format_review_queue
        (review_id, file_name, detected_headers, sample_rows, reason, created_at)
    VALUES
        (:review_id, :file_name, :detected_headers, :sample_rows, :reason, :created_at)
""")


async def _bulk_insert_rows(
    db: AsyncSession,
    rows: list[dict],
    applicant_id: str,
) -> tuple[int, int]:
    """Insert canonical rows, return (inserted, skipped)."""
    inserted = 0
    skipped = 0
    now = datetime.now(UTC)

    for row in rows:
        result = await db.execute(
            _INSERT_TXN_SQL,
            {
                "raw_id": str(row["raw_id"]),
                "raw_applicant_id": applicant_id,
                "txn_date": row["txn_date"],
                "amount": row["amount"],
                "txn_type": row["txn_type"],
                "description": row.get("description", "—"),
                "balance_after": row.get("balance_after"),
                "source_format": row.get("source_format", "unknown"),
                "source_file_hash": row.get("source_file_hash", ""),
                "ingested_at": now,
            },
        )
        if result.rowcount and result.rowcount > 0:
            inserted += 1
        else:
            skipped += 1

    return inserted, skipped


async def _insert_upload_record(
    db: AsyncSession,
    applicant_id: str,
    result,
    file_name: str,
    rows: list[dict],
) -> None:
    dates = [r["txn_date"] for r in rows if r.get("txn_date")]
    date_start = min(dates) if dates else None
    date_end = max(dates) if dates else None

    await db.execute(
        _INSERT_UPLOAD_SQL,
        {
            "upload_id": str(uuid.uuid4()),
            "applicant_id": applicant_id,
            "file_hash": result.file_hash,
            "file_name": file_name,
            "source_format": result.source_format,
            "row_count": len(rows),
            "reconciliation_verdict": result.verdict,
            "reconciliation_match_rate": result.match_rate,
            "date_range_start": date_start,
            "date_range_end": date_end,
            "uploaded_at": datetime.now(UTC),
        },
    )


async def _insert_review_queue(
    db: AsyncSession,
    result,
    file_name: str,
    reason: str,
) -> None:
    await db.execute(
        _INSERT_REVIEW_SQL,
        {
            "review_id": str(uuid.uuid4()),
            "file_name": file_name,
            "detected_headers": result.detected_headers,
            "sample_rows": json.dumps(
                [
                    {
                        k: (str(v) if isinstance(v, Decimal) else v)
                        for k, v in row.items()
                    }
                    for row in result.sample_rows
                ]
            ),
            "reason": reason,
            "created_at": datetime.now(UTC),
        },
    )


# ── Route ─────────────────────────────────────────────────────────────────────

def run_dbt_background():
    """Runs dbt models in the background after database updates."""
    try:
        current_file_path = os.path.abspath(__file__)
        # Walk up 6 levels to get to the project root: routes -> v1 -> api -> app -> backend -> project_root
        project_root = current_file_path
        for _ in range(6):
            project_root = os.path.dirname(project_root)

        dbt_project_dir = os.path.join(project_root, "dbt", "loanlens")
        dbt_profiles_dir = os.path.join(project_root, "dbt", "loanlens")

        # Locate dbt executable (use venv's if available)
        venv_bin = os.path.dirname(sys.executable)
        dbt_exe = os.path.join(venv_bin, "dbt")
        if os.name == "nt":
            dbt_exe += ".exe"

        if not os.path.exists(dbt_exe):
            dbt_exe = "dbt"

        logger.info("triggering_dbt_run_background", extra={"dbt_path": dbt_exe})

        # Run dbt in background
        subprocess.run(
            [dbt_exe, "run", "--project-dir", dbt_project_dir, "--profiles-dir", dbt_profiles_dir],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )
        logger.info("dbt_run_background_completed")
    except Exception as e:
        logger.error("dbt_run_background_failed", extra={"error": str(e)})


@router.post(
    "/bank-statement",
    responses={
        400: {"description": "Only CSV files are accepted."},
        409: {"description": "This statement has already been uploaded."},
        413: {"description": "File too large. Maximum size is 5 MB."},
        422: {"description": "Unprocessable Entity - Ingestion failed."},
    },
    status_code=status.HTTP_200_OK,
    summary="Upload bank statement CSV (applicant only)",
)
@limiter.limit("10/minute")
async def upload_bank_statement(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_role(RoleEnum.applicant))],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: Annotated[UploadFile, File(description="Bank statement CSV — any format")] = ...
) -> StatementUploadResult:
    # ── 1. Basic file validation ──────────────────────────────────────────────
    if not file.filename or not file.filename.lower().endswith(".csv"):
        logger.warning("bank_statement_upload_invalid_type", extra={"filename": file.filename})
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_FILE_SIZE_BYTES:
        logger.warning("bank_statement_upload_too_large", extra={"size": len(raw_bytes)})
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")

    # ── 2. Resolve applicant_id ───────────────────────────────────────────────
    result = await db.execute(
        text("SELECT raw_applicant_id FROM raw_applicants WHERE user_id = :uid LIMIT 1"),
        {"uid": str(current_user.user_id)},
    )
    row = result.mappings().first()
    if not row:
        logger.warning(
            "bank_statement_upload_no_profile",
            extra={"user_id": str(current_user.user_id)},
        )
        raise HTTPException(
            status_code=422,
            detail="No applicant profile found. Please complete your profile before uploading.",
        )
    applicant_id = str(row["raw_applicant_id"])

    # ── 3. Build lookup callables ─────────────────────────────────────────────
    registry_lookup = await _build_registry_lookup(db)

    # ── 4. Real file-hash duplicate check (async, before pipeline call) ───────
    fhash = compute_file_hash(raw_bytes)
    if await _file_hash_lookup(db, applicant_id, fhash):
        logger.info(
            "bank_statement_duplicate_file",
            extra={"applicant_id": applicant_id, "file_hash": fhash},
        )
        raise HTTPException(
            status_code=409,
            detail="This statement has already been uploaded.",
        )

    # ── 5. Run pipeline (sync, no DB) ─────────────────────────────────────────
    ingest_result = ingest_statement(
        raw_bytes=raw_bytes,
        applicant_id=applicant_id,
        # File-hash dedup already handled above; pass a no-op so the pipeline
        # doesn't re-check (avoids needing asyncio bridge inside sync code).
        file_hash_lookup=lambda aid, h: False,
        registry_lookup=registry_lookup,
    )

    file_name = file.filename

    # ── 6. Route on pipeline status ───────────────────────────────────────────

    if ingest_result.status == STATUS_TOO_FEW_ROWS:
        logger.warning(
            "bank_statement_too_few_rows",
            extra={"applicant_id": applicant_id, "file": file_name},
        )
        raise HTTPException(
            status_code=422,
            detail="File has too few rows to be a valid statement.",
        )

    if ingest_result.status == STATUS_NOT_A_BANK_STATEMENT:
        logger.warning(
            "bank_statement_not_recognised",
            extra={"applicant_id": applicant_id, "file": file_name},
        )
        raise HTTPException(
            status_code=422,
            detail="Missing recognizable date/amount columns.",
        )

    if ingest_result.status == STATUS_LOW_CONFIDENCE:
        logger.warning(
            "bank_statement_low_confidence",
            extra={
                "applicant_id": applicant_id,
                "file": file_name,
                "confidence": ingest_result.confidence,
            },
        )
        await _insert_review_queue(db, ingest_result, file_name, "low_confidence")
        await db.commit()
        raise HTTPException(
            status_code=422,
            detail=(
                f"Could not confidently detect statement format "
                f"(confidence {ingest_result.confidence:.0%}), routed for review."
            ),
        )

    if ingest_result.status == STATUS_RECONCILIATION_FAILED:
        (ingest_result.rows_checked if hasattr(ingest_result, "rows_checked") else "?")
        logger.error(
            "bank_statement_reconciliation_failed",
            extra={
                "applicant_id": applicant_id,
                "file": file_name,
                "match_rate": ingest_result.match_rate,
            },
        )
        await _insert_review_queue(db, ingest_result, file_name, "reconciliation_fail")
        await db.commit()
        raise HTTPException(
            status_code=422,
            detail=ingest_result.error_detail
            or "Balance didn't reconcile — mapping is likely wrong.",
        )

    # STATUS_OK or STATUS_RECONCILIATION_WARN
    rows = ingest_result.rows or []

    inserted, skipped = await _bulk_insert_rows(db, rows, applicant_id)
    await _insert_upload_record(db, applicant_id, ingest_result, file_name, rows)

    if ingest_result.status == STATUS_RECONCILIATION_WARN:
        await _insert_review_queue(db, ingest_result, file_name, "reconciliation_warn")
        await db.commit()
        background_tasks.add_task(run_dbt_background)
        logger.warning(
            "bank_statement_reconciliation_warn",
            extra={
                "applicant_id": applicant_id,
                "file": file_name,
                "match_rate": ingest_result.match_rate,
            },
        )
        # 202 Accepted — rows stored, but manual review required
        response.status_code = status.HTTP_202_ACCEPTED
        return StatementUploadResult(
            rows_inserted=inserted,
            rows_skipped=skipped,
            errors=[
                f"Statement partially reconciled ({ingest_result.match_rate:.0%}), "
                f"pending manual review before use."
            ],
            applicant_id=applicant_id,
            reconciliation_verdict=ingest_result.verdict,
            source_format=ingest_result.source_format,
            confidence=ingest_result.confidence,
        )

    await db.commit()
    background_tasks.add_task(run_dbt_background)
    logger.info(
        "bank_statement_upload_ok",
        extra={
            "applicant_id": applicant_id,
            "file": file_name,
            "rows_inserted": inserted,
            "source_format": ingest_result.source_format,
        },
    )
    return StatementUploadResult(
        rows_inserted=inserted,
        rows_skipped=skipped,
        errors=[],
        applicant_id=applicant_id,
        reconciliation_verdict=ingest_result.verdict,
        source_format=ingest_result.source_format,
        confidence=ingest_result.confidence,
    )
