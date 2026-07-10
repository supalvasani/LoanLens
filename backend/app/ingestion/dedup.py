"""Two-layer deduplication for bank statement ingestion.

Layer 1 — File-level (SHA-256 of raw bytes)
    Checked before any parsing. Enforced via UNIQUE(applicant_id, file_hash)
    on statement_uploads.

Layer 2 — Row-level (deterministic UUID5 raw_id)
    Catches "different file, overlapping period" — same transactions appearing
    in multiple uploads (e.g. Jan–Mar then Feb–Apr).

    Key: applicant_id | txn_date | amount | txn_type | description[:50] | balance_after
    When balance_after is null, the row's original index is included as a
    tiebreaker — prevents two identical same-day debits with no balance data
    from colliding and silently losing one via ON CONFLICT DO NOTHING.
"""

from __future__ import annotations

import hashlib
import uuid

import pandas as pd

_UUID5_NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  # URL namespace


def file_hash(raw_bytes: bytes) -> str:
    """Return the SHA-256 hex digest of *raw_bytes*."""
    return hashlib.sha256(raw_bytes).hexdigest()


def _row_hash_key(applicant_id: str, row: pd.Series, fallback_index: int) -> str:
    """Build the deterministic hash key for a single transaction row."""
    bal = row.get("balance_after", None)
    bal_str = f"{float(bal):.2f}" if pd.notna(bal) and bal is not None else f"_idx{fallback_index}"
    desc = str(row.get("description", "") or "")[:50]
    key = (
        f"{applicant_id}|"
        f"{row.get('txn_date', '')}|"
        f"{float(row.get('amount', 0)):.2f}|"
        f"{row.get('txn_type', '')}|"
        f"{desc}|"
        f"{bal_str}"
    )
    return key


def compute_row_id(applicant_id: str, row: pd.Series, fallback_index: int) -> str:
    """Return a deterministic UUID5 string for a single transaction row."""
    key = _row_hash_key(applicant_id, row, fallback_index)
    return str(uuid.uuid5(_UUID5_NAMESPACE, key))


def attach_raw_ids(df: pd.DataFrame, applicant_id: str) -> pd.DataFrame:
    """Add a 'raw_id' column of deterministic UUIDs to *df* (in-place copy)."""
    df = df.copy()
    df["raw_id"] = [
        compute_row_id(applicant_id, row, idx)
        for idx, (_, row) in enumerate(df.iterrows())
    ]
    return df
