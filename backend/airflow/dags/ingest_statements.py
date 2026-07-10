"""Hourly ingest from CSV landing zone into raw layer tables.

Bank statement CSVs are processed through the universal ingestion pipeline
(column_classifier → reconcile → dedup). Any other CSV type (applicants)
is still inserted directly via the existing SQL.
"""

from __future__ import annotations

import json
import sys
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

import psycopg2
from airflow.operators.python import PythonOperator
from airflow.operators.trigger_dagrun import TriggerDagRunOperator

from airflow import DAG

# Make the app package importable from within Airflow workers
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from loanlens_common import db_dsn, write_pipeline_audit  # noqa: E402

from app.ingestion.dedup import file_hash as compute_file_hash  # noqa: E402
from app.ingestion.pipeline import (  # noqa: E402
    STATUS_OK,
    STATUS_RECONCILIATION_WARN,
    ingest_statement,
)

LANDING_ROOT = Path("/opt/airflow/data/landing")
APPLICANTS_DIR = LANDING_ROOT / "applicants"
TRANSACTIONS_DIR = LANDING_ROOT / "transactions"


def _already_ingested(cur, source_file: str) -> bool:
    cur.execute("SELECT 1 FROM landing_ingest_log WHERE source_file = %s", (source_file,))
    return cur.fetchone() is not None


def _file_hash_already_seen(cur, applicant_id: str, fhash: str) -> bool:
    """Check statement_uploads for exact-file dedup."""
    cur.execute(
        "SELECT 1 FROM statement_uploads WHERE applicant_id = %s AND file_hash = %s LIMIT 1",
        (applicant_id, fhash),
    )
    return cur.fetchone() is not None


def _registry_lookup_sync(cur, header_key: frozenset) -> dict | None:
    """Fetch a matching format_registry entry (fast path)."""
    cur.execute("SELECT match_headers, column_map, amount_pattern FROM format_registry")
    for entry in cur.fetchall():
        match_headers, column_map, amount_pattern = entry
        if frozenset(h.strip().lower() for h in match_headers) == header_key:
            return {"column_map": column_map, "amount_pattern": amount_pattern}
    return None


def _process_applicant_file(cur, csv_path: Path) -> tuple[int, int]:
    source_file = str(csv_path)
    if _already_ingested(cur, source_file):
        return 0, 0

    insert_sql = """
        INSERT INTO raw_applicants
        (raw_applicant_id, applicant_ref, name, pan_number, phone, city,
         monthly_income_declared, ingested_at)
        VALUES (%(raw_applicant_id)s::uuid, %(applicant_ref)s, %(name)s,
                %(pan_number)s, %(phone)s, %(city)s,
                %(monthly_income_declared)s, NOW())
        ON CONFLICT (applicant_ref) DO NOTHING
    """
    file_rows = 0
    failures = 0
    import csv as _csv

    with csv_path.open(newline="", encoding="utf-8") as handle:
        reader = _csv.DictReader(handle)
        for row in reader:
            try:
                cur.execute(insert_sql, row)
                file_rows += 1
            except Exception:
                failures += 1

    cur.execute(
        """
        INSERT INTO landing_ingest_log (log_id, source_file, record_type, rows_loaded)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (source_file) DO NOTHING
        """,
        (str(uuid.uuid4()), source_file, "applicants", file_rows),
    )
    return file_rows, failures


def _insert_transactions_and_upload(
    cur, ingest_result, applicant_id: str, fhash: str, file_name: str
) -> tuple[int, int]:
    insert_sql = """
        INSERT INTO raw_transactions
            (raw_id, raw_applicant_id, txn_date, amount, txn_type,
             description, balance_after, source_format,
             source_file_hash, ingested_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (raw_id) DO NOTHING
    """
    file_rows = 0
    failures = 0
    for row in (ingest_result.rows or []):
        try:
            cur.execute(
                insert_sql,
                (
                    str(row["raw_id"]),
                    applicant_id,
                    row["txn_date"],
                    float(row["amount"]),
                    row["txn_type"],
                    row.get("description", "—"),
                    float(row["balance_after"]) if row.get("balance_after") is not None else None,
                    row.get("source_format", "unknown"),
                    row.get("source_file_hash", fhash),
                ),
            )
            file_rows += 1
        except Exception:
            failures += 1

    # Record in statement_uploads
    rows_list = ingest_result.rows or []
    dates = [r["txn_date"] for r in rows_list if r.get("txn_date")]
    cur.execute(
        """
        INSERT INTO statement_uploads
            (upload_id, applicant_id, file_hash, file_name, source_format,
             row_count, reconciliation_verdict, reconciliation_match_rate,
             date_range_start, date_range_end, uploaded_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (applicant_id, file_hash) DO NOTHING
        """,
        (
            str(uuid.uuid4()),
            applicant_id,
            fhash,
            file_name,
            ingest_result.source_format,
            file_rows,
            ingest_result.verdict,
            ingest_result.match_rate,
            min(dates) if dates else None,
            max(dates) if dates else None,
        ),
    )

    if ingest_result.status == STATUS_RECONCILIATION_WARN:
        _insert_review_queue(cur, ingest_result, file_name, "reconciliation_warn")

    return file_rows, failures


