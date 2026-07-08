select raw_id, txn_date
from "loanlens_db"."public_staging"."stg_transactions"
where txn_date > current_date