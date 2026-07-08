with

-- Derive a keyword-based category hint from description.
-- Previously lived in stg_transactions; moved here so staging stays a
-- pure type-cast pass and the classification logic is co-located with
-- the merchant-category enrichment that supersedes it.
hint as (
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
        ingested_at,
        case
            when lower(description) like '%salary%' then 'salary'
            when lower(description) like '%emi%'    then 'emi'
            when lower(description) like '%upi%'    then 'upi'
            when lower(description) like '%atm%'    then 'cash'
            when lower(description) like '%ecs return%' then 'bounce'
            else 'other'
        end as txn_category_hint
    from {{ ref('stg_transactions') }}
),

categorized as (
    select
        t.raw_id,
        t.raw_applicant_id,
        t.txn_date,
        t.amount,
        t.txn_type,
        t.description,
        t.balance_after,
        t.ingested_at,
        t.txn_category_hint,
        coalesce(
            (
                select mc.category
                from {{ ref('stg_merchant_categories') }} mc
                where lower(t.description) like '%' || lower(mc.keyword) || '%'
                order by length(mc.keyword) desc
                limit 1
            ),
            t.txn_category_hint,
            'other'
        ) as category,
        coalesce(
            (
                select mc.is_essential
                from {{ ref('stg_merchant_categories') }} mc
                where lower(t.description) like '%' || lower(mc.keyword) || '%'
                order by length(mc.keyword) desc
                limit 1
            ),
            false
        ) as is_essential
    from hint t
)

select
    raw_id,
    raw_applicant_id as applicant_id,
    txn_date,
    amount,
    txn_type,
    description,
    balance_after,
    ingested_at,
    txn_category_hint,
    category,
    is_essential
from categorized
