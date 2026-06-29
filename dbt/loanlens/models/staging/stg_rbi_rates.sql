select
    rate_id,
    rate_type,
    rate_value::numeric(8, 4) as rate_value,
    effective_from,
    effective_to,
    source,
    updated_at
from {{ source('raw', 'stg_rbi_rates') }}
