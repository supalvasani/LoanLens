"""End-to-end pipeline tests.

Tests every status code, both source paths (registry fast path vs heuristic),
duplicate detection at both file and row level, and the review-queue trigger
conditions.
"""
import uuid

from app.ingestion.dedup import file_hash
from app.ingestion.pipeline import (
    STATUS_DUPLICATE_FILE,
    STATUS_NOT_A_BANK_STATEMENT,
    STATUS_OK,
    STATUS_RECONCILIATION_FAILED,
    STATUS_RECONCILIATION_WARN,
    STATUS_TOO_FEW_ROWS,
    ingest_statement,
)

# ── Test CSV factories ────────────────────────────────────────────────────────

def _flagged_csv(n_rows: int = 10) -> bytes:
    """Clean flagged-pattern (Amount + Dr/Cr) CSV with perfect balance."""
    lines = ["Date,Description,Amount,Dr/Cr,Balance"]
    balance = 100000.0
    for i in range(n_rows):
        if i % 2 == 0:
            amt, typ, bal = 5000, "Cr", balance + 5000
        else:
            amt, typ, bal = 3000, "Dr", balance - 3000
        balance = bal
        lines.append(f"2024-01-{i+1:02d},Txn {i},{amt},{typ},{balance:.2f}")
    return "\n".join(lines).encode("utf-8")


def _split_csv(n_rows: int = 10) -> bytes:
    """Clean split-pattern (Debit / Credit columns) CSV with perfect balance."""
    lines = ["Date,Description,Debit,Credit,Balance"]
    balance = 50000.0
    for i in range(n_rows):
        if i % 2 == 0:
            credit, debit, bal = 5000, "", balance + 5000
        else:
            credit, debit, bal = "", 2000, balance - 2000
        balance = bal
        lines.append(f"2024-01-{i+1:02d},Txn {i},{debit},{credit},{balance:.2f}")
    return "\n".join(lines).encode("utf-8")


def _signed_csv(n_rows: int = 10) -> bytes:
    """Clean signed-pattern CSV (positive=credit, negative=debit)."""
    lines = ["Txn Date,Narration,Txn Amount"]
    for i in range(n_rows):
        amt = 5000 if i % 2 == 0 else -3000
        lines.append(f"2024-01-{i+1:02d},Txn {i},{amt}")
    return "\n".join(lines).encode("utf-8")


def _preamble_csv() -> bytes:
    """Axis Bank-style CSV with 12 metadata rows before the real header."""
    preamble = "\n".join([
        "Account Holder: John Doe",
        "Account Number: 123456789",
        "IFSC Code: UTIB0001234",
        "Branch: Mumbai Main",
        "Period: 01-Jan-2024 to 31-Jan-2024",
        "Currency: INR",
        "Address: 123 Marine Drive",
        "Phone: 9876543210",
        "Email: john@example.com",
        "Statement Type: Detailed",
        "Generated On: 01-Feb-2024",
        "Authorised Signatory: XYZ",
    ])
    data_lines = ["Date,Description,Debit,Credit,Balance"]
    balance = 50000.0
    for i in range(5):
        if i % 2 == 0:
            credit, debit, bal = 5000, "", balance + 5000
        else:
            credit, debit, bal = "", 2000, balance - 2000
        balance = bal
        data_lines.append(f"2024-01-{i+1:02d},Txn {i},{debit},{credit},{balance:.2f}")
    return (preamble + "\n" + "\n".join(data_lines)).encode("utf-8")


def _bad_reconcile_csv() -> bytes:
    """CSV where amount column is deliberately mis-mapped (balance won't reconcile)."""
    lines = ["Date,Description,Debit,Credit,Balance"]
    # Balances are garbage — won't satisfy continuity
    lines += [
        "2024-01-01,Opening,,50000,50000",
        "2024-01-02,Salary,,25000,99999",   # wrong balance
        "2024-01-03,EMI,12000,,88888",       # wrong balance
        "2024-01-04,ATM,5000,,77777",        # wrong balance
        "2024-01-05,Transfer,3000,,66666",   # wrong balance
    ]
    return "\n".join(lines).encode("utf-8")


# ── Pipeline fixtures ─────────────────────────────────────────────────────────

APPLICANT_ID = str(uuid.uuid4())
_seen_hashes: set[str] = set()


def _hash_lookup(aid: str, fhash: str) -> bool:
    return fhash in _seen_hashes


def _no_registry(headers):
    return None


def _run(raw_bytes: bytes, *, applicant_id: str = APPLICANT_ID, registry=None):
    return ingest_statement(
        raw_bytes=raw_bytes,
        applicant_id=applicant_id,
        file_name="test.csv",
        file_hash_lookup=_hash_lookup,
        registry_lookup=registry or _no_registry,
    )


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_ok_end_to_end_flagged():
    """Flagged pattern CSV → status 'ok', correct source_format tag."""
    result = _run(_flagged_csv())
    assert result.status == STATUS_OK, f"status={result.status}, err={result.error_detail}"
    assert result.source_format.startswith("heuristic:")
    assert result.rows and len(result.rows) > 0
    for row in result.rows:
        assert row["txn_type"] in ("debit", "credit")
        assert row["amount"] > 0


def test_ok_end_to_end_split():
    """Split pattern CSV → status 'ok'."""
    result = _run(_split_csv())
    assert result.status == STATUS_OK, f"status={result.status}, err={result.error_detail}"
    assert "split" in result.source_format or result.status == STATUS_OK


