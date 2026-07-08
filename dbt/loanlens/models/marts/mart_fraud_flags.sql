with avg_credits as (
    select
        raw_applicant_id as applicant_id,
        avg(amount) as avg_credit
    from {{ ref('stg_transactions') }}
    where txn_type = 'credit'
    group by 1
),

avg_cash as (
    select
        applicant_id,
        avg(amount) as avg_cash_withdrawal
    from {{ ref('int_transactions_categorized') }}
    where txn_type = 'debit'
      and category = 'cash'
    group by 1
),

flags as (
    -- sudden large deposits (3x average credit)
    select
        t.raw_applicant_id as applicant_id,
        'sudden_large_deposit' as flag_type,
        'Credit of ' || t.amount || ' exceeds 3x average credit of ' || round(ac.avg_credit, 2) as flag_detail,
        case
            when t.amount > ac.avg_credit * 5 then 'high'
            when t.amount > ac.avg_credit * 3 then 'med'
            else 'low'
        end as severity,
        t.txn_date as detected_at
    from {{ ref('stg_transactions') }} t
    join avg_credits ac on t.raw_applicant_id = ac.applicant_id
    where t.txn_type = 'credit'
      and ac.avg_credit > 0
      and t.amount > ac.avg_credit * 3

    union all

    -- bounce / insufficient funds
    select
        b.applicant_id,
        'bounce_event' as flag_type,
        'Bounce count: ' || b.bounce_count as flag_detail,
        case
            when b.bounce_count > 5 then 'high'
            when b.bounce_count > 2 then 'med'
            else 'low'
        end as severity,
        coalesce(b.last_bounce_date, current_date) as detected_at
    from {{ ref('int_bounce_history') }} b
    where b.bounce_count > 0

    union all

    -- high frequency small debits
    select
        raw_applicant_id as applicant_id,
        'high_frequency_small_txns' as flag_type,
        'More than 50 small debits under INR 500 detected' as flag_detail,
        'med' as severity,
        max(txn_date) as detected_at
    from {{ ref('stg_transactions') }}
    where txn_type = 'debit'
      and amount < 500
    group by raw_applicant_id
    having count(*) > 50

    union all

    -- circular transfers: matching credit/debit pairs within 3 days
    select
        c.raw_applicant_id as applicant_id,
        'circular_transfer' as flag_type,
        'Matching credit/debit of ' || c.amount || ' within 3 days' as flag_detail,
        case
            when c.amount > 50000 then 'high'
            when c.amount > 10000 then 'med'
            else 'low'
        end as severity,
        c.txn_date as detected_at
    from {{ ref('stg_transactions') }} c
    join {{ ref('stg_transactions') }} d
        on c.raw_applicant_id = d.raw_applicant_id
       and c.txn_type = 'credit'
       and d.txn_type = 'debit'
       and c.amount = d.amount
       and d.txn_date between c.txn_date and c.txn_date + interval '3 days'
    where lower(c.description) like '%transfer%'
       or lower(d.description) like '%transfer%'
       or lower(c.description) like '%neft%'
       or lower(d.description) like '%neft%'

    union all

    -- unusual cash spikes (ATM withdrawals > 3x average cash withdrawal)
    select
        t.applicant_id,
        'unusual_cash_spike' as flag_type,
        'Cash withdrawal of ' || t.amount || ' exceeds 3x average cash withdrawal' as flag_detail,
        case
            when t.amount > ac.avg_cash_withdrawal * 5 then 'high'
            when t.amount > ac.avg_cash_withdrawal * 3 then 'med'
            else 'low'
        end as severity,
        t.txn_date as detected_at
    from {{ ref('int_transactions_categorized') }} t
    join avg_cash ac on t.applicant_id = ac.applicant_id
    where t.txn_type = 'debit'
      and t.category = 'cash'
      and ac.avg_cash_withdrawal > 0
      and t.amount > ac.avg_cash_withdrawal * 3
)

select distinct on (applicant_id, flag_type)
    applicant_id,
    flag_type,
    flag_detail,
    severity,
    detected_at
from flags
order by applicant_id, flag_type, detected_at desc
