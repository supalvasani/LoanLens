"""Run all dbt tests after transforms."""

from __future__ import annotations

import logging
import subprocess
from datetime import datetime, timezone

from airflow import DAG
from airflow.operators.python import PythonOperator

from loanlens_common import write_pipeline_audit

logger = logging.getLogger(__name__)
DBT_PROJECT_DIR = "/opt/airflow/dbt/loanlens"


def run_dbt_tests() -> None:
    started_at = datetime.now(timezone.utc)
    rows_processed = 0
    failures = 0
    status = "success"

    try:
        result = subprocess.run(
            [
                "dbt",
                "test",
                "--project-dir",
                DBT_PROJECT_DIR,
                "--profiles-dir",
                DBT_PROJECT_DIR,
                "--target",
                "dev",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        rows_processed = result.stdout.lower().count("pass")
        failures = result.stdout.lower().count("fail") + result.stdout.lower().count("error")
        if result.returncode != 0:
            status = "failed"
            logger.warning(
                "dbt test failures detected: failures=%s stdout=%s stderr=%s",
                failures,
                result.stdout[-4000:],
                result.stderr[-4000:],
            )
            raise RuntimeError(result.stderr or result.stdout)
    except Exception:
        status = "failed"
        raise
    finally:
        write_pipeline_audit(
            dag_name="data_quality_check",
            rows_processed=rows_processed,
            failures=failures,
            started_at=started_at,
            status=status,
        )


with DAG(
    dag_id="data_quality_check",
    description="Run dbt data quality tests",
    schedule=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["loanlens", "dbt", "quality"],
) as dag:
    PythonOperator(
        task_id="run_dbt_tests",
        python_callable=run_dbt_tests,
    )
