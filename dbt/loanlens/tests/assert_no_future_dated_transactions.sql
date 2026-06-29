select raw_id, txn_date
from {{ ref('stg_transactions') }}
where txn_date > current_date