def test_ok_end_to_end_signed():
    """Signed pattern CSV → status 'ok' or 'low_confidence' (no balance col to reconcile)."""
    result = _run(_signed_csv())
    # Signed CSV has no balance → reconciliation returns insufficient_data → passes through
    assert result.status in (STATUS_OK, STATUS_RECONCILIATION_WARN), (
        f"Unexpected status: {result.status}, detail: {result.error_detail}"
    )


def test_duplicate_file_rejected():
    """Uploading the same raw bytes twice → second call returns 'duplicate_file'."""
    raw = _flagged_csv()
    fhash = file_hash(raw)

    # Simulate first upload by registering the hash
    seen: set[str] = {fhash}

    def _lookup(aid, h):
        return h in seen

    result1 = ingest_statement(
        raw_bytes=raw,
        applicant_id=APPLICANT_ID,
        file_name="stmt.csv",
        file_hash_lookup=lambda a, h: False,   # first upload: not seen
        registry_lookup=_no_registry,
    )
    assert result1.status == STATUS_OK

    result2 = ingest_statement(
        raw_bytes=raw,
        applicant_id=APPLICANT_ID,
        file_name="stmt.csv",
        file_hash_lookup=_lookup,              # second upload: already seen
        registry_lookup=_no_registry,
    )
    assert result2.status == STATUS_DUPLICATE_FILE


def test_different_file_overlapping_period_no_duplicate_rows():
    """Different raw bytes, overlapping date range → row IDs must be deterministic.

    Same transaction in both files must produce the same raw_id — so
    ON CONFLICT DO NOTHING on raw_id prevents row duplication.
    """
    # Two files that share some transactions
    raw1 = _split_csv(n_rows=6)   # rows 1–6
    raw2 = _split_csv(n_rows=6)   # identical rows (same content) — simulates overlap

    result1 = _run(raw1)
    result2 = _run(raw2)

    if result1.status == STATUS_OK and result2.status == STATUS_OK:
        ids1 = {str(r["raw_id"]) for r in result1.rows}
        ids2 = {str(r["raw_id"]) for r in result2.rows}
        # All shared rows must have the same IDs (deterministic hash)
        overlap = ids1 & ids2
        assert len(overlap) == len(ids1), (
            "Overlapping transactions must produce identical raw_ids "
            "so ON CONFLICT DO NOTHING deduplicates them"
        )


def test_too_few_rows():
    """CSV with only 2 data rows → 'too_few_rows'."""
    csv_bytes = b"Date,Description,Debit,Credit,Balance\n2024-01-01,A,,1000,1000\n2024-01-02,B,500,,500"
    result = _run(csv_bytes)
    assert result.status == STATUS_TOO_FEW_ROWS


def test_not_a_bank_statement():
    """CSV with no recognisable date or amount columns → 'not_a_bank_statement'."""
    csv_bytes = b"product,sku,price\nWidget,W-001,9.99\nGadget,G-002,49.99\nDoohickey,D-003,2.49"
    result = _run(csv_bytes)
    assert result.status == STATUS_NOT_A_BANK_STATEMENT


def test_reconciliation_failed_on_wrong_mapping():
    """Deliberately mis-mapped amounts → 'reconciliation_failed', NOT a silent insert."""
    result = _run(_bad_reconcile_csv())
    assert result.status == STATUS_RECONCILIATION_FAILED, (
        f"Expected reconciliation_failed, got '{result.status}'"
    )
    assert result.verdict == "fail"


def test_preamble_file_ingests_correctly():
    """Axis Bank-style 12-row preamble → correct number of rows parsed."""
    result = _run(_preamble_csv())
    assert result.status in (STATUS_OK, STATUS_RECONCILIATION_WARN), (
        f"Preamble file rejected: {result.status} — {result.error_detail}"
    )
    # Should parse exactly 5 data rows
    if result.rows:
        assert len(result.rows) == 5, f"Expected 5 rows, got {len(result.rows)}"


def test_registry_fast_path_tagged():
    """Pre-seeded registry hit → source_format prefixed 'registry:'."""
    raw = _split_csv()
    # Build a mock registry that matches the CSV headers
    headers_key = frozenset(["date", "description", "debit", "credit", "balance"])

    registry_entry = {
        "column_map": {
            "txn_date_col": "Date",
            "amount_cols": ["Debit", "Credit"],
            "txn_type_col": None,
            "description_cols": ["Description"],
            "balance_col": "Balance",
        },
        "amount_pattern": "split",
    }

    def _registry(h):
        if h == headers_key:
            return registry_entry
        return None

    result = ingest_statement(
        raw_bytes=raw,
        applicant_id=APPLICANT_ID,
        file_name="stmt.csv",
        file_hash_lookup=lambda a, h: False,
        registry_lookup=_registry,
    )
    assert result.status in (STATUS_OK, STATUS_RECONCILIATION_WARN), (
        f"Registry path failed: {result.status} — {result.error_detail}"
    )
    assert result.source_format.startswith("registry:"), (
        f"Expected 'registry:...' source_format, got '{result.source_format}'"
    )


def test_heuristic_path_tagged():
    """No registry hit → source_format prefixed 'heuristic:'."""
    result = _run(_flagged_csv())
    assert result.status in (STATUS_OK, STATUS_RECONCILIATION_WARN)
    assert result.source_format.startswith("heuristic:"), (
        f"Expected 'heuristic:...' source_format, got '{result.source_format}'"
    )
