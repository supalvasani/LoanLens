-- stg_transactions: pure type-cast pass over raw_transactions.
-- Zero bank-specific or format-specific logic lives here.
-- All normalisation happened upstream in the ingestion pipeline.
select
    raw_id::uuid                        as raw_id,
    raw_applicant_id::uuid              as raw_applicant_id,
    txn_date::date                      as txn_date,
    amount::numeric(15, 2)              as amount,
    txn_type::varchar(10)               as txn_type,
    trim(description)                   as description,
    balance_after::numeric(15, 2)       as balance_after,
    source_format                       as source_format,
    source_file_hash                    as source_file_hash,
    ingested_at
from {{ source('raw', 'raw_transactions') }}
where txn_date <= current_date