def _process_transaction_file(cur, csv_path: Path) -> tuple[int, int]:
    source_file = str(csv_path)
    if _already_ingested(cur, source_file):
        return 0, 0

    raw_bytes = csv_path.read_bytes()
    fhash = compute_file_hash(raw_bytes)

    # Resolve applicant_id from filename convention:
    stem = csv_path.stem
    applicant_id = stem.split("_")[0] if "_" in stem else stem

    if _file_hash_already_seen(cur, applicant_id, fhash):
        cur.execute(
            """
            INSERT INTO landing_ingest_log (log_id, source_file, record_type, rows_loaded)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (source_file) DO NOTHING
            """,
            (str(uuid.uuid4()), source_file, "transactions_duplicate", 0),
        )
        return 0, 0

    def _registry_lookup(header_key):
        return _registry_lookup_sync(cur, header_key)

    ingest_result = ingest_statement(
        raw_bytes=raw_bytes,
        applicant_id=applicant_id,
        file_name=csv_path.name,
        file_hash_lookup=lambda aid, h: False,  # checked above
        registry_lookup=_registry_lookup,
    )

    file_rows = 0
    failures = 0

    if ingest_result.status in (STATUS_OK, STATUS_RECONCILIATION_WARN):
        file_rows, failures = _insert_transactions_and_upload(
            cur, ingest_result, applicant_id, fhash, csv_path.name
        )
    else:
        # Rejected — log to review queue so humans can resolve
        reason_map = {
            "low_confidence": "low_confidence",
            "reconciliation_failed": "reconciliation_fail",
            "not_a_bank_statement": "low_confidence",
        }
        reason = reason_map.get(ingest_result.status, "low_confidence")
        _insert_review_queue(cur, ingest_result, csv_path.name, reason)
        failures += 1

    cur.execute(
        """
        INSERT INTO landing_ingest_log (log_id, source_file, record_type, rows_loaded)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (source_file) DO NOTHING
        """,
        (str(uuid.uuid4()), source_file, "transactions", file_rows),
    )
    return file_rows, failures


def ingest_landing_files() -> None:
    started_at = datetime.now(UTC)
    rows_processed = 0
    failures = 0
    status = "success"

    try:
        with psycopg2.connect(db_dsn()) as conn:
            with conn.cursor() as cur:

                # ── Applicants (unchanged format) ─────────────────────────────
                if APPLICANTS_DIR.exists():
                    for csv_path in sorted(APPLICANTS_DIR.glob("*.csv")):
                        rows, file_fails = _process_applicant_file(cur, csv_path)
                        rows_processed += rows
                        failures += file_fails

                # ── Transactions (universal ingestion pipeline) ────────────────
                if TRANSACTIONS_DIR.exists():
                    for csv_path in sorted(TRANSACTIONS_DIR.glob("*.csv")):
                        rows, file_fails = _process_transaction_file(cur, csv_path)
                        rows_processed += rows
                        failures += file_fails

            conn.commit()
    except Exception:
        status = "failed"
        raise
    finally:
        write_pipeline_audit(
            dag_name="ingest_statements",
            rows_processed=rows_processed,
            failures=failures,
            started_at=started_at,
            status=status,
        )


def _insert_review_queue(cur, ingest_result, file_name: str, reason: str) -> None:
    sample = [
        {k: (str(v) if isinstance(v, Decimal) else v) for k, v in row.items()}
        for row in ingest_result.sample_rows
    ]
    cur.execute(
        """
        INSERT INTO format_review_queue
            (review_id, file_name, detected_headers, sample_rows, reason, created_at)
        VALUES (%s, %s, %s, %s, %s, NOW())
        """,
        (
            str(uuid.uuid4()),
            file_name,
            ingest_result.detected_headers,
            json.dumps(sample),
            reason,
        ),
    )


with DAG(
    dag_id="ingest_statements",
    description="Load new CSV rows from landing zone into raw layer (universal pipeline)",
    schedule="@hourly",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["loanlens", "ingest"],
) as dag:
    ingest_task = PythonOperator(
        task_id="ingest_landing_csv",
        python_callable=ingest_landing_files,
    )
    trigger_dbt = TriggerDagRunOperator(
        task_id="trigger_run_dbt_transforms",
        trigger_dag_id="run_dbt_transforms",
        wait_for_completion=False,
    )
    ingest_task >> trigger_dbt
