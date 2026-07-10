# LoanLens

**Automated loan eligibility and credit scoring platform for Indian NBFCs.**

LoanLens is a full-stack data engineering + web application that accepts bank statement CSVs from any Indian bank, processes them through a universal ingestion pipeline, computes credit scores and loan eligibility using dbt transforms, and surfaces the results to analysts, managers, and applicants through a role-scoped React frontend.

---

## Table of Contents

- [App Architecture](#app-architecture)
  - [System Overview](#system-overview)
  - [Backend — FastAPI](#backend--fastapi)
  - [Frontend — React + Vite](#frontend--react--vite)
  - [Data Layer — PostgreSQL + dbt](#data-layer--postgresql--dbt)
  - [Orchestration — Apache Airflow](#orchestration--apache-airflow)
  - [Role-Based Access Control](#role-based-access-control)
  - [Decision Engine & Escalation Rules](#decision-engine--escalation-rules)
- [Data Engineering Architecture](#data-engineering-architecture)
- [Quick Start (Docker)](#quick-start-docker)
- [Service URLs](#service-urls)
- [Seed Users (login)](#seed-users-login)
- [Local Development (without full Docker)](#local-development-without-full-docker)
- [dbt (staging layer)](#dbt-staging-layer)
- [Troubleshooting](#troubleshooting)

---

## App Architecture

### System Overview

```
+-------------------------+     HTTPS/REST     +---------------------------+
|   React Frontend        |<------------------>|   FastAPI Backend         |
|   (Vite, TypeScript)    |                    |   (Python 3.12, asyncio)  |
|   port 5173             |                    |   port 8000               |
+-------------------------+                    +---------------------------+
                                                        |
                          +-----------------------------+-----------------------------+
                          |                             |                             |
                  +-------+-------+           +---------+------+           +----------+-----+
                  |  PostgreSQL   |           | Apache Airflow |           |   Metabase     |
                  |  (port 5432)  |           | (port 8080)    |           |  (port 3000)   |
                  |               |           |                |           |                |
                  |  raw layer    |           |  5 DAGs        |           |  BI dashboards |
                  |  dbt marts    |           |  hourly ingest |           |  connected to  |
                  |  auth tables  |           |  dbt triggers  |           |  PostgreSQL    |
                  +---------------+           +----------------+           +----------------+
```

### Backend — FastAPI

The backend is a fully async FastAPI application located at `backend/app/`.

#### Directory Structure

```
backend/
  app/
    api/v1/routes/          -- HTTP route handlers (one file per domain)
      auth.py               -- JWT login, token refresh
      upload.py             -- Bank statement upload + ingestion pipeline
      applications.py       -- Loan application CRUD
      decisions.py          -- Analyst/Manager/Admin decisions
      credit_scores.py      -- Credit score retrieval
      eligibility.py        -- Loan eligibility retrieval
      analyst.py            -- Analyst-specific views
      manager.py            -- Manager-specific views
      admin.py              -- Admin CRUD: users, loan config, audit log
      chatbot.py            -- AI assistant for applicants
      users.py              -- Profile management
    ingestion/              -- Universal bank statement ingestion pipeline
      pipeline.py           -- Main orchestrator (10-step pipeline)
      column_classifier.py  -- Heuristic column-role classifier
      reconcile.py          -- Balance continuity checker
      dedup.py              -- SHA-256 + UUID5 deduplication
    services/               -- Business logic layer
      auth_service.py
      application_service.py
      decision_service.py
      admin_service.py
      manager_service.py
      chatbot_service.py
    models/                 -- SQLAlchemy ORM models
      user.py               -- User, Role
      loan.py               -- LoanTypeConfig, AuditLog, Decision,
                               RawApplicant, RawLoanApplication
    repositories/           -- Database access layer (async SQLAlchemy)
    schemas/                -- Pydantic request/response schemas
    core/                   -- Config, auth, database, rate limiting, logger
    exceptions/             -- Domain exceptions (EscalationRequired, etc.)
    enums.py                -- RoleEnum, DecisionEnum, LoanTypeEnum, etc.
    main.py                 -- FastAPI app factory, middleware, router mount
  airflow/dags/             -- Airflow DAG definitions
  alembic/                  -- Database migrations
  scripts/                  -- Seed scripts, data generators
  tests/                    -- pytest test suite
```

#### API Surface (`/api/v1/...`)

| Route prefix | Handler file | Key endpoints |
|---|---|---|
| `/auth` | `auth.py` | `POST /login`, `POST /refresh` |
| `/upload` | `upload.py` | `POST /bank-statement` |
| `/applications` | `applications.py` | `POST /`, `GET /`, `GET /{id}` |
| `/decisions` | `decisions.py` | `POST /analyst`, `POST /manager`, `POST /admin` |
| `/credit-scores` | `credit_scores.py` | `GET /`, `GET /{applicant_id}` |
| `/eligibility` | `eligibility.py` | `GET /`, `GET /{applicant_id}` |
| `/analyst` | `analyst.py` | `GET /queue`, `GET /applicant/{id}` |
| `/manager` | `manager.py` | `GET /escalations`, `GET /reports` |
| `/admin` | `admin.py` | `GET /users`, `PUT /loan-config`, `GET /audit-log` |
| `/chatbot` | `chatbot.py` | `POST /message` |
| `/users` | `users.py` | `GET /me`, `PUT /me` |

#### Middleware Stack

```
Request
  --> CORS middleware (configurable allowed origins)
  --> Rate limiter (slowapi, per-IP)
  --> Request logger (structured JSON logs, latency_ms)
  --> Route handler
  --> Response
```

#### Authentication

JWT-based with role claims. The `require_role()` dependency validates the token and asserts the caller's role. Roles: `admin`, `manager`, `analyst`, `applicant`.

Token flow:
```
POST /api/v1/auth/login
  --> validates email + bcrypt password
  --> returns access_token (JWT, 30 min) + refresh_token
POST /api/v1/auth/refresh
  --> validates refresh_token
  --> returns new access_token
```

---

### Frontend — React + Vite

The frontend is a TypeScript React SPA located at `frontend/src/`.

#### Directory Structure

```
frontend/src/
  pages/
    LoginPage.tsx             -- Email/password login
    RegisterPage.tsx          -- Applicant self-registration
    ApplicantDashboard.tsx    -- Applicant home: upload, apply, status
    AnalystDashboard.tsx      -- Analyst queue, credit scores, decisions
    ManagerDashboard.tsx      -- Manager escalations, reports
    AdminDashboard.tsx        -- Admin: user management, loan config, logs
    portal/                   -- Applicant sub-pages (upload, applications)
    analyst/                  -- Analyst sub-pages (applicant deep-dive)
    manager/                  -- Manager sub-pages (escalation detail)
    admin/                    -- Admin sub-pages (config, audit)
  components/
    DashboardShell.tsx        -- Sidebar + header layout wrapper
    ProfileModal.tsx          -- User profile editor
    ChatbotPanel.tsx          -- Floating AI assistant panel
  contexts/                   -- React context (AuthContext, ThemeContext)
  hooks/                      -- Custom hooks (useAuth, useFetch, etc.)
  services/                   -- API client functions
  types/                      -- TypeScript interfaces
  utils/                      -- Formatters, validators
```

#### Role-Scoped Routing

The app renders a different dashboard based on the authenticated user's role:

```
/login        --> LoginPage
/register     --> RegisterPage (applicants only)
/             --> redirect based on role:
                    applicant --> ApplicantDashboard
                    analyst   --> AnalystDashboard
                    manager   --> ManagerDashboard
                    admin     --> AdminDashboard
```

Each dashboard is a shell with a sidebar navigation and lazy-loaded sub-pages.

---

### Data Layer — PostgreSQL + dbt

#### Raw Layer (written by FastAPI + Airflow)

| Table | Purpose |
|---|---|
| `users` | Authentication: email, bcrypt password hash, role |
| `raw_applicants` | Applicant KYC data linked to a `user_id` |
| `raw_loan_applications` | Loan applications (type, amount, purpose, status) |
| `raw_transactions` | Canonical transaction rows from all uploaded statements |
| `statement_uploads` | File-level upload metadata (hash, reconciliation verdict) |
| `format_registry` | Known bank CSV format cache (header set -> column mapping) |
| `format_review_queue` | Rejected/warned uploads awaiting human review |
| `decisions` | Append-only decision log (approved/rejected/escalated) |
| `audit_log` | Every mutation with old/new values (JSONB) |
| `loan_type_config` | Per-loan-type thresholds: min_score, max_amount, escalation bands |
| `rbi_rates` | RBI repo rate (ingested by Airflow DAG) |

#### dbt Transform Layer (read by FastAPI)

```
Staging (stg_*)
  stg_transactions          -- type-cast + normalise raw_transactions
  stg_applicants            -- cast raw_applicants
  stg_rbi_rates             -- expose current repo rate
  stg_merchant_categories   -- keyword-to-category seed table

Intermediate (int_*)
  int_transactions_categorized   -- merchant category per transaction
  int_monthly_income_summary     -- monthly salary/income aggregates
  int_monthly_obligation_summary -- monthly EMI outflows
  int_balance_trends             -- month-over-month balance trends
  int_bounce_history             -- ECS bounce / cheque dishonour events
  int_spending_by_category       -- spend aggregated by category + month
  int_combined_signals           -- unified per-applicant signal row

Marts (mart_*)
  mart_credit_score          -- credit score 0-100 with component breakdown
  mart_loan_eligibility      -- eligible amount per loan type per applicant
  mart_fraud_flags           -- fraud signal flags
  mart_monthly_credit_trend  -- monthly credit health time series
  mart_risk_segmentation     -- risk tier: low / medium / high
  mart_underwriter_report    -- flat underwriter summary row
```

---

### Orchestration — Apache Airflow

Airflow runs in **LocalExecutor** mode (no Redis/Celery worker needed).

| DAG | Schedule | What it does |
|---|---|---|
| `ingest_statements` | `@hourly` | Reads CSVs from landing zone, runs ingestion pipeline, bulk-inserts to raw_transactions, triggers dbt |
| `run_dbt_transforms` | Triggered | Runs `dbt run` for staging + intermediate models, triggers data_quality_check |
| `data_quality_check` | Triggered | Runs `dbt test` assertions |
| `generate_reports` | On-demand | Refreshes mart tables |
| `ingest_rbi_rates` | Scheduled | Fetches latest RBI repo rate |

---

### Role-Based Access Control

| Role | Who | What they can do |
|---|---|---|
| `applicant` | Loan applicants | Upload bank statements, submit loan applications, view their own status and credit score |
| `analyst` | Credit officers | View applicant queue, read credit scores, approve/reject applications (within score bands), escalate to manager |
| `manager` | Senior officers | Handle escalated applications, approve high-value loans, view reports, escalate to admin |
| `admin` | Platform admins | Full user management, loan type configuration, audit log access, admin overrides on any application |

---

### Decision Engine & Escalation Rules

The `DecisionService` enforces escalation rules **at the service layer**, not in routes:

```
Score > 65  --> Analyst MAY approve directly
Score < 45  --> Analyst MAY reject directly
Score 45-65 --> MUST escalate to Manager (EscalationRequiredError)
Any fraud flag present --> MUST escalate regardless of score
Loan amount > manager_threshold_amount --> MUST escalate to Manager
```

Managers can override analyst decisions and escalate further to Admin. Admins can issue an `AdminOverride` on any application.

All decisions are **append-only** (`DecisionRepository.insert` only, no updates). Every decision writes an `audit_log` entry with `old_value` and `new_value` as JSONB.

Loan type thresholds (`loan_type_config`) are configurable by admins at runtime without code changes.

---

## Data Engineering Architecture

LoanLens processes bank statement CSVs from any bank using a universal ingestion pipeline that operates with **zero bank-name branching** in the code. Below is the detailed architecture of the data engineering component.

### 1. Overview & Design Philosophy

LoanLens ingests bank statement CSVs from **any** Indian bank without needing a handwritten parser per bank. The pipeline is built on three guarantees:

| Guarantee | Mechanism |
|---|---|
| **No hardcoded bank names** | Column mapping is derived entirely from header keywords + value statistics |
| **Balance reconciliation is the truth signal** | Any real bank statement satisfies `balance[i] = balance[i-1] +/- amount[i]`; failing this check means the mapping is wrong |
| **Idempotent at every level** | File-level SHA-256 + row-level UUID5 make re-running the same upload a no-op |

### 2. End-to-End Pipeline Topology

```
                          +-----------------------------------------+
                          |  INPUT SURFACE                          |
                          |                                         |
          Applicant       |  POST /api/v1/upload/bank-statement     |
          uploads CSV --->|  (FastAPI, authenticated JWT)           |
                          |  5 MB size cap, .csv only               |
                          +--------------------+--------------------+
                                               |
                                               | raw bytes
                                               v
                          +-----------------------------------------+
                          |  INGESTION PIPELINE                     |
                          |  backend/app/ingestion/pipeline.py      |
                          |                                         |
                          |  Step 0.  SHA-256 file hash             |
                          |            duplicate? --> 409           |
                          |                                         |
                          |  Step 1.  UTF-8-sig / Latin-1 decode    |
                          |                                         |
                          |  Step 2.  Header-row detection          |
                          |            scan first 30 lines          |
                          |            for >= 2 keyword hits        |
                          |                                         |
                          |  Step 3.  Minimum row check (< 3 -> 422)|
                          |                                         |
                          |  Step 4.  Format registry lookup        |
                          |            HIT  -> use stored mapping   |
                          |                   (confidence = 1.0)   |
                          |            MISS -> column_classifier    |
                          |                                         |
                          |  Step 5.  Confidence gate               |
                          |            < 0.55 -> reject + queue     |
                          |                                         |
                          |  Step 6.  Canonical resolution          |
                          |            flagged pattern              |
                          |            split pattern                |
                          |            signed pattern               |
                          |                                         |
                          |  Step 7.  Unparse-rate gate             |
                          |            > 10% failures -> reject     |
                          |                                         |
                          |  Step 8.  Balance reconciliation        |
                          |            pass  (>= 98%) -> continue   |
                          |            warn  (85-98%) -> flag       |
                          |            fail  (< 85%) -> reject      |
                          |                                         |
                          |  Step 9.  UUID5 raw_id attachment       |
                          +--------------------+--------------------+
                                               |
                                               | canonical rows
                                               v
                          +-----------------------------------------+
                          |  RAW LAYER -- PostgreSQL                |
                          |                                         |
                          |  raw_transactions                       |
                          |    ON CONFLICT (raw_id) DO NOTHING      |
                          |                                         |
                          |  statement_uploads                      |
                          |    (file-level metadata)                |
                          |                                         |
                          |  format_review_queue                    |
                          |    (on reject/warn)                     |
                          +--------------------+--------------------+
                                               |
                                               |  hourly (Airflow)
                                               v
                          +-----------------------------------------+
                          |  TRANSFORM LAYER -- dbt                 |
                          |                                         |
                          |  Staging                                |
                          |    stg_transactions                     |
                          |    stg_applicants                       |
                          |    stg_rbi_rates                        |
                          |    stg_merchant_categories              |
                          |                                         |
                          |  Intermediate                           |
                          |    int_transactions_categorized         |
                          |    int_monthly_income_summary           |
                          |    int_monthly_obligation_summary       |
                          |    int_balance_trends                   |
                          |    int_bounce_history                   |
                          |    int_spending_by_category             |
                          |    int_combined_signals                 |
                          |                                         |
                          |  Marts                                  |
                          |    mart_credit_score                    |
                          |    mart_loan_eligibility                |
                          |    mart_fraud_flags                     |
                          |    mart_monthly_credit_trend            |
                          |    mart_risk_segmentation               |
                          |    mart_underwriter_report              |
                          +-----------------------------------------+
```

### 3. Ingestion Layer

All ingestion logic lives in `backend/app/ingestion/`. The orchestrator is `pipeline.py`; it calls the other three modules in sequence.

#### 3.1 Step 0 — File-Level Deduplication

**Module:** `dedup.py -> file_hash()`

Before any parsing happens, the raw bytes are hashed with **SHA-256**:

```python
def file_hash(raw_bytes: bytes) -> str:
    return hashlib.sha256(raw_bytes).hexdigest()
```

The hash is checked against `statement_uploads(applicant_id, file_hash)` — a composite unique constraint enforced at the DB level. If the exact same file was previously uploaded by the same applicant, the pipeline returns `STATUS_DUPLICATE_FILE` immediately with no DB writes.

**Why SHA-256 and not MD5?** SHA-256 is collision-resistant; an adversary cannot produce a different file with the same hash to bypass duplicate detection.

#### 3.2 Step 1 — Encoding Detection & Header-Row Scan

**Module:** `pipeline.py -> ingest_statement()`, `column_classifier.py -> detect_header_row()`

##### Encoding

Banks export CSVs in different encodings. The pipeline tries `utf-8-sig` first (handles BOM from Excel), falls back to `latin-1`. If neither works it returns `STATUS_NOT_A_BANK_STATEMENT`.

##### Header-Row Detection

Many Indian bank exports prepend metadata rows before the actual column headers (e.g., account number, branch, date range). The detector scans the **first 30 lines** looking for the first line that scores **>= 2 header keyword hits**:

```
ALL_HEADER_KEYWORDS = {
    date, txn_date, transaction date, value date, posting date, ...
    amount, withdrawal, deposit, txn amount, ...
    debit, dr, withdrawal amt, ...
    credit, cr, deposit amt, ...
    balance, closing balance, running balance, bal, ...
    description, narration, particulars, remarks, ...
    type, txn_type, cr/dr, dr/cr, drcr, ...
}
```

Each candidate line is tokenised, normalised (underscores/slashes to spaces), and matched using word-boundary regex. The first line with >= 2 keyword hits is the header row. Everything above it is discarded before CSV parsing.

#### 3.3 Step 2 — Format Registry Fast Path

**Module:** `pipeline.py`, DB table `format_registry`

After parsing the CSV, the detected column-name set (lowercased, stripped) is turned into a `frozenset`. This key is looked up in `format_registry`:

```sql
SELECT match_headers, column_map, amount_pattern FROM format_registry
```

**Registry hit:** The stored `column_map` JSON is deserialized into a `ColumnMapping` with `confidence = 1.0` (human-confirmed). The heuristic classifier is **bypassed entirely**.

**Registry miss:** Falls through to the column classifier.

The registry is a **performance optimisation, not a correctness requirement**. Removing all registry entries degrades throughput but never breaks ingestion — every file simply goes through the heuristic path.

#### 3.4 Step 3 — Column Classifier Heuristic Path

**Module:** `column_classifier.py -> classify_columns()`

This is the core innovation. Given a `pandas.DataFrame` with unknown column headers, the classifier assigns each column to one of **six canonical roles** using a two-component score:

```
score = 0.5 * header_score + 0.5 * value_content_score
```

##### Scoring Functions

| Function | What it measures |
|---|---|
| `_keyword_score(col, kw_set)` | Exact match = 1.0; substring match = 0.7; no match = 0.0 |
| `_date_parse_rate(series)` | Fraction of first 50 non-null values parseable as dates |
| `_numeric_parse_rate(series)` | Fraction parseable as a number (strips commas, parentheses) |
| `_type_flag_rate(series)` | Fraction that look like DR, CR, Debit, Credit variants |

##### Decoy Detection

A dedicated guard prevents serial/index columns from polluting amount or date roles:

```python
_DECOY_PATTERNS = re.compile(
    r"^(sl[\s._-]*no\.?|serial[\s._-]*no\.?|ref[\s._-]*no\.?|
       cheque[\s._-]*no\.?|day|month|year|chq[\s._-]*no\.?|...)$"
)
```

Additionally, any column that is a **strictly increasing integer sequence from 0 or 1** (data-driven check) receives a **0.4x penalty multiplier** on its final score, regardless of its column name.

##### Classification Order (guardrails matter)

The classifier follows a strict priority order to avoid role conflicts:

1. **`txn_date`** — claimed first (unique role, highest confidence needed)
2. **`balance_after`** — claimed **before** amount scoring to prevent the balance column from being mistaken for an amount column. Requires a keyword component > 0 (a bare numeric column cannot become the balance column)
3. **`txn_type`** — tentatively found (used to detect `flagged` pattern)
4. **Amount pattern resolution** — three patterns tried in priority order:
   - **`flagged`**: one amount column + a txn_type column (DR/CR flag). Requires `type_score >= 0.45`
   - **`split`**: separate debit column + credit column (both sparse-numeric). Requires both `debit_score >= 0.3` and `credit_score >= 0.3`
   - **`signed`**: single signed-numeric column (positive = credit, negative = debit). Fallback
5. **`description`** — all remaining unclaimed columns with score >= 0.25 are collected and coalesced left-to-right at row resolution time

##### Output: ColumnMapping

```python
@dataclass
class ColumnMapping:
    txn_date_col:      Optional[str]
    amount_cols:       list[str]   # [debit, credit] | [amount] | [amount]
    txn_type_col:      Optional[str]   # only for 'flagged' pattern
    description_cols:  list[str]       # coalesced left-to-right
    balance_col:       Optional[str]
    amount_pattern:    str             # 'flagged' | 'split' | 'signed'
    confidence:        float           # min of all role scores used
```

`confidence` = minimum of all role scores that contributed to the mapping. This is a conservative estimate — if any role is poorly identified, the whole mapping's confidence drops.

#### 3.5 Step 4 — Confidence Gate

**Module:** `pipeline.py`

Two gates apply only on the **heuristic path** (registry-resolved mappings bypass both):

| Gate | Threshold | Action |
|---|---|---|
| Column-mapping confidence | < 0.55 | Return `STATUS_LOW_CONFIDENCE`, write `format_review_queue` |
| Core-field unparse rate | > 10% | Return `STATUS_LOW_CONFIDENCE`, write `format_review_queue` |

A sanity check applies on **both** paths: if no `txn_date` or no `amount_cols` were resolved, return `STATUS_NOT_A_BANK_STATEMENT` immediately.

#### 3.6 Step 5 — Canonical Resolution

**Module:** `pipeline.py -> _resolve_canonical_rows()`

Each raw DataFrame row is converted into a canonical dict with fixed fields. This is where the three amount patterns diverge:

**`flagged` pattern** (e.g., Axis Bank, HDFC with DR/CR column):
```
amount   = parse(amount_col)      # always positive
txn_type = normalise(type_col)    # "DR" -> "debit", "CR" -> "credit"
```

**`split` pattern** (e.g., SBI, Kotak with separate Debit/Credit columns):
```
debit_val  = parse(debit_col)
credit_val = parse(credit_col)
if credit_val > 0: amount=credit_val, txn_type="credit"
else:              amount=debit_val,  txn_type="debit"
Rows where both are 0/null are skipped (summary rows)
```

**`signed` pattern** (single amount column, negative = debit):
```
signed_val = Decimal(raw)
amount   = abs(signed_val)
txn_type = "credit" if signed_val >= 0 else "debit"
```

**Description coalescing:** Multiple description columns are tried left-to-right; the first non-empty value wins.

**Date parsing:** 10 format strings tried in order: ISO, DD-MM-YYYY, DD/MM/YYYY, DD-Mon-YYYY, DD.MM.YYYY, MM/DD/YYYY, and short-year variants.

**Amount normalisation:** Commas stripped, parenthetical annotations removed (e.g., `"12,345.00 (Low Balance)"` -> `Decimal("12345.00")`). All amounts stored as **positive values**; direction is encoded in `txn_type`.

The canonical schema produced per row:
```
txn_date          date
amount            Decimal (always positive)
txn_type          "debit" | "credit"
description       str
balance_after     Decimal | None
source_format     "heuristic:split" | "registry:flagged" | ...
source_file_hash  sha256 hex
```

#### 3.7 Step 6 — Balance Reconciliation

**Module:** `reconcile.py -> reconcile()`

This is the **correctness oracle** for the mapping. Any real bank statement satisfies:

```
balance_after[i] == balance_after[i-1] +/- amount[i]
```

##### Algorithm

1. **Stable sort** by `txn_date` using `kind="mergesort"` — preserves same-day file order. Critical because balance is a running total; an unstable sort produces false mismatches on same-day batches
2. Compute signed delta per row: `+amount` for credit, `-amount` for debit
3. Compute `expected_balance = prev_balance + delta` for rows 2..N (first row has no predecessor)
4. Count rows where `|actual_balance - expected_balance| <= 0.01`
5. `match_rate = matched_rows / checked_rows`

##### Verdicts

| Verdict | Condition | Action |
|---|---|---|
| `pass` | match_rate >= 0.98 | Continue normally |
| `warn` | 0.85 <= match_rate < 0.98 | Accept rows, store with `needs_review` flag, write `format_review_queue` |
| `fail` | match_rate < 0.85 | Reject entire upload, write `format_review_queue` |
| `insufficient_data` | < 2 rows with balance | Skip check (no error) |

The mismatch sample (up to 5 rows) surfaces `txn_date`, `amount`, `txn_type`, `actual_balance`, `expected_balance`, and `diff` to the review queue for debugging.

#### 3.8 Step 7 — Row-Level Deduplication

**Module:** `dedup.py -> attach_raw_ids()`, `compute_row_id()`

After successful reconciliation, every canonical row receives a deterministic **UUID5** identifier:

```python
key = (
    f"{applicant_id}|"
    f"{txn_date}|"
    f"{float(amount):.2f}|"
    f"{txn_type}|"
    f"{description[:50]}|"
    f"{balance_after:.2f if not null else '_idx{fallback_index}'}"
)
raw_id = uuid.uuid5(UUID5_NAMESPACE, key)
```

The `fallback_index` (original row position in file) is used when `balance_after` is null — this prevents two **identical** same-day transactions (e.g., two Rs 500 debits with no balance data) from colliding and silently losing one via `ON CONFLICT DO NOTHING`.

The `raw_id` is enforced as a `UNIQUE` constraint on `raw_transactions`, so bulk-inserting an overlapping statement (e.g., Jan-Mar then Feb-Apr) silently skips already-seen rows without error.

### 4. Raw Layer — PostgreSQL Tables

| Table | Populated by | Purpose |
|---|---|---|
| `raw_transactions` | `upload.py` route, `ingest_statements` DAG | One row per canonical transaction. `ON CONFLICT (raw_id) DO NOTHING`. Includes `source_format`, `source_file_hash`, `raw_applicant_id` |
| `raw_applicants` | `ingest_statements` DAG, `seed_users` script | One row per applicant. `ON CONFLICT (applicant_ref) DO NOTHING` |
| `raw_loan_applications` | `applications.py` route | Loan applications submitted via the portal |
| `statement_uploads` | `upload.py` route | File-level metadata: `applicant_id`, `file_hash`, `file_name`, `row_count`, `reconciliation_verdict`, `needs_review`, `confidence` |
| `format_registry` | Manual review or promotion | Fast-path header-to-mapping cache. Keyed by `match_headers` (array of column names) |
| `format_review_queue` | Pipeline on any rejection or warn | Human review queue. Contains `file_hash`, `file_name`, `detected_headers`, `sample_rows`, `failure_reason`, `confidence` |
| `landing_ingest_log` | `ingest_statements` DAG | Tracks which landing-zone files have been processed (prevents re-processing on DAG retry) |

### 5. Orchestration — Airflow DAGs

All DAGs live in `backend/airflow/dags/`. Airflow runs in **LocalExecutor** mode (single container, no Redis/Celery needed).

#### DAG 1: `ingest_statements` (hourly schedule)

Picks up CSV files from the landing zone at `/opt/airflow/data/landing/`:

```
ingest_landing_files
    +-- Applicants sub-path: applicants/*.csv
    |    +-- INSERT INTO raw_applicants ON CONFLICT DO NOTHING
    +-- Transactions sub-path: transactions/*.csv
         +-- ingest_statement() for each file
             +-- bulk INSERT raw_transactions
             +-- format_review_queue on failure/warn
    
    --> triggers run_dbt_transforms on success
```

The DAG uses `landing_ingest_log` to skip already-processed files on retry. Each run writes a `pipeline_audit` record with `rows_processed`, `failures`, `status`, and timing.

#### DAG 2: `run_dbt_transforms` (triggered by ingest_statements)

```
run_dbt_staging_models
    +-- dbt run --select path:models/staging path:models/intermediate
    --> triggers data_quality_check
```

Runs dbt as a subprocess; Airflow worker has dbt installed via `_PIP_ADDITIONAL_REQUIREMENTS`.

#### DAG 3: `data_quality_check` (triggered by run_dbt_transforms)

Runs dbt tests and quality assertions. Writes audit records.

#### DAG 4: `generate_reports`

Generates reporting-layer mart tables on demand.

#### DAG 5: `ingest_rbi_rates`

Fetches current RBI repo rate data and loads into `rbi_rates` table, used in `mart_loan_eligibility` calculation.

### 6. Transform Layer — dbt

All dbt models live in `dbt/loanlens/models/`. Three layers following the medallion architecture: staging -> intermediate -> marts.

#### 6.1 Staging Models (`models/staging/`)

Pure type-cast / rename pass. **Zero business logic**.

| Model | Source | What it does |
|---|---|---|
| `stg_transactions` | `raw_transactions` | Casts `txn_date` to `date`, `amount` to `numeric`, normalises `txn_type` |
| `stg_applicants` | `raw_applicants` | Casts `monthly_income_declared`, trims PAN/phone |
| `stg_rbi_rates` | `rbi_rates` | Exposes current repo rate for eligibility calculations |
| `stg_merchant_categories` | `merchant_categories` seed | Maps keyword to merchant category |

#### 6.2 Intermediate Models (`models/intermediate/`)

Business-logic transformation. Each model answers a single analytical question.

| Model | Inputs | What it computes |
|---|---|---|
| `int_transactions_categorized` | `stg_transactions`, `stg_merchant_categories` | Keyword-match merchant categorisation per transaction (groceries, fuel, EMI, rent, salary, etc.) |
| `int_monthly_income_summary` | `int_transactions_categorized` | Monthly credited salary/income aggregates per applicant |
| `int_monthly_obligation_summary` | `int_transactions_categorized` | Monthly EMI / loan repayment outflows per applicant |
| `int_balance_trends` | `stg_transactions` | Month-over-month closing balance, trend direction, volatility |
| `int_bounce_history` | `stg_transactions` | Bounce / return transactions (ECS bounce, cheque dishonour, etc.) |
| `int_spending_by_category` | `int_transactions_categorized` | Aggregated spend per category per month |
| `int_combined_signals` | All intermediates | Unified per-applicant signal row (income, obligations, balance, bounces, categories) |

#### 6.3 Mart Models (`models/marts/`)

Analyst-facing, pre-aggregated tables. These are what the FastAPI services read from.

| Model | Inputs | Output |
|---|---|---|
| `mart_credit_score` | `int_combined_signals` | Single credit score (0-100) per applicant with component breakdown |
| `mart_loan_eligibility` | `int_combined_signals`, `stg_rbi_rates` | Loan eligibility per loan type with max eligible amount |
| `mart_fraud_flags` | `int_combined_signals`, `int_bounce_history` | Fraud signal flags (round-trip transfers, cash cycling, unusual patterns) |
| `mart_monthly_credit_trend` | `int_monthly_income_summary`, `int_balance_trends` | Monthly credit health trend for time-series charts |
| `mart_risk_segmentation` | `mart_credit_score` | Risk tier (low / medium / high) per applicant |
| `mart_underwriter_report` | All marts | Flattened underwriter view with all signals in one row |

### 7. Format Registry & Promotion Policy

#### Schema

```sql
format_registry (
    registry_id         uuid PRIMARY KEY,
    match_headers       text[],   -- frozenset key: lowered column names
    column_map          jsonb,    -- ColumnMapping fields serialized
    amount_pattern      text,     -- 'flagged' | 'split' | 'signed'
    confidence_source   text,     -- 'manual' | 'heuristic_promoted'
    created_at          timestamptz,
    updated_at          timestamptz
)
```

#### Promotion Rules

- **`manual`** — A human confirmed the mapping through the `format_review_queue` UI. Human reviewer sees: detected headers, sample rows, and the classifier's proposed mapping. They confirm or correct it.

- **`heuristic_promoted`** — After **N** successful high-confidence heuristic runs for the same header set with **passing reconciliation** on each run, the mapping may be promoted. A single lucky pass is never enough.

> **Never auto-promote on the first successful heuristic pass.** That risks silently trusting an unreviewed guess as a fast-path for every future upload from that bank.

#### Lifecycle

```
New bank file uploaded
    --> heuristic classifier runs
    --> reconciliation passes (or warns)
    --> entry written to format_review_queue
    --> human reviewer confirms/corrects mapping
    --> mapping inserted into format_registry (confidence_source='manual')
    --> next upload from same bank --> registry hit --> skip classifier
```

### 8. Architectural Principles

1. **No hardcoded bank names** — `format_registry` is an optional speed cache. Any file from any bank can be processed without a registry entry.

2. **Balance reconciliation is the correctness oracle** — The `reconcile()` function validates the column mapping independently. A mapping that produces wrong amount signs or wrong column assignments will fail reconciliation before any bad data reaches the raw layer.

3. **Stable sort is mandatory** — `kind="mergesort"` on `txn_date` preserves same-day transaction file order. An unstable sort would reorder same-day rows, producing false balance mismatches and incorrect reconciliation failures.

4. **dbt is a pure type-cast + analytics layer** — Zero bank-specific logic lives in SQL. All format normalisation happened upstream in the Python ingestion pipeline.

5. **Review queue closes the feedback loop** — Every rejected or warned file routes to `format_review_queue`. No new bank is silently rejected forever.

6. **Idempotent inserts at every layer** — `ON CONFLICT DO NOTHING` on `raw_transactions` (by `raw_id`) and `raw_applicants` (by `applicant_ref`) means every pipeline step can be safely retried.

7. **Amounts are always positive, direction is always explicit** — All amounts stored as `Decimal` positives; `txn_type IN ('debit', 'credit')` encodes direction. This makes SQL aggregation unambiguous.

8. **Confidence is conservative** — `ColumnMapping.confidence = min(all_role_scores)`. If any single role has a weak mapping, the overall confidence drops.

### 9. Feature Summary

#### Inputs Accepted

| Format | Example banks | Detection method |
|---|---|---|
| **Flagged** — amount + DR/CR column | Axis Bank, HDFC Bank | `txn_type` column with DR/CR values + single amount column |
| **Split** — separate Debit / Credit columns | SBI, Kotak Mahindra | Two sparse-numeric columns |
| **Signed** — single signed-amount column | Various online banks | Single amount column, negative = debit |
| **Any encoding** | UTF-8-BOM (Excel exports), Latin-1 | Tried in sequence |
| **Any preamble** | Axis Bank (account details on top) | Header-row detection scans first 30 rows |

#### Outputs Produced (from raw_transactions via dbt)

| Output | Where used |
|---|---|
| Credit score (0-100) | Analyst dashboard, decision engine |
| Loan eligibility per loan type | Applicant portal, manager dashboard |
| Fraud flags | Escalation engine, analyst dashboard |
| Monthly income trend | Underwriter report |
| Monthly obligation summary | Loan eligibility, credit score |
| Balance trends | Credit score, underwriter report |
| Bounce history | Fraud flags, credit score |
| Spending by category | Analyst dashboard |
| Risk tier (low/medium/high) | Manager dashboard, routing |
| Underwriter report | Manager single-applicant deep-dive |

#### Guarantees

| Guarantee | Implementation |
|---|---|
| No duplicate files per applicant | SHA-256 + UNIQUE(applicant_id, file_hash) on statement_uploads |
| No duplicate rows across overlapping uploads | UUID5 raw_id + ON CONFLICT DO NOTHING on raw_transactions |
| Balance correctness validation | reconcile() with +/-0.01 tolerance, 98%/85% thresholds |
| Same-day transaction order preserved | mergesort on txn_date |
| Pipeline is retryable | All DB inserts are idempotent |
| Bad mappings surfaced for review | format_review_queue on any failure/warn |
| New banks eventually supported | format_registry promotion after human review |

---

## Quick Start (Docker)

From the repository root:

```powershell
# 1. Ensure backend/.env exists (copy from example if needed)
Copy-Item backend\.env.example backend\.env

# 2. Reset DB if you had an older init.sql schema (first time or after Phase 0 fix)
docker compose down -v

# 3. Start core infra
docker compose up -d postgres redis

# 4. Run migrations + seed users + start API
docker compose up -d --build fastapi

# 5. Generate raw data (~500 applicants, ~180K transactions)
docker compose exec fastapi python -m scripts.generate_raw_data --load

# 6. Start Airflow + frontend + Metabase (optional full stack)
docker compose up -d --build airflow-init airflow-webserver airflow-scheduler airflow-worker frontend metabase
```

---

## Service URLs

| Service  | URL                   |
|----------|-----------------------|
| FastAPI  | http://localhost:8000 |
| Frontend | http://localhost:5173 |
| Airflow  | http://localhost:8080 |
| Metabase | http://localhost:3000 |
| Postgres | localhost:5432        |

**Airflow login:** `admin` / `admin`

---

## Seed Users (login)

| Role      | Email                 | Password      |
|-----------|-----------------------|---------------|
| Admin     | admin@loanlens.in     | Admin@123     |
| Manager   | manager@loanlens.in   | Manager@123   |
| Analyst   | analyst@loanlens.in   | Analyst@123   |
| Applicant | applicant@loanlens.in | Applicant@123 |

---

## Local Development (without full Docker)

```powershell
# Postgres must be running via Docker on port 5432
cd backend
pip install -r requirements.txt
alembic upgrade head
python -m scripts.seed_users
python -m scripts.generate_raw_data --load
python -m scripts.check_db
uvicorn app.main:app --reload --port 8000
```

---

## dbt (staging layer)

```powershell
pip install dbt-core dbt-postgres
$env:DBT_HOST="127.0.0.1"
$env:DBT_PORT="5432"
$env:DBT_USER="postgres"
$env:DBT_PASSWORD="admin"
$env:DBT_DBNAME="loanlens_db"
dbt seed --project-dir dbt/loanlens --profiles-dir dbt/loanlens --target dev
dbt run  --project-dir dbt/loanlens --profiles-dir dbt/loanlens --target dev --select path:models/staging
dbt test --project-dir dbt/loanlens --profiles-dir dbt/loanlens --target dev
```

---

## Troubleshooting

**`relation "users" already exists` on startup**
→ Old Postgres volume has pre-Alembic schema. Run `docker compose down -v` and start fresh.

**Port 5432 already in use**
→ Stop other Postgres instances or change the host port in `docker-compose.yml`.

**Airflow tasks stuck in queued**
→ Ensure `airflow-worker` container is running.

**dbt source not found**
→ Run `alembic upgrade head` and `python -m scripts.generate_raw_data --load` first.

**Upload returns `low_confidence` or `reconciliation_failed`**
→ Check `format_review_queue` table for the `detected_headers` and `sample_rows`. Use the admin UI to review the proposed mapping and promote it to `format_registry`.
