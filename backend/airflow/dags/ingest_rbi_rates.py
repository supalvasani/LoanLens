"""Weekly refresh of RBI reference rates dimension."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import psycopg2
from airflow import DAG
from airflow.operators.python import PythonOperator

from loanlens_common import db_dsn, write_pipeline_audit

RBI_RATES = [
    ("repo_rate", 6.50),
    ("reverse_repo_rate", 3.35),
    ("bank_rate", 6.75),
    ("msf_rate", 6.75),
    ("standing_deposit_facility_rate", 3.35),
    ("base_rate_retail", 8.75),
    ("personal_loan_benchmark", 10.50),
    ("home_loan_benchmark", 8.65),
]


def refresh_rbi_rates() -> None:
    started_at = datetime.now(timezone.utc)
    rows_processed = 0
    failures = 0
    status = "success"
    effective_from = date.today()

    try:
        with psycopg2.connect(db_dsn()) as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE stg_rbi_rates SET effective_to = %s WHERE effective_to IS NULL", (effective_from,))
                for rate_type, rate_value in RBI_RATES:
                    cur.execute(
                        """
                        INSERT INTO stg_rbi_rates
                        (rate_id, rate_type, rate_value, effective_from, source, updated_at)
                        VALUES (%s, %s, %s, %s, 'RBI', NOW())
                        """,
                        (str(uuid.uuid4()), rate_type, rate_value, effective_from),
                    )
                    rows_processed += 1
            conn.commit()
    except Exception:
        status = "failed"
        raise
    finally:
        write_pipeline_audit(
            dag_name="ingest_rbi_rates",
            rows_processed=rows_processed,
            failures=failures,
            started_at=started_at,
            status=status,
        )


with DAG(
    dag_id="ingest_rbi_rates",
    description="Refresh RBI reference rates weekly",
    schedule="@weekly",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["loanlens", "ingest", "rbi"],
) as dag:
    PythonOperator(
        task_id="refresh_rbi_rates",
        python_callable=refresh_rbi_rates,
    )
