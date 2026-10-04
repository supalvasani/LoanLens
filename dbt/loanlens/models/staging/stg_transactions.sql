-- stg_transactions: type-cast and content-deduplicate raw_transactions.
-- The UUID is normally deterministic, but this also protects old rows created
-- before balance-less overlap deduplication was corrected in the parser.

with typed as (
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
),

ranked as (
    select
        typed.*,
        row_number() over (
            partition by
                raw_applicant_id,
                txn_date,
                amount,
                txn_type,
                lower(regexp_replace(coalesce(description, ''), '\\s+', ' ', 'g'))
            order by ingested_at, raw_id
        ) as duplicate_rank
    from typed
)

select
    raw_id,
    raw_applicant_id,
    txn_date,
    amount,
    txn_type,
    description,
    balance_after,
    source_format,
    source_file_hash,
    ingested_at
from ranked
where duplicate_rank = 1