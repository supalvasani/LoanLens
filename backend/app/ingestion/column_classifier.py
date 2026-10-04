"""Generic column-role classifier for bank statement CSVs.

Given any pandas DataFrame (any headers, any bank), scores every column
against 5 canonical roles and resolves a ColumnMapping that the pipeline
can use to produce canonical rows — with zero bank-name branching.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher

import pandas as pd

# ── Canonical role keyword sets ───────────────────────────────────────────────

_DATE_KEYWORDS = {
    "date", "txn_date", "transaction date", "value date", "posting date",
    "tran date", "trans date", "value dt", "transaction dt", "post date", "dt",
}
_AMOUNT_KEYWORDS = {
    "amount", "txn amount", "transaction amount", "tran amt", "amt",
    "withdrawal", "deposit",
}
_CREDIT_KEYWORDS = {"credit", "cr", "deposit amt", "credit amount", "credit amt"}
_DEBIT_KEYWORDS = {"debit", "dr", "withdrawal", "withdrawal amt", "debit amount", "debit amt"}
_CREDIT_KEYWORDS = {"credit", "cr", "deposit", "deposit amt", "deposit amount", "credit amount", "credit amt"}
_BALANCE_KEYWORDS = {
    "balance", "balance after", "balance_after", "closing balance",
    "available balance", "running balance", "bal",
}
_DESCRIPTION_KEYWORDS = {
    "description", "narration", "particulars", "details", "remarks",
    "transaction details", "transaction description", "mode", "name",
    "payee", "merchant", "remarks/narration",
}
_TYPE_KEYWORDS = {
    "type", "txn_type", "transaction type", "cr/dr", "dr/cr",
    "debit/credit", "credit/debit", "drcr", "crdr", "dr_cr", "cr_dr",
    "dbcr", "crdb", "db_cr", "cr_db", "d/c", "c/d"
}

# All header keywords — used by header-row detection
ALL_HEADER_KEYWORDS: frozenset[str] = frozenset(
    _DATE_KEYWORDS
    | _AMOUNT_KEYWORDS
    | _DEBIT_KEYWORDS
    | _CREDIT_KEYWORDS
    | _BALANCE_KEYWORDS
    | _DESCRIPTION_KEYWORDS
    | _TYPE_KEYWORDS
)

# Known decoy columns that parse as numbers/dates but are NOT amount/date roles.
# Matched case-insensitively against the lowered, stripped column name.
_DECOY_PATTERNS = re.compile(
    r"^(sl[\s._-]*no\.?|sl\.?|serial[\s._-]*no\.?|ref[\s._-]*no\.?|cheque[\s._-]*no\.?|"
    r"day|month|year|chq[\s._-]*no\.?|sr[\s._-]*no\.?|sequence|s[\s._-]*no\.?)$",
    re.IGNORECASE,
)

# Canonical Dr/Cr flag variants (for value-content check of txn_type role)
_DR_VARIANTS = re.compile(r"^(dr|db|d|debit)$", re.IGNORECASE)
_CR_VARIANTS = re.compile(r"^(cr|c|credit)$", re.IGNORECASE)
_NUMERIC_TOKEN = re.compile(r"[-+]?\d[\d,]*(?:\.\d+)?")
_AMOUNT_DECORATIONS = re.compile(r"(?i)\b(?:inr|usd|eur|gbp|dr|cr)\b")


# ── Output dataclass ──────────────────────────────────────────────────────────

@dataclass
class ColumnMapping:
    """Resolved column roles for a single bank statement DataFrame."""

    txn_date_col: str | None = None
    # For 'split': [debit_col, credit_col]
    # For 'flagged': [amount_col]
    # For 'signed': [amount_col]
    amount_cols: list[str] = field(default_factory=list)
    txn_type_col: str | None = None        # present only for 'flagged' pattern
    description_cols: list[str] = field(default_factory=list)  # coalesced left-to-right
    balance_col: str | None = None
    amount_pattern: str = "signed"            # 'flagged' | 'split' | 'signed'
    confidence: float = 0.0                   # min of all role scores used


# ── Scoring helpers ───────────────────────────────────────────────────────────

def _is_monotonic_sequence(series: pd.Series) -> bool:
    """Data-driven decoy check: catches serial/index columns regardless of
    header name. A strictly increasing integer sequence starting at 0/1
    is almost never a real amount/balance/date field."""
    sample = series.dropna().astype(str).head(50)
    sample = [v.strip() for v in sample if v.strip()]
    if len(sample) < 5:
        return False
    try:
        nums = [int(float(v)) for v in sample]
    except ValueError:
        return False
    diffs = [nums[i + 1] - nums[i] for i in range(len(nums) - 1)]
    return all(d == 1 for d in diffs) and nums[0] in (0, 1)


def _is_decoy(col: str, series: pd.Series = None) -> bool:
    if _DECOY_PATTERNS.match(col.strip()):
        return True
    if series is not None and _is_monotonic_sequence(series):
        return True
    return False


def _keyword_score(col: str, keyword_set: set[str]) -> float:
    """0 or 1: does the lowered column name contain any keyword from the set?"""
    lower = col.lower().strip()
    if lower in keyword_set:
        return 1.0
    for kw in keyword_set:
        if kw in lower:
            return 0.7
    normalized_col = re.sub(r"[^a-z0-9]+", "", lower)
    for kw in keyword_set:
        normalized_kw = re.sub(r"[^a-z0-9]+", "", kw.lower())
        if len(normalized_col) >= 5 and len(normalized_kw) >= 5:
            similarity = SequenceMatcher(None, normalized_col, normalized_kw).ratio()
            if similarity >= 0.80:
                return 0.8
    return 0.0


def _date_parse_rate(series: pd.Series) -> float:
    """Fraction of non-null values that successfully parse as a date."""
    sample = series.dropna().astype(str).head(50)
    if len(sample) == 0:
        return 0.0
    parsed_count = 0
    for val in sample:
        v = val.strip()
        if not v:
            continue
        parsed_date = pd.to_datetime(v, errors="coerce")
        if pd.isna(parsed_date):
            parsed_date = pd.to_datetime(v, dayfirst=True, errors="coerce")
        if not pd.isna(parsed_date):
            parsed_count += 1
    return parsed_count / len(sample)


def _numeric_parse_rate(series: pd.Series, ignore_blanks: bool = False) -> float:
    """Fraction of non-null values that parse as a positive-or-zero number."""
    sample = series.dropna().astype(str).head(50)
    if ignore_blanks:
        sample = [v for v in sample if v.strip()]
    if len(sample) == 0:
        return 0.0
    parsed = 0
    for val in sample:
        v = val.strip()
        cleaned = _AMOUNT_DECORATIONS.sub("", v)
        cleaned = cleaned.replace(",", "").replace("(", "-").replace(")", "")
        cleaned = re.sub(r"[\s₹$€£]", "", cleaned)
        try:
            float(cleaned)
            parsed += 1
        except ValueError:
            pass
    return parsed / len(sample)


def _type_flag_rate(series: pd.Series) -> float:
    """Fraction of non-null values that look like Dr/Cr flags."""
    sample = series.dropna().astype(str).head(50)
    if len(sample) == 0:
        return 0.0
    matched = sum(
        1 for v in sample
        if _DR_VARIANTS.match(v.strip()) or _CR_VARIANTS.match(v.strip())
    )
    return matched / len(sample)


def _score_col(df: pd.DataFrame, col: str, role: str) -> float:
    """Score a single column for a given role (0–1).

    Score = 0.5 × header_match + 0.5 × value_content_match.
    Decoy columns receive a 0.4× penalty multiplier on the final score.
    """
    series = df[col]
    lower = col.lower().strip()

    if role == "txn_date":
        h = _keyword_score(col, _DATE_KEYWORDS)
        v = _date_parse_rate(series)
    elif role == "debit":
        h = _keyword_score(col, _DEBIT_KEYWORDS)
        v = _numeric_parse_rate(series, ignore_blanks=True)
    elif role == "credit":
        h = _keyword_score(col, _CREDIT_KEYWORDS)
        v = _numeric_parse_rate(series, ignore_blanks=True)
    elif role == "amount":
        h = _keyword_score(col, _AMOUNT_KEYWORDS)
        v = _numeric_parse_rate(series, ignore_blanks=False)
    elif role == "balance_after":
        h = _keyword_score(col, _BALANCE_KEYWORDS)
        v = _numeric_parse_rate(series, ignore_blanks=False)
    elif role == "txn_type":
        h = _keyword_score(col, _TYPE_KEYWORDS)
        v = _type_flag_rate(series)
    elif role == "description":
        h = _keyword_score(col, _DESCRIPTION_KEYWORDS)
        # Value check: high non-null rate of string values (not parseable as number)
        non_null = series.dropna().astype(str).head(50)
        if len(non_null) == 0:
            v = 0.0
        else:
            not_numeric = sum(1 for x in non_null if _numeric_parse_rate(pd.Series([x])) < 0.8)
            v = not_numeric / len(non_null)
    else:
        h, v = 0.0, 0.0

    score = 0.5 * h + 0.5 * v
    if _is_decoy(lower, series):
        score *= 0.4
    return round(score, 4)


def _best_col(
    df: pd.DataFrame,
    candidates: list[str],
    role: str,
    min_score: float = 0.25,
) -> tuple[str | None, float]:
    """Return the highest-scoring candidate column and its score."""
    best_col, best_score = None, 0.0
    for col in candidates:
        s = _score_col(df, col, role)
        if s > best_score:
            best_score, best_col = s, col
    if best_score < min_score:
        return None, 0.0
    return best_col, best_score


# ── Header-row detection ──────────────────────────────────────────────────────

def detect_header_row(raw_lines: list[str], max_scan: int = 30) -> int:
    """Scan the first *max_scan* lines for the row with ≥2 header keyword hits.

    Returns the 0-based index of the header row. If no row scores ≥2, returns
    0 (assume the file has no preamble and row 0 is already the header).
    """
    for i, line in enumerate(raw_lines[:max_scan]):
        cells = [c.strip().lower() for c in line.split(",")]
        hits = 0
        for cell in cells:
            if not cell:
                continue
            for kw in ALL_HEADER_KEYWORDS:
                # Normalise underscores and slashes to spaces for clean boundary checks
                normalized_cell = cell.replace("_", " ").replace("/", " ")
                normalized_kw = kw.replace("_", " ").replace("/", " ")
                pattern = rf"\b{re.escape(normalized_kw)}\b"
                if re.search(pattern, normalized_cell):
                    hits += 1
                    break
        if hits >= 2:
            return i
    return 0


def _classify_date(df: pd.DataFrame, all_cols: list[str], mapping: ColumnMapping, claimed: set[str], scores_used: list[float]) -> None:
    date_col, date_score = _best_col(df, all_cols, "txn_date", min_score=0.3)
    if date_col:
        mapping.txn_date_col = date_col
        claimed.add(date_col)
        scores_used.append(date_score)


def _classify_balance(df: pd.DataFrame, all_cols: list[str], mapping: ColumnMapping, claimed: set[str], scores_used: list[float]) -> None:
    remaining = [c for c in all_cols if c not in claimed]
    balance_candidates = [
        c for c in remaining
        if _keyword_score(c, _BALANCE_KEYWORDS) > 0
    ]
    balance_col, balance_score = _best_col(df, balance_candidates, "balance_after", min_score=0.4)
    if balance_col:
        mapping.balance_col = balance_col
        claimed.add(balance_col)
        scores_used.append(balance_score)


def _classify_amount_and_type(df: pd.DataFrame, all_cols: list[str], mapping: ColumnMapping, claimed: set[str], scores_used: list[float]) -> None:
    remaining = [c for c in all_cols if c not in claimed]
    type_col, type_score = _best_col(df, remaining, "txn_type", min_score=0.35)

    remaining_for_amount = [c for c in all_cols if c not in claimed and c != type_col]

    # Priority 1 — flagged: one amount col + a decent txn_type column
    if type_col and type_score >= 0.45:
        amt_col, amt_score = _best_col(df, remaining_for_amount, "amount", min_score=0.25)
        if not amt_col:
            amt_col, amt_score = _best_col(df, remaining_for_amount, "debit", min_score=0.25)
        if amt_col and amt_score > 0.0:
            mapping.amount_pattern = "flagged"
            mapping.amount_cols = [amt_col]
            mapping.txn_type_col = type_col
            claimed.update({amt_col, type_col})
            scores_used.extend([amt_score, type_score])
            return

    # Priority 2 — split: debit col + credit col (both numeric)
    debit_col, debit_score = _best_col(df, remaining_for_amount, "debit", min_score=0.3)
    if debit_col:
        remaining2 = [c for c in remaining_for_amount if c != debit_col]
        credit_col, credit_score = _best_col(df, remaining2, "credit", min_score=0.3)
        if credit_col and credit_score > 0.0:
            mapping.amount_pattern = "split"
            mapping.amount_cols = [debit_col, credit_col]
            claimed.update({debit_col, credit_col})
            scores_used.extend([debit_score, credit_score])
            return

    # Priority 3 — signed: single numeric column
    amt_col, amt_score = _best_col(df, remaining_for_amount, "amount", min_score=0.2)
    if not amt_col:
        amt_col, amt_score = _best_col(df, remaining_for_amount, "debit", min_score=0.2)
    if amt_col:
        mapping.amount_pattern = "signed"
        mapping.amount_cols = [amt_col]
        claimed.add(amt_col)
        scores_used.append(amt_score)


def _classify_description(df: pd.DataFrame, all_cols: list[str], mapping: ColumnMapping, claimed: set[str], scores_used: list[float]) -> None:
    desc_candidates = [c for c in all_cols if c not in claimed]
    desc_scored = sorted(
        [(c, _score_col(df, c, "description")) for c in desc_candidates],
        key=lambda x: x[1],
        reverse=True,
    )
    desc_cols = [c for c, s in desc_scored if s >= 0.25]
    if desc_cols:
        mapping.description_cols = desc_cols
        scores_used.append(desc_scored[0][1])


# ── Main classifier ───────────────────────────────────────────────────────────

def classify_columns(df: pd.DataFrame) -> ColumnMapping:
    """Classify columns in *df* into canonical roles.

    Guardrails (in order):
    1. Claim balance_after first to exclude it from amount candidacy.
    2. Resolve amount pattern: flagged → split → signed.
    3. Coalesce description across multiple candidate columns.
    4. Exclude all claimed columns from description candidacy.
    """
    mapping = ColumnMapping()
    all_cols = list(df.columns)
    claimed: set[str] = set()
    scores_used: list[float] = []

    _classify_date(df, all_cols, mapping, claimed, scores_used)
    _classify_balance(df, all_cols, mapping, claimed, scores_used)
    _classify_amount_and_type(df, all_cols, mapping, claimed, scores_used)
    _classify_description(df, all_cols, mapping, claimed, scores_used)

    mapping.confidence = round(min(scores_used, default=0.0), 4)

    return mapping
