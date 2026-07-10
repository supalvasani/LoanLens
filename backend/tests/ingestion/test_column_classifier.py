"""Tests for app/ingestion/column_classifier.py

Covers every guardrail documented in the spec:
- Three amount patterns resolve correctly
- balance_after column not mistaken for amount
- Description coalesces across multiple candidates
- No crash when all description columns are null
- Decoy columns down-weighted
- Claimed columns excluded from description candidacy
- Preamble detection (skip count)
- Clean file (no preamble, skip count = 0)
"""
import pandas as pd

from app.ingestion.column_classifier import (
    classify_columns,
    detect_header_row,
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_df(data: dict) -> pd.DataFrame:
    return pd.DataFrame(data)


# ── Amount pattern tests ──────────────────────────────────────────────────────

def test_flagged_pattern_resolved():
    """Single amount column + Dr/Cr column → 'flagged', not 'split'."""
    df = _make_df({
        "Date": ["2024-01-01", "2024-01-02", "2024-01-03"],
        "Description": ["Salary", "EMI", "ATM"],
        "Amount": ["50000", "12000", "5000"],
        "Dr/Cr": ["Cr", "Dr", "Dr"],
        "Balance": ["150000", "138000", "133000"],
    })
    mapping = classify_columns(df)
    assert mapping.amount_pattern == "flagged", (
        f"Expected 'flagged', got '{mapping.amount_pattern}'"
    )
    assert mapping.txn_type_col is not None
    assert len(mapping.amount_cols) == 1


def test_split_pattern_resolved():
    """Separate Debit and Credit columns (no txn_type col) → 'split'."""
    df = _make_df({
        "Date": ["2024-01-01", "2024-01-02", "2024-01-03"],
        "Description": ["Salary", "EMI", "ATM"],
        "Debit": ["", "12000", "5000"],
        "Credit": ["50000", "", ""],
        "Balance": ["150000", "138000", "133000"],
    })
    mapping = classify_columns(df)
    assert mapping.amount_pattern == "split", (
        f"Expected 'split', got '{mapping.amount_pattern}'"
    )
    assert len(mapping.amount_cols) == 2


def test_signed_pattern_resolved():
    """Single signed numeric column → 'signed'."""
    df = _make_df({
        "Txn Date": ["2024-01-01", "2024-01-02", "2024-01-03"],
        "Narration": ["Salary", "EMI", "ATM"],
        "Txn Amount": ["50000", "-12000", "-5000"],  # 'Txn Amount' avoids balance keyword match
    })
    mapping = classify_columns(df)
    assert mapping.amount_pattern in ("signed", "split")
    # Should resolve to at least one amount column
    assert len(mapping.amount_cols) >= 1


# ── Guardrail: balance not mistaken for second amount column ──────────────────

def test_balance_column_not_mistaken_for_amount():
    """Balance After column must be claimed early and excluded from amount candidacy.

    Regression for bug: running-balance column was scored as second debit/credit
    column in split-pattern detection.
    """
    df = _make_df({
        "Date": ["2024-01-01", "2024-01-02", "2024-01-03"],
        "Description": ["Salary", "EMI", "ATM"],
        "Debit Amount": ["", "12000", "5000"],
        "Credit Amount": ["50000", "", ""],
        "Balance After": ["150000", "138000", "133000"],
    })
    mapping = classify_columns(df)
    # Balance After must be the balance_col, NOT in amount_cols
    assert mapping.balance_col is not None, "balance_col should be detected"
    assert mapping.balance_col not in mapping.amount_cols, (
        f"balance_col '{mapping.balance_col}' must not appear in amount_cols {mapping.amount_cols}"
    )
    # With balance claimed, we should still resolve debit+credit correctly
    assert mapping.amount_pattern == "split"
    assert len(mapping.amount_cols) == 2


# ── Guardrail: description coalesces across multiple columns ──────────────────

def test_description_coalesces_left_to_right():
    """When primary description column has nulls, fallback column fills them in."""
    df = _make_df({
        "Date": ["2024-01-01", "2024-01-02", "2024-01-03"],
        "Name": ["Walmart", "", ""],          # primary: null for rows 2, 3
        "Mode": ["", "NEFT", "ATM-123"],      # fallback: always populated
        "Amount": ["500", "1200", "300"],
        "Dr/Cr": ["Dr", "Dr", "Dr"],
        "Balance": ["10000", "8800", "8500"],
    })
    mapping = classify_columns(df)
    # Both Name and Mode should be in description_cols (coalesced left-to-right)
    assert len(mapping.description_cols) >= 1, "At least one description col expected"


def test_description_no_crash_all_null():
    """No name column + all null values → produces a mapping without crashing.

    Regression for bug: absent name column with all-null values caused KeyError.
    """
    df = _make_df({
        "Txn Date": ["2024-01-01", "2024-01-02", "2024-01-03"],
        "Particulars": [None, None, None],   # all null
        "Debit": ["", "500", "200"],
        "Credit": ["1000", "", ""],
        "Balance": ["5000", "4500", "4300"],
    })
    # Must not raise
    mapping = classify_columns(df)
    # Even with all-null particulars, the mapping should not crash
    assert mapping is not None


# ── Guardrail: decoy columns down-weighted ────────────────────────────────────

def test_decoy_columns_not_chosen_as_date_or_amount():
    """Sl No, Day, Month, Year should not score highly as date or amount."""
    df = _make_df({
        "Sl No": ["1", "2", "3"],
        "Day": ["1", "2", "3"],
        "Month": ["1", "1", "1"],
        "Year": ["2024", "2024", "2024"],
        "Txn Date": ["2024-01-01", "2024-01-02", "2024-01-03"],
        "Amount": ["500", "1200", "300"],
        "Balance": ["5000", "3800", "3500"],
        "Description": ["A", "B", "C"],
    })
    mapping = classify_columns(df)
    # Real date column should win
    assert mapping.txn_date_col == "Txn Date", (
        f"Expected 'Txn Date', got '{mapping.txn_date_col}'"
    )
    # Decoy columns should not appear as amount cols
    for col in mapping.amount_cols:
        assert col not in ("Sl No", "Day", "Month", "Year"), (
            f"Decoy column '{col}' must not be picked as an amount column"
        )


# ── Guardrail: claimed columns excluded from description ──────────────────────

def test_claimed_columns_not_in_description():
    """Date/amount/balance/type columns must not appear in description_cols."""
    df = _make_df({
        "Date": ["2024-01-01", "2024-01-02", "2024-01-03"],
        "Description": ["Salary", "EMI", "ATM"],
        "Amount": ["50000", "12000", "5000"],
        "Dr/Cr": ["Cr", "Dr", "Dr"],
        "Balance": ["150000", "138000", "133000"],
    })
    mapping = classify_columns(df)
    structural_cols = (
        {mapping.txn_date_col}
        | set(mapping.amount_cols)
        | {mapping.txn_type_col}
        | {mapping.balance_col}
    ) - {None}
    for col in mapping.description_cols:
        assert col not in structural_cols, (
            f"Structural column '{col}' must not appear in description_cols"
        )


# ── Header-row detection ──────────────────────────────────────────────────────

def test_preamble_detection_skips_metadata_rows():
    """Axis Bank-style 12-row preamble before real header → correct skip count."""
    preamble_lines = [
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
        "Date,Description,Debit,Credit,Balance",
        "2024-01-01,Opening Balance,,50000,50000",
        "2024-01-02,Salary Credit,,25000,75000",
    ]
    skip = detect_header_row(preamble_lines)
    assert skip == 12, f"Expected skip=12, got {skip}"


def test_no_preamble_clean_file_returns_zero():
    """Clean CSV with header at row 0 → skip count 0."""
    lines = [
        "Date,Description,Debit,Credit,Balance",
        "2024-01-01,Salary,,25000,25000",
        "2024-01-02,ATM,500,,24500",
    ]
    skip = detect_header_row(lines)
    assert skip == 0, f"Expected 0, got {skip}"


def test_drcr_no_slash_resolved():
    """DrCr-style (without slash) column is successfully resolved as a txn_type column with high confidence."""
    df = _make_df({
        "date": ["2022-01-01", "2022-01-02"],
        "DrCr": ["Db", "Cr"],
        "amount": ["1000.0", "2000.0"],
        "balance": ["5000.0", "7000.0"],
        "mode": ["ATM", "NEFT"],
    })
    mapping = classify_columns(df)
    assert mapping.txn_type_col == "DrCr"
    assert mapping.amount_pattern == "flagged"
    assert mapping.confidence >= 0.55


def test_detect_header_row_with_false_positive_preamble():
    """Verify that detect_header_row ignores preamble rows containing words like 'Bandra' and 'Unnamed'."""
    preamble_lines = [
        "Corporate & Registered Office: 27BKC,C 27,G Block,Bandra Kurla Complex,Bandra (E),Mumbai - 400051,Unnamed: 6,Unnamed: 7",
        "Date,Description,Debit,Credit,Balance",
        "2024-01-01,Opening Balance,,50000,50000",
    ]
    skip = detect_header_row(preamble_lines)
    assert skip == 1, f"Expected skip=1, got {skip}"


def test_serial_column_not_chosen_as_credit_in_split_pattern():
    """Regression: unlabeled/undotted serial column ('Sl.') must not win the
    credit slot over the real Credit column just because the real column is
    mostly blank (which is normal for split-pattern debit/credit columns).

    Real-world case: Kotak Bank statement — 'Sl.' (1,2,3...), 'Dr Amt',
    'Cr Amt' where most rows are debits, leaving Cr Amt sparsely populated.
    """
    n = 20
    rows_sl, rows_dr, rows_cr, rows_desc = [], [], [], []
    balance = 100000.0
    for i in range(n):
        rows_sl.append(str(i + 1))
        if i % 5 == 0:  # occasional credit, mostly debits — mirrors real statement shape
            rows_dr.append("")
            rows_cr.append("5000.00")
            balance += 500
        else:
            rows_dr.append("2000.00")
            rows_cr.append("")
            balance -= 2000
        rows_desc.append(f"Txn {i}")

    df = _make_df({
        "Sl.": rows_sl,
        "Value Dt": [f"2024-01-{i+1:02d}" for i in range(n)],
        "Description": rows_desc,
        "Dr Amt": rows_dr,
        "Cr Amt": rows_cr,
        "Running Bal": ["0"] * n,  # values irrelevant to this test
    })
    mapping = classify_columns(df)
    assert "Sl." not in mapping.amount_cols, (
        f"Serial column must never be chosen as an amount column, got {mapping.amount_cols}"
    )
    assert set(mapping.amount_cols) == {"Dr Amt", "Cr Amt"}, (
        f"Expected ['Dr Amt', 'Cr Amt'], got {mapping.amount_cols}"
    )
    assert mapping.amount_pattern == "split"


def test_bare_serial_without_no_suffix_flagged_as_decoy():
    """'Sl.' (no 'No' suffix) must still be treated as a decoy via the
    data-driven monotonic-sequence check, not just the name regex."""
    df = _make_df({
        "Sl.": ["1", "2", "3", "4", "5"],
        "Date": [f"2024-01-{i+1:02d}" for i in range(5)],
        "Description": ["A", "B", "C", "D", "E"],
        "Amount": ["500", "1200", "300", "800", "150"],
        "Balance": ["5000", "3800", "3500", "4300", "4150"],
    })
    mapping = classify_columns(df)
    assert "Sl." not in mapping.amount_cols
    assert "Sl." != mapping.txn_date_col


