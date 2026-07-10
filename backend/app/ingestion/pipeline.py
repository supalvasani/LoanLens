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
MIN_CONFIDENCE = 0.55
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


def _parse_amount(val: str) -> Decimal | None:
    """Parse a numeric string, stripping commas and parenthetical suffixes."""
    val = val.strip()
    if not val:
        return None
    # Remove trailing annotation e.g. "12,345.00 (Low Balance)"
    val = val.split("(")[0].strip()
    val = val.replace(",", "")
    try:
        d = Decimal(val)
        return abs(d)   # store amounts as positive; txn_type encodes direction
    except InvalidOperation:
        return None


def _normalise_txn_type(raw: str) -> str | None:
    """Map Dr/Cr variants to canonical 'debit'/'credit'."""
    v = raw.strip().lower()
    if v in ("dr", "db", "d", "debit"):
        return "debit"
    if v in ("cr", "c", "credit"):
        return "credit"
    return None


# ── Canonical resolution ──────────────────────────────────────────────────────

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
    amount: Decimal | None = None
    txn_type: str | None = None

    if mapping.amount_pattern == "flagged":
        raw_amt = str(row.get(mapping.amount_cols[0], "") or "")
        amount = _parse_amount(raw_amt)
        raw_type = str(row.get(mapping.txn_type_col, "") or "")
        txn_type = _normalise_txn_type(raw_type)

    elif mapping.amount_pattern == "split":
        debit_col, credit_col = mapping.amount_cols[0], mapping.amount_cols[1]
        raw_debit = str(row.get(debit_col, "") or "").strip().replace(",", "")
        raw_credit = str(row.get(credit_col, "") or "").strip().replace(",", "")
        debit_val = _parse_amount(raw_debit)
        credit_val = _parse_amount(raw_credit)
        # Skip rows with no value in either column (e.g. header summary rows)
        if (debit_val is None or debit_val == Decimal("0")) and \
           (credit_val is None or credit_val == Decimal("0")):
            return {}
        if credit_val and credit_val > 0:
            amount, txn_type = credit_val, "credit"
        else:
            amount, txn_type = debit_val, "debit"

    elif mapping.amount_pattern == "signed":
        raw_amt = str(row.get(mapping.amount_cols[0], "") or "")
        clean = raw_amt.strip().replace(",", "")
        try:
            signed = Decimal(clean)
            amount = abs(signed)
            txn_type = "credit" if signed >= 0 else "debit"
        except InvalidOperation:
            pass

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


# ── Main pipeline ─────────────────────────────────────────────────────────────

def ingest_statement(
    raw_bytes: bytes,
    applicant_id: str,
    *,
    file_hash_lookup: Callable[[str, str], bool],
    registry_lookup: Callable[[frozenset[str]], dict | None],
) -> IngestResult:
    """Full ingestion pipeline for a single bank statement file.

    Parameters
    ----------
    raw_bytes:
        Raw file bytes exactly as received (used for SHA-256 + parsing).
    applicant_id:
        UUID string of the raw_applicants row for this upload.
    file_hash_lookup:
        Callable(applicant_id, sha256_hex) → bool.
        Returns True if this file has already been ingested for this applicant.
    registry_lookup:
        Callable(frozenset_of_lowered_headers) → dict | None.
        Returns a registry row dict with 'column_map' and 'amount_pattern' keys,
        or None on cache miss. Removing this callable (always returning None)
        must not break ingestion — it just forces the heuristic path every time.

    Returns
    -------
    IngestResult with status, canonical rows (if successful), and metadata.
    """
    # ── 1. File-level dedup ───────────────────────────────────────────────────
    fhash = file_hash(raw_bytes)
    if file_hash_lookup(applicant_id, fhash):
        return IngestResult(status=STATUS_DUPLICATE_FILE, file_hash=fhash)

    # ── 2. Decode ─────────────────────────────────────────────────────────────
    text_content, err_result = _decode_bytes(raw_bytes, fhash)
    if err_result:
        return err_result

    # ── 3. Parse DataFrame ────────────────────────────────────────────────────
    df_raw, err_result = _parse_dataframe(text_content, fhash)
    if err_result:
        return err_result

    detected_headers = list(df_raw.columns)

    # ── 4. Minimum row check ──────────────────────────────────────────────────
    if len(df_raw) < MIN_DATA_ROWS:
        return IngestResult(
            status=STATUS_TOO_FEW_ROWS,
            file_hash=fhash,
            detected_headers=detected_headers,
        )

    # Sample rows for review queue (up to 5)
    sample_rows = df_raw.head(5).to_dict(orient="records")

    # ── 5. Format registry fast path ──────────────────────────────────────────
    header_key = _headers_to_key(detected_headers)
    registry_entry = registry_lookup(header_key)

    mapping: ColumnMapping | None = None
    source_prefix = "heuristic"

    if registry_entry is not None:
        # Registry hit — reconstruct ColumnMapping from stored column_map
        cmap = registry_entry["column_map"]
        mapping = ColumnMapping(
            txn_date_col=cmap.get("txn_date_col"),
            amount_cols=cmap.get("amount_cols", []),
            txn_type_col=cmap.get("txn_type_col"),
            description_cols=cmap.get("description_cols", []),
            balance_col=cmap.get("balance_col"),
            amount_pattern=registry_entry.get("amount_pattern", "signed"),
            confidence=1.0,  # Registry entries are human-confirmed
        )
        source_prefix = "registry"

    # ── 6. Heuristic classification (if no registry hit) ─────────────────────
    if mapping is None:
        mapping = classify_columns(df_raw)

    # ── 7. Sanity gate: must have at least date + amount ─────────────────────
    if not mapping.txn_date_col or not mapping.amount_cols:
        return IngestResult(
            status=STATUS_NOT_A_BANK_STATEMENT,
            file_hash=fhash,
            detected_headers=detected_headers,
            sample_rows=sample_rows,
            error_detail="Could not identify date or amount columns.",
        )

    # ── 8. Confidence gate (heuristic path only) ──────────────────────────────
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

    # ── 9. Resolve canonical rows ─────────────────────────────────────────────
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
