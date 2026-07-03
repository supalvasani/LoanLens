select
    run_id,
    dag_name,
    rows_processed,
    failures,
    started_at,
    ended_at,
    status
from "loanlens_db"."public"."mart_pipeline_audit"