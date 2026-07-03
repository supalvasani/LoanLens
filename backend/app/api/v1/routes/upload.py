"""Bank Statement Upload — POST /upload/bank-statement

Accepts a CSV file with columns:
  txn_date, amount, txn_type (credit|debit), description, balance_after

The applicant must already have a raw_applicants record linked to their user_id.
Each row is inserted into raw_transactions (ON CONFLICT DO NOTHING by raw_id).
Returns a summary: rows_inserted, rows_skipped, errors.
"""


import csv
import io
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_role
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.enums import RoleEnum
from app.models.user import User

router = APIRouter(prefix="/upload", tags=["Upload"])

REQUIRED_COLS = {"txn_date", "amount", "txn_type", "description", "balance_after"}
VALID_TXN_TYPES = {"credit", "debit"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


class StatementUploadResult(BaseModel):
    rows_inserted: int
    rows_skipped: int
    errors: list[str]
    applicant_id: str | None



@router.post(
    "/bank-statement",
    response_model=StatementUploadResult,
    status_code=status.HTTP_200_OK,
    summary="Upload bank statement CSV (applicant only)",
)
@limiter.limit("10/minute")
async def upload_bank_statement(
    request: Request,
    file: UploadFile = File(..., description="CSV with columns: txn_date, amount, txn_type, description, balance_after"),
    current_user: User = Depends(require_role(RoleEnum.applicant)),
    db: AsyncSession = Depends(get_db),
) -> StatementUploadResult:
    # ── 1. Validate file type ────────────────────────────────────────────────
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")

    # ── 2. Resolve applicant_id from raw_applicants ──────────────────────────
    result = await db.execute(
        text("SELECT raw_applicant_id FROM raw_applicants WHERE user_id = :uid LIMIT 1"),
        {"uid": str(current_user.user_id)},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(
            status_code=422,
            detail="No applicant profile found. Please complete your profile before uploading.",
        )
    applicant_id = str(row["raw_applicant_id"])

    # ── 3. Parse CSV ──────────────────────────────────────────────────────────
    try:
        text_content = raw_bytes.decode("utf-8-sig")  # handle BOM
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File encoding must be UTF-8.")

    reader = csv.DictReader(io.StringIO(text_content))
    if reader.fieldnames is None:
        raise HTTPException(status_code=400, detail="Empty or unreadable CSV.")

    cols = {c.strip().lower() for c in reader.fieldnames}
    missing = REQUIRED_COLS - cols
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {', '.join(sorted(missing))}. "
                   f"Required: txn_date, amount, txn_type, description, balance_after",
        )

    # ── 4. Insert rows ────────────────────────────────────────────────────────
    rows_inserted = 0
    rows_skipped = 0
    errors: list[str] = []

    INSERT_SQL = text("""
        INSERT INTO raw_transactions
            (raw_id, applicant_id, txn_date, amount, txn_type, description, balance_after, ingested_at)
        VALUES
            (:raw_id, :applicant_id, :txn_date, :amount, :txn_type, :description, :balance_after, :ingested_at)
        ON CONFLICT (raw_id) DO NOTHING
    """)

    for i, row in enumerate(reader, start=2):  # row 1 = header
        line_errors: list[str] = []

        # txn_date
        raw_date = row.get("txn_date", "").strip()
        try:
            txn_date = date.fromisoformat(raw_date)
        except ValueError:
            line_errors.append(f"Row {i}: invalid txn_date '{raw_date}' (expected YYYY-MM-DD)")
            txn_date = None  # type: ignore[assignment]

        # amount
        try:
            amount = Decimal(row.get("amount", "").strip())
            if amount <= 0:
                raise ValueError("must be positive")
        except (InvalidOperation, ValueError):
            line_errors.append(f"Row {i}: invalid amount '{row.get('amount', '')}'")
            amount = None  # type: ignore[assignment]

        # txn_type
        txn_type = row.get("txn_type", "").strip().lower()
        if txn_type not in VALID_TXN_TYPES:
            line_errors.append(f"Row {i}: txn_type must be 'credit' or 'debit', got '{txn_type}'")

        # description
        description = row.get("description", "").strip()[:255] or "—"

        # balance_after
        try:
            balance_after = Decimal(row.get("balance_after", "").strip())
        except (InvalidOperation, ValueError):
            line_errors.append(f"Row {i}: invalid balance_after '{row.get('balance_after', '')}'")
            balance_after = None  # type: ignore[assignment]

        if line_errors:
            errors.extend(line_errors)
            rows_skipped += 1
            continue

        try:
            await db.execute(
                INSERT_SQL,
                {
                    "raw_id":       str(uuid.uuid4()),
                    "applicant_id": applicant_id,
                    "txn_date":     txn_date,
                    "amount":       amount,
                    "txn_type":     txn_type,
                    "description":  description,
                    "balance_after": balance_after,
                    "ingested_at":  datetime.now(timezone.utc),
                },
            )
            rows_inserted += 1
        except Exception as exc:
            errors.append(f"Row {i}: DB error — {exc}")
            rows_skipped += 1

    await db.commit()

    return StatementUploadResult(
        rows_inserted=rows_inserted,
        rows_skipped=rows_skipped,
        errors=errors[:20],  # cap error list at 20 for response size
        applicant_id=applicant_id,
    )
