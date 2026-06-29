"""Run dbt staging models after statement ingest completes."""

from __future__ import annotations

import subprocess
from datetime import datetime, timezone

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.trigger_dagrun import TriggerDagRunOperator

from loanlens_common import write_pipeline_audit

DBT_PROJECT_DIR = "/opt/airflow/dbt/loanlens"


def run_dbt_staging() -> None:
    started_at = datetime.now(timezone.utc)
    rows_processed = 0
    failures = 0
    status = "success"

    try:
        result = subprocess.run(
            [
                "dbt",
                "run",
                "--project-dir",
                DBT_PROJECT_DIR,
                "--profiles-dir",
                DBT_PROJECT_DIR,
                "--target",
                "dev",
                "--select",
                "path:models/staging",
                "path:models/intermediate",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            failures = 1
            status = "failed"
            raise RuntimeError(result.stderr or result.stdout)
        rows_processed = result.stdout.lower().count("ok created") + result.stdout.lower().count("ok view")
    except Exception:
        status = "failed"
        raise
    finally:
        write_pipeline_audit(
            dag_name="run_dbt_transforms",
            rows_processed=rows_processed,
            failures=failures,
            started_at=started_at,
            status=status,
        )


with DAG(
    dag_id="run_dbt_transforms",
    description="Run dbt staging layer incrementally",
    schedule=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["loanlens", "dbt"],
) as dag:
    run_staging = PythonOperator(
        task_id="run_dbt_staging_models",
        python_callable=run_dbt_staging,
    )
    trigger_quality = TriggerDagRunOperator(
        task_id="trigger_data_quality_check",
        trigger_dag_id="data_quality_check",
        wait_for_completion=False,
    )
    run_staging >> trigger_quality
