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
from app.core.logger import logger
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
        logger.warning("bank_statement_upload_invalid_type", extra={"filename": file.filename})
        raise HTTPException(status_code=400, detail="Only CSV files are accepted.")

    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_FILE_SIZE_BYTES:
        logger.warning("bank_statement_upload_too_large", extra={"size": len(raw_bytes)})
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")

    # ── 2. Resolve applicant_id from raw_applicants ──────────────────────────
    result = await db.execute(
        text("SELECT raw_applicant_id FROM raw_applicants WHERE user_id = :uid LIMIT 1"),
        {"uid": str(current_user.user_id)},
    )
    row = result.mappings().first()
    if not row:
        logger.warning("bank_statement_upload_no_profile", extra={"user_id": str(current_user.user_id)})
        raise HTTPException(
            status_code=422,
            detail="No applicant profile found. Please complete your profile before uploading.",
        )
    applicant_id = str(row["raw_applicant_id"])

    # ── 3. Parse CSV ──────────────────────────────────────────────────────────
    try:
        text_content = raw_bytes.decode("utf-8-sig")  # handle BOM
    except UnicodeDecodeError as exc:
        logger.warning("bank_statement_upload_unicode_error", extra={"error": str(exc)})
        raise HTTPException(status_code=400, detail="File encoding must be UTF-8.")

    reader = csv.DictReader(io.StringIO(text_content))
    if reader.fieldnames is None:
        logger.warning("bank_statement_upload_empty_csv")
        raise HTTPException(status_code=400, detail="Empty or unreadable CSV.")

    raw_headers = [h.strip() for h in reader.fieldnames if h]
    headers_lower = [h.lower() for h in raw_headers]

    is_standard = all(col in headers_lower for col in ["txn_date", "amount", "txn_type", "description", "balance_after"])
    is_banking = "date" in headers_lower and "description" in headers_lower and any("debit" in h for h in headers_lower) and any("credit" in h for h in headers_lower) and any("balance" in h for h in headers_lower)

    if not is_standard and not is_banking:
        msg = f"Unsupported CSV headers: {', '.join(raw_headers)}. Required columns are either (txn_date, amount, txn_type, description, balance_after) or standard bank export columns (Date, Description, Debit, Credit, Balance)."
        logger.warning("bank_statement_upload_invalid_headers", extra={"headers": raw_headers})
        raise HTTPException(status_code=400, detail=msg)

    # Helper function for flexible date parsing
    def parse_flexible_date(date_str: str) -> date:
        try:
            return date.fromisoformat(date_str)
        except ValueError:
            pass
        for fmt in ("%d-%b-%Y", "%d-%B-%Y", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Invalid format")

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

        if is_standard:
            raw_date = row.get("txn_date", "").strip()
            raw_amount = row.get("amount", "").strip()
            raw_type = row.get("txn_type", "").strip().lower()
            raw_desc = row.get("description", "").strip()
            raw_balance = row.get("balance_after", "").strip()
        else:
            # Resolve keys dynamically by checking lowercase substrings
            date_key = next((k for k in row.keys() if k and "date" in k.lower()), None)
            desc_key = next((k for k in row.keys() if k and "description" in k.lower()), None)
            debit_key = next((k for k in row.keys() if k and "debit" in k.lower()), None)
            credit_key = next((k for k in row.keys() if k and "credit" in k.lower()), None)
            balance_key = next((k for k in row.keys() if k and "balance" in k.lower()), None)

            raw_date = row.get(date_key, "").strip() if date_key else ""
            raw_desc = row.get(desc_key, "").strip() if desc_key else ""
            raw_balance = row.get(balance_key, "").strip() if balance_key else ""
            
            debit_val = row.get(debit_key, "").strip() if debit_key else ""
            credit_val = row.get(credit_key, "").strip() if credit_key else ""

            # Check if this row is just an opening balance or note row
            if not debit_val and not credit_val:
                rows_skipped += 1
                continue

            if credit_val:
                raw_amount = credit_val
                raw_type = "credit"
            else:
                raw_amount = debit_val
                raw_type = "debit"

        # ── 1. Clean and Parse Date ──
        try:
            # Strip low balance warning comments from balance/amounts
            if "(" in raw_balance:
                raw_balance = raw_balance.split("(")[0].strip()
            if "(" in raw_amount:
                raw_amount = raw_amount.split("(")[0].strip()

            raw_amount = raw_amount.replace(",", "")
            raw_balance = raw_balance.replace(",", "")

            txn_date = parse_flexible_date(raw_date)
        except ValueError as exc:
            line_errors.append(f"Row {i}: invalid txn_date '{raw_date}' — {exc}")
            txn_date = None  # type: ignore[assignment]

        # ── 2. Parse Amount ──
        try:
            amount = Decimal(raw_amount)
            if amount <= 0:
                raise ValueError("must be positive")
        except (InvalidOperation, ValueError):
            line_errors.append(f"Row {i}: invalid amount '{raw_amount}'")
            amount = None  # type: ignore[assignment]

        # ── 3. Parse Type ──
        txn_type = raw_type.strip().lower()
        if txn_type not in VALID_TXN_TYPES:
            line_errors.append(f"Row {i}: txn_type must be 'credit' or 'debit', got '{txn_type}'")

        # ── 4. Parse Description ──
        description = raw_desc.strip()[:255] or "—"

        # ── 5. Parse Balance After ──
        try:
            balance_after = Decimal(raw_balance)
        except (InvalidOperation, ValueError):
            line_errors.append(f"Row {i}: invalid balance_after '{raw_balance}'")
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
        errors=errors[:20],
        applicant_id=applicant_id,
    )
