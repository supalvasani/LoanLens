
  create view "loanlens_db"."public_staging"."stg_rbi_rates__dbt_tmp"
    
    
  as (
    select
    rate_id,
    rate_type,
    rate_value::numeric(8, 4) as rate_value,
    effective_from,
    effective_to,
    source,
    updated_at
from "loanlens_db"."public"."stg_rbi_rates"
  );