"""Nightly refresh of all mart models and credit scores."""

from __future__ import annotations

import subprocess
from datetime import UTC, datetime

from airflow.operators.python import PythonOperator
from loanlens_common import write_pipeline_audit

from airflow import DAG

DBT_PROJECT_DIR = "/opt/airflow/dbt/loanlens"


def run_all_marts() -> None:
    started_at = datetime.now(UTC)
    rows_processed = 0
    failures = 0
    status = "success"
    try:
        seed_result = subprocess.run(
            [
                "dbt", "seed",
                "--project-dir", DBT_PROJECT_DIR,
                "--profiles-dir", DBT_PROJECT_DIR,
                "--target", "dev",
            ],
            capture_output=True, text=True, check=False,
        )
        if seed_result.returncode != 0:
            failures = 1
            status = "failed"
            raise RuntimeError(seed_result.stderr or seed_result.stdout)

        result = subprocess.run(
            [
                "dbt", "run",
                "--project-dir", DBT_PROJECT_DIR,
                "--profiles-dir", DBT_PROJECT_DIR,
                "--target", "dev",
                "--select", "path:models/intermediate", "path:models/marts",
            ],
            capture_output=True, text=True, check=False,
        )
        if result.returncode != 0:
            failures = 1
            status = "failed"
            raise RuntimeError(result.stderr or result.stdout)
        rows_processed = result.stdout.lower().count("ok ")
    except Exception:
        status = "failed"
        raise
    finally:
        write_pipeline_audit(
            dag_name="generate_reports",
            rows_processed=rows_processed,
            failures=failures,
            started_at=started_at,
            status=status,
        )


with DAG(
    dag_id="generate_reports",
    description="Nightly refresh of mart models and credit scores",
    schedule="@daily",
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["loanlens", "dbt", "marts"],
) as dag:
    PythonOperator(task_id="run_all_mart_models", python_callable=run_all_marts)
