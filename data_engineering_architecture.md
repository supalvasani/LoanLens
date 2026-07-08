# LoanLens — Data Engineering Architecture

## Overview

LoanLens processes bank statements through a universal ingestion pipeline that converts **any** bank's CSV export into canonical rows in `raw_transactions` before dbt ever sees the data.

---

## Pipeline Topology

```
Applicant uploads CSV (POST /upload/bank-statement)
        │
        ▼
  ┌─────────────────────────────────────────────┐
  │           upload.py (FastAPI route)          │
  │  1. Validate file type / size                │
  │  2. Resolve applicant from JWT               │
  │  3. Check SHA-256 duplicate (statement_uploads)│
  │  4. Call ingest_statement()                  │
  └───────────────┬─────────────────────────────┘
                  │
                  ▼
  ┌─────────────────────────────────────────────┐
  │       pipeline.py  (ingest_statement)        │
  │                                              │
  │  SHA-256 → header detect → CSV parse         │
  │        │                                     │
  │        ├─── format_registry lookup ──────────┤ (fast path)
  │        │         hit: use stored mapping      │
  │        │         miss: ↓                      │
  │        ├─── column_classifier.py ────────────┤ (heuristic path)
  │        │    • score each col for 5 roles      │
  │        │    • claim balance_after first        │
  │        │    • flagged > split > signed         │
  │        │    • coalesce description cols        │
  │        │                                      │
  │  confidence gate (< 0.55 → reject)           │
  │        │                                      │
  │  resolve canonical rows                       │
  │        │                                      │
  │  reconcile.py  (balance check)               │
  │    pass  → continue                           │
  │    warn  → store + flag review                │
  │    fail  → reject + flag review               │
  │        │                                      │
  │  dedup.py (attach UUID5 raw_ids)             │
  │        │                                      │
  │  return IngestResult                          │
  └───────────────┬─────────────────────────────┘
                  │
                  ▼
  ┌─────────────────────────────────────────────┐
  │         PostgreSQL (raw layer)               │
  │  raw_transactions (ON CONFLICT raw_id NOTHING)│
  │  statement_uploads                           │
  │  format_review_queue  (on rejection)         │
  └───────────────┬─────────────────────────────┘
                  │  (hourly via Airflow DAG)
                  ▼
  ┌─────────────────────────────────────────────┐
  │         dbt (transform layer)               │
  │  stg_transactions  — pure type-cast pass    │
  │  int_transactions_categorized  — keyword hint│
  │  int_* models                               │
  │  mart_credit_score, mart_fraud_flags, etc.  │
  └─────────────────────────────────────────────┘
```

---

## Table Lineage

| Table | Populated by | Purpose |
|---|---|---|
| `raw_transactions` | `upload.py`, `ingest_statements` DAG | Canonical transaction rows |
| `statement_uploads` | Same as above | File-level dedup + reconciliation metadata |
| `format_registry` | Manual review → `confidence_source='manual'` | Fast-path header→mapping cache |
| `format_review_queue` | Pipeline on rejection/warn | Human review queue for new banks |

---

## Ingestion Package (`backend/app/ingestion/`)

| Module | Responsibility |
|---|---|
| `column_classifier.py` | Score columns for 5 roles, resolve amount pattern, detect header row |
| `reconcile.py` | Stable-sort balance continuity check, tier verdict, surface mismatches |
| `dedup.py` | SHA-256 file hash, UUID5 row ID with balance-or-index tiebreaker |
| `pipeline.py` | Orchestrate all of the above, gate on confidence + reconciliation |

---

## Architectural Principles

1. **No hardcoded bank names** — `format_registry` is a cache, not a requirement. Removing it must not break ingestion.
2. **Balance reconciliation is the truth signal** — any real bank statement satisfies `balance[i] == balance[i-1] ± amount[i]`. Failing reconciliation means the mapping is wrong.
3. **Stable sort is mandatory** — `kind="mergesort"` on `txn_date` preserves same-day file order, which is required for correct balance continuity checking.
4. **dbt is a pure type-cast layer** — zero bank-specific logic in SQL. All format normalisation happened upstream.
5. **Review queue closes the loop** — every rejection routes to `format_review_queue` so humans can confirm mappings that then promote to `format_registry`. A new bank is never silently rejected forever.

---

## Slots into `ingest_statements` Airflow DAG

The Airflow DAG (`backend/airflow/dags/ingest_statements.py`) runs hourly and:
1. Picks up CSV files from `/opt/airflow/data/landing/transactions/`
2. Runs each through `ingest_statement()`
3. Bulk-inserts `raw_transactions` and `statement_uploads` on success
4. Writes `format_review_queue` on any rejection
5. Triggers `run_dbt_transforms` DAG on completion

---

## format_registry Promotion Policy

Registry entries may only have `confidence_source` in `('manual', 'heuristic_promoted')`:

- **`manual`**: A human confirmed the mapping via the review queue UI.
- **`heuristic_promoted`**: Explicit promotion after N successful high-confidence heuristic runs with passing reconciliation.

> **Never auto-promote on the first successful heuristic pass.** That risks silently trusting an unreviewed guess as a fast-path for every future upload from that bank.
