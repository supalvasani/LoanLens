"""Shared helpers for LoanLens Airflow DAGs."""

from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime

import psycopg2


def db_dsn() -> str:
    return (
        "postgresql://postgres:admin@postgres:5432/loanlens_db"
        if os.getenv("AIRFLOW__CORE__EXECUTOR")
        else os.getenv(
            "DB_URL_SYNC",
            "postgresql://postgres:admin@127.0.0.1:5432/loanlens_db",
        )
    )


def write_pipeline_audit(
    *,
    dag_name: str,
    rows_processed: int,
    failures: int,
    started_at: datetime,
    status: str,
) -> None:
    ended_at = datetime.now(UTC)
    with psycopg2.connect(db_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO mart_pipeline_audit
                (run_id, dag_name, rows_processed, failures, started_at, ended_at, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (str(uuid.uuid4()), dag_name, rows_processed, failures, started_at, ended_at, status),
            )
        conn.commit()
