
  
    

  create  table "loanlens_db"."public_marts"."decisions__dbt_tmp"
  
  
    as
  
  (
    select
    decision_id,
    application_id,
    decided_by,
    decision,
    notes,
    escalated_to,
    decided_at
from "loanlens_db"."public"."decisions"
  );
  