"""Hourly ingest from CSV landing zone into raw layer tables."""

from __future__ import annotations

import csv
import uuid
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.trigger_dagrun import TriggerDagRunOperator

from loanlens_common import db_dsn, write_pipeline_audit

LANDING_ROOT = Path("/opt/airflow/data/landing")
APPLICANTS_DIR = LANDING_ROOT / "applicants"
TRANSACTIONS_DIR = LANDING_ROOT / "transactions"


def _already_ingested(cur, source_file: str) -> bool:
    cur.execute("SELECT 1 FROM landing_ingest_log WHERE source_file = %s", (source_file,))
    return cur.fetchone() is not None


def ingest_landing_files() -> None:
    started_at = datetime.now(timezone.utc)
    rows_processed = 0
    failures = 0
    status = "success"

    try:
        with psycopg2.connect(db_dsn()) as conn:
            with conn.cursor() as cur:
                for directory, record_type, insert_sql in (
                    (
                        APPLICANTS_DIR,
                        "applicants",
                        """
                        INSERT INTO raw_applicants
                        (raw_applicant_id, applicant_ref, name, pan_number, phone, city,
                         monthly_income_declared, ingested_at)
                        VALUES (%(raw_applicant_id)s::uuid, %(applicant_ref)s, %(name)s, %(pan_number)s,
                                %(phone)s, %(city)s, %(monthly_income_declared)s, NOW())
                        ON CONFLICT (applicant_ref) DO NOTHING
                        """,
                    ),
                    (
                        TRANSACTIONS_DIR,
                        "transactions",
                        """
                        INSERT INTO raw_transactions
                        (raw_id, applicant_id, txn_date, amount, txn_type, description, balance_after, ingested_at)
                        VALUES (%(raw_id)s::uuid, %(applicant_id)s::uuid, %(txn_date)s, %(amount)s,
                                %(txn_type)s, %(description)s, %(balance_after)s, NOW())
                        ON CONFLICT (raw_id) DO NOTHING
                        """,
                    ),
                ):
                    if not directory.exists():
                        continue
                    for csv_path in sorted(directory.glob("*.csv")):
                        source_file = str(csv_path)
                        if _already_ingested(cur, source_file):
                            continue
                        file_rows = 0
                        with csv_path.open(newline="", encoding="utf-8") as handle:
                            reader = csv.DictReader(handle)
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
                            (str(uuid.uuid4()), source_file, record_type, file_rows),
                        )
                        rows_processed += file_rows
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


with DAG(
    dag_id="ingest_statements",
    description="Load new CSV rows from landing zone into raw layer",
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
