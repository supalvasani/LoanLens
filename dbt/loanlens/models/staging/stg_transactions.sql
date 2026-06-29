select
    raw_id,
    applicant_id,
    txn_date,
    amount::numeric(14, 2) as amount,
    txn_type,
    trim(description) as description,
    balance_after::numeric(14, 2) as balance_after,
    ingested_at,
    case
        when lower(description) like '%salary%' then 'salary'
        when lower(description) like '%emi%' then 'emi'
        when lower(description) like '%upi%' then 'upi'
        when lower(description) like '%atm%' then 'cash'
        when lower(description) like '%ecs return%' then 'bounce'
        else 'other'
    end as txn_category_hint
from {{ source('raw', 'raw_transactions') }}
where txn_date <= current_date
