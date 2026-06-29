with bounces as (
    select
        applicant_id,
        txn_date,
        amount
    from {{ ref('int_transactions_categorized') }}
    where category = 'bounce'
       or lower(description) like '%ecs return%'
       or lower(description) like '%insufficient%'
),

stats as (
    select
        b.applicant_id,
        count(*) as bounce_count,
        max(b.txn_date) as last_bounce_date
    from bounces b
    group by 1
),

txn_counts as (
    select applicant_id, count(*) as total_debits
    from {{ ref('int_transactions_categorized') }}
    where txn_type = 'debit'
    group by 1
)

select
    a.raw_applicant_id as applicant_id,
    coalesce(s.bounce_count, 0) as bounce_count,
    case
        when coalesce(t.total_debits, 0) = 0 then 0
        else coalesce(s.bounce_count, 0)::numeric / t.total_debits
    end as bounce_rate,
    s.last_bounce_date,
    case
        when coalesce(s.bounce_count, 0) = 0 then 100
        when coalesce(s.bounce_count, 0) <= 2 then 70
        when coalesce(s.bounce_count, 0) <= 5 then 40
        else 10
    end as bounce_score
from {{ ref('stg_applicants') }} a
left join stats s on a.raw_applicant_id = s.applicant_id
left join txn_counts t on a.raw_applicant_id = t.applicant_id
