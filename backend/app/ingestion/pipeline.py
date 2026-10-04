"""Universal bank statement ingestion pipeline.

Orchestrates: SHA-256 dedup → header detection → CSV parse → format_registry
lookup (fast path) → column classifier (heuristic path) → confidence gate →
canonical resolution → balance reconciliation → row-level dedup → canonical
rows ready for raw_transactions bulk insert.

This module contains zero bank-name branching. format_registry is a pure
speed optimisation; removing it degrades to the heuristic path every time
but never breaks ingestion.
"""

from __future__ import annotations

import io
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

import pandas as pd

from app.ingestion.column_classifier import (
    ColumnMapping,
    classify_columns,
    detect_header_row,
)
from app.ingestion.dedup import attach_raw_ids, file_hash
from app.ingestion.reconcile import reconcile

# ── Configuration ─────────────────────────────────────────────────────────────

MIN_DATA_ROWS = 3
MIN_CONFIDENCE = 0.70
MAX_UNPARSE_RATE = 0.10   # >10% core fields unparseable → reject


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class IngestResult:
    status: str                             # see STATUS_* constants below
    rows: list[dict] | None = None       # canonical rows, ready for DB insert
    verdict: str | None = None           # reconciliation verdict
    match_rate: float | None = None
    mismatch_sample: list[dict] = field(default_factory=list)
    source_format: str = "unknown"          # 'registry:flagged' | 'heuristic:split' etc.
    file_hash: str = ""
    confidence: float = 0.0
    detected_headers: list[str] = field(default_factory=list)
    sample_rows: list[dict] = field(default_factory=list)
    error_detail: str = ""


# Status codes (used as keys for HTTP response mapping in upload.py)
STATUS_OK = "ok"
STATUS_DUPLICATE_FILE = "duplicate_file"
STATUS_TOO_FEW_ROWS = "too_few_rows"
STATUS_NOT_A_BANK_STATEMENT = "not_a_bank_statement"
STATUS_LOW_CONFIDENCE = "low_confidence"
STATUS_RECONCILIATION_FAILED = "reconciliation_failed"
STATUS_RECONCILIATION_WARN = "reconciliation_warn"


# ── Date parsing ──────────────────────────────────────────────────────────────

_DATE_FMTS = (
    "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d",
    "%d-%b-%Y", "%d-%B-%Y", "%d-%b-%y", "%d/%b/%Y",
    "%d.%m.%Y", "%m/%d/%Y",
)


def _parse_date(val: str) -> date | None:
    val = val.strip()
    if not val:
        return None
    try:
        return date.fromisoformat(val)
    except ValueError:
        pass
    for fmt in _DATE_FMTS:
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    return None


_AMOUNT_TOKEN = re.compile(r"[-+]?\d[\d,]*(?:\.\d+)?")


def _parse_decimal_token(val: str) -> tuple[Decimal, bool] | None:
    """Extract a decimal token and whether accounting notation made it negative."""
    value = str(val or "").strip()
    if not value:
        return None
    parenthesized = value.startswith("(") and value.endswith(")")
    trailing_minus = value.endswith("-")
    match = _AMOUNT_TOKEN.search(value)
    if not match:
        return None
    try:
        number = Decimal(match.group(0).replace(",", ""))
    except InvalidOperation:
        return None
    return number, parenthesized or trailing_minus


def _parse_amount(val: str) -> Decimal | None:
    """Parse currency, comma-separated, signed, and accounting-style amounts."""
    parsed = _parse_decimal_token(val)
    return abs(parsed[0]) if parsed else None


def _parse_signed_amount(val: str) -> Decimal | None:
    parsed = _parse_decimal_token(val)
    if not parsed:
        return None
    number, is_negative = parsed
    return -abs(number) if is_negative else number


def _normalise_txn_type(raw: str) -> str | None:
    """Map Dr/Cr variants to canonical 'debit'/'credit'."""
    v = re.sub(r"[^a-z]", "", str(raw or "").strip().lower())
    if v in ("dr", "db", "d", "debit"):
        return "debit"
    if v in ("cr", "c", "credit"):
        return "credit"
    return None


# ── Canonical resolution ──────────────────────────────────────────────────────

# ── Canonical resolution ──────────────────────────────────────────────────────

def _extract_split_amount(row, mapping: ColumnMapping) -> tuple[Decimal | None, str | None, bool]:
    debit_col, credit_col = mapping.amount_cols[0], mapping.amount_cols[1]
    raw_debit = str(row.get(debit_col, "") or "").strip().replace(",", "")
    raw_credit = str(row.get(credit_col, "") or "").strip().replace(",", "")
    debit_val = _parse_amount(raw_debit)
    credit_val = _parse_amount(raw_credit)
    no_debit = debit_val is None or debit_val == Decimal("0")
    no_credit = credit_val is None or credit_val == Decimal("0")
    if no_debit and no_credit:
        return None, None, True
    if credit_val and credit_val > 0:
        return credit_val, "credit", False
    return debit_val, "debit", False


