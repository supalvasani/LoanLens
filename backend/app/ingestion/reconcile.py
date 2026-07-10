"""Balance reconciliation — the bank-agnostic correctness check.

Any real bank statement satisfies:
    balance_after[i] == balance_after[i-1] ± amount[i]

A stable sort (mergesort) preserves same-day transaction file order, which
is critical because balance is a running total — a non-stable sort produces
false mismatches on same-day batches.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

import pandas as pd

PASS_THRESHOLD = 0.98
WARN_THRESHOLD = 0.85
BALANCE_TOLERANCE = Decimal("0.01")


@dataclass
class ReconcileResult:
    verdict: str                            # 'pass' | 'warn' | 'fail' | 'insufficient_data'
    match_rate: float                       # fraction of checked rows that reconcile
    rows_checked: int
    rows_matched: int
    mismatch_sample: list[dict] = field(default_factory=list)   # up to 5 rows for debugging


def reconcile(df: pd.DataFrame) -> ReconcileResult:
    """Check balance continuity on a canonically-resolved DataFrame.

    The DataFrame passed here must already have:
        - 'txn_date'     : parsed date column
        - 'amount'       : numeric (always positive)
        - 'txn_type'     : 'debit' | 'credit'
        - 'balance_after': numeric or NaN

    Rows with NaN balance_after are excluded from the check but not penalised.
    """
    if df.empty or "balance_after" not in df.columns:
        return ReconcileResult(
            verdict="insufficient_data",
            match_rate=0.0,
            rows_checked=0,
            rows_matched=0,
        )

    # ── Stable sort by date (preserves same-day file order) ──────────────────
    df_sorted = df.sort_values("txn_date", kind="mergesort").reset_index(drop=True)

    # Only rows that actually have a balance value
    has_balance = df_sorted["balance_after"].notna()
    eligible = df_sorted[has_balance].copy()

    if len(eligible) < 2:
        return ReconcileResult(
            verdict="insufficient_data",
            match_rate=0.0,
            rows_checked=0,
            rows_matched=0,
        )

    # Signed delta: credit → positive, debit → negative
    eligible = eligible.copy()
    eligible["_delta"] = eligible.apply(
        lambda r: r["amount"] if str(r["txn_type"]).lower() == "credit" else -r["amount"],
        axis=1,
    )
    eligible["_expected_balance"] = (
        eligible["balance_after"].shift(1) + eligible["_delta"]
    )

    # First row has no predecessor — exclude from check
    check_rows = eligible.iloc[1:].copy()
    rows_checked = len(check_rows)

    if rows_checked == 0:
        return ReconcileResult(
            verdict="insufficient_data",
            match_rate=0.0,
            rows_checked=0,
            rows_matched=0,
        )

    # Vectorised tolerance comparison
    diff = (check_rows["balance_after"] - check_rows["_expected_balance"]).abs()
    matched_mask = diff <= float(BALANCE_TOLERANCE)
    rows_matched = int(matched_mask.sum())
    match_rate = rows_matched / rows_checked

    # Build mismatch sample (up to 5 rows) for error surfacing
    mismatch_sample: list[dict] = []
    mismatch_rows = check_rows[~matched_mask].head(5)
    for _, row in mismatch_rows.iterrows():
        mismatch_sample.append(
            {
                "txn_date": str(row.get("txn_date", "")),
                "amount": float(row.get("amount", 0)),
                "txn_type": str(row.get("txn_type", "")),
                "actual_balance": float(row.get("balance_after", float("nan"))),
                "expected_balance": float(row.get("_expected_balance", float("nan"))),
                "diff": float(diff.loc[row.name]),
            }
        )

    if match_rate >= PASS_THRESHOLD:
        verdict = "pass"
    elif match_rate >= WARN_THRESHOLD:
        verdict = "warn"
    else:
        verdict = "fail"

    return ReconcileResult(
        verdict=verdict,
        match_rate=round(match_rate, 4),
        rows_checked=rows_checked,
        rows_matched=rows_matched,
        mismatch_sample=mismatch_sample,
    )
