select
    rate_id,
    rate_type,
    rate_value::numeric(8, 4) as rate_value,
    effective_from,
    effective_to,
    source,
    updated_at
from "loanlens_db"."public"."stg_rbi_rates"