def _extract_signed_amount(row, mapping: ColumnMapping) -> tuple[Decimal | None, str | None, bool]:
    raw_amt = str(row.get(mapping.amount_cols[0], "") or "")
    signed = _parse_signed_amount(raw_amt)
    if signed is None:
        return None, None, False
    txn_type = "credit" if signed >= 0 else "debit"
    return abs(signed), txn_type, False


def _extract_amount_and_type(row, mapping: ColumnMapping) -> tuple[Decimal | None, str | None, bool]:
    """Returns (amount, txn_type, is_empty_row)."""
    if mapping.amount_pattern == "flagged":
        raw_amt = str(row.get(mapping.amount_cols[0], "") or "")
        raw_type = str(row.get(mapping.txn_type_col, "") or "")
        return _parse_amount(raw_amt), _normalise_txn_type(raw_type), False
    if mapping.amount_pattern == "split":
        return _extract_split_amount(row, mapping)
    if mapping.amount_pattern == "signed":
        return _extract_signed_amount(row, mapping)
    return None, None, False


def _resolve_single_canonical_row(
    row,
    mapping: ColumnMapping,
    source_format: str,
    fhash: str,
) -> dict | None:
    # ── date ──────────────────────────────────────────────────────────────
    txn_date = None
    if mapping.txn_date_col and pd.notna(row.get(mapping.txn_date_col)):
        txn_date = _parse_date(str(row[mapping.txn_date_col]))
    if txn_date is None:
        return None

    # ── amount + txn_type ─────────────────────────────────────────────────
    amount, txn_type, is_empty = _extract_amount_and_type(row, mapping)
    if is_empty:
        return {}
    if amount is None or txn_type is None:
        return None

    # ── description (coalesce left-to-right) ──────────────────────────────
    description = ""
    for desc_col in mapping.description_cols:
        val = str(row.get(desc_col, "") or "").strip()
        if val:
            description = val
            break
    if not description:
        description = "—"

    # ── balance_after ─────────────────────────────────────────────────────
    balance_after: Decimal | None = None
    if mapping.balance_col and pd.notna(row.get(mapping.balance_col)):
        balance_after = _parse_amount(str(row[mapping.balance_col]))

    return {
        "txn_date": txn_date,
        "amount": amount,
        "txn_type": txn_type,
        "description": description,
        "balance_after": balance_after,
        "source_format": source_format,
        "source_file_hash": fhash,
    }


def _resolve_canonical_rows(
    df: pd.DataFrame,
    mapping: ColumnMapping,
    source_format: str,
    fhash: str,
) -> tuple[list[dict], int]:
    """Convert raw DataFrame to canonical rows using *mapping*.

    Returns (canonical_rows, unparseable_count).
    """
    canonical: list[dict] = []
    unparseable = 0

    for idx, row in df.iterrows():
        res = _resolve_single_canonical_row(row, mapping, source_format, fhash)
        if res is None:
            unparseable += 1
        elif res == {}:
            continue
        else:
            canonical.append(res)

    return canonical, unparseable


# ── Registry lookup interface ─────────────────────────────────────────────────

def _headers_to_key(headers: list[str]) -> frozenset[str]:
    return frozenset(h.strip().lower() for h in headers)


def _decode_bytes(raw_bytes: bytes, fhash: str) -> tuple[str | None, IngestResult | None]:
    try:
        return raw_bytes.decode("utf-8-sig"), None
    except UnicodeDecodeError:
        try:
            return raw_bytes.decode("latin-1"), None
        except UnicodeDecodeError:
            return None, IngestResult(
                status=STATUS_NOT_A_BANK_STATEMENT,
                file_hash=fhash,
                error_detail="File encoding could not be determined (not UTF-8 or Latin-1).",
            )


def _parse_dataframe(text_content: str, fhash: str) -> tuple[pd.DataFrame | None, IngestResult | None]:
    raw_lines = text_content.splitlines()
    header_row_idx = detect_header_row(raw_lines, max_scan=30)
    trimmed = "\n".join(raw_lines[header_row_idx:])
    try:
        df_raw = pd.read_csv(io.StringIO(trimmed), dtype=str, keep_default_na=False)
        df_raw.columns = [str(c).strip() for c in df_raw.columns]
        return df_raw, None
    except Exception as exc:
        return None, IngestResult(
            status=STATUS_NOT_A_BANK_STATEMENT,
            file_hash=fhash,
            error_detail=f"CSV parse error: {exc}",
        )


def _get_mapping_and_source(
    df_raw: pd.DataFrame,
    detected_headers: list[str],
    registry_lookup: Callable[[frozenset[str]], dict | None],
) -> tuple[ColumnMapping, str]:
    header_key = _headers_to_key(detected_headers)
    registry_entry = registry_lookup(header_key)

    if registry_entry is not None:
        cmap = registry_entry["column_map"]
        mapping = ColumnMapping(
            txn_date_col=cmap.get("txn_date_col"),
            amount_cols=cmap.get("amount_cols", []),
            txn_type_col=cmap.get("txn_type_col"),
            description_cols=cmap.get("description_cols", []),
            balance_col=cmap.get("balance_col"),
            amount_pattern=registry_entry.get("amount_pattern", "signed"),
            confidence=1.0,
        )
        return mapping, "registry"

    return classify_columns(df_raw), "heuristic"


# ── Main pipeline ─────────────────────────────────────────────────────────────

def ingest_statement(
    raw_bytes: bytes,
    applicant_id: str,
    *,
    file_hash_lookup: Callable[[str, str], bool],
    registry_lookup: Callable[[frozenset[str]], dict | None],
) -> IngestResult:
    """Full ingestion pipeline for a single bank statement file."""
    fhash = file_hash(raw_bytes)
    if file_hash_lookup(applicant_id, fhash):
        return IngestResult(status=STATUS_DUPLICATE_FILE, file_hash=fhash)

    text_content, err_result = _decode_bytes(raw_bytes, fhash)
    if err_result:
        return err_result

    df_raw, err_result = _parse_dataframe(text_content, fhash)
    if err_result:
        return err_result

    detected_headers = list(df_raw.columns)

    if len(df_raw) < MIN_DATA_ROWS:
        return IngestResult(
            status=STATUS_TOO_FEW_ROWS,
            file_hash=fhash,
            detected_headers=detected_headers,
        )

    sample_rows = df_raw.head(5).to_dict(orient="records")
    mapping, source_prefix = _get_mapping_and_source(df_raw, detected_headers, registry_lookup)

    if not mapping.txn_date_col or not mapping.amount_cols:
        return IngestResult(
            status=STATUS_NOT_A_BANK_STATEMENT,
            file_hash=fhash,
            detected_headers=detected_headers,
            sample_rows=sample_rows,
            error_detail="Could not identify date or amount columns.",
        )

    if source_prefix == "heuristic" and mapping.confidence < MIN_CONFIDENCE:
        return IngestResult(
            status=STATUS_LOW_CONFIDENCE,
            file_hash=fhash,
            confidence=mapping.confidence,
            detected_headers=detected_headers,
            sample_rows=sample_rows,
            error_detail=(
                f"Column mapping confidence {mapping.confidence:.0%} is below "
                f"the {MIN_CONFIDENCE:.0%} threshold."
            ),
        )

    source_format = f"{source_prefix}:{mapping.amount_pattern}"
    canonical_rows, unparseable = _resolve_canonical_rows(
        df_raw, mapping, source_format, fhash
    )

    total_attempted = len(df_raw)
    unparse_rate = unparseable / total_attempted if total_attempted > 0 else 0.0

    if source_prefix == "heuristic" and unparse_rate > MAX_UNPARSE_RATE:
        return IngestResult(
            status=STATUS_LOW_CONFIDENCE,
            file_hash=fhash,
            confidence=mapping.confidence,
            detected_headers=detected_headers,
            sample_rows=sample_rows,
            error_detail=(
                f"{unparse_rate:.0%} of rows failed to parse core fields "
                f"(threshold: {MAX_UNPARSE_RATE:.0%})."
            ),
        )

    if len(canonical_rows) < MIN_DATA_ROWS:
        return IngestResult(
            status=STATUS_TOO_FEW_ROWS,
            file_hash=fhash,
            detected_headers=detected_headers,
        )

    # ── 10. Balance reconciliation ────────────────────────────────────────────
    canonical_df = pd.DataFrame(canonical_rows)
    reconcile_result = reconcile(canonical_df)

    if reconcile_result.verdict == "fail":
        return IngestResult(
            status=STATUS_RECONCILIATION_FAILED,
            verdict=reconcile_result.verdict,
            match_rate=reconcile_result.match_rate,
            mismatch_sample=reconcile_result.mismatch_sample,
            file_hash=fhash,
            confidence=mapping.confidence,
            detected_headers=detected_headers,
            sample_rows=sample_rows,
            error_detail=(
                f"Balance did not reconcile on "
                f"{reconcile_result.rows_checked - reconcile_result.rows_matched}/"
                f"{reconcile_result.rows_checked} rows — mapping is likely wrong."
            ),
        )

    # ── 11. Attach deterministic row IDs ──────────────────────────────────────
    canonical_df = attach_raw_ids(canonical_df, applicant_id)
    canonical_df["raw_applicant_id"] = applicant_id

    final_rows = canonical_df.to_dict(orient="records")

    if reconcile_result.verdict == "warn":
        return IngestResult(
            status=STATUS_RECONCILIATION_WARN,
            rows=final_rows,
            verdict=reconcile_result.verdict,
            match_rate=reconcile_result.match_rate,
            mismatch_sample=reconcile_result.mismatch_sample,
            source_format=source_format,
            file_hash=fhash,
            confidence=mapping.confidence,
            detected_headers=detected_headers,
            sample_rows=sample_rows,
        )

    return IngestResult(
        status=STATUS_OK,
        rows=final_rows,
        verdict=reconcile_result.verdict,
        match_rate=reconcile_result.match_rate,
        source_format=source_format,
        file_hash=fhash,
        confidence=mapping.confidence,
        detected_headers=detected_headers,
    )
