
  
    

  create  table "loanlens_db"."public_marts"."mart_fraud_flags__dbt_tmp"
  
  
    as
  
  (
    with constants as (
    select
        'credit' as c_credit,
        'debit' as c_debit,
        'cash' as c_cash,
        'low' as c_low,
        'med' as c_med,
        'high' as c_high
),

avg_credits as (
    select
        raw_applicant_id as applicant_id,
        avg(amount) as avg_credit
    from "loanlens_db"."public_staging"."stg_transactions"
    cross join constants c
    where txn_type = c.c_credit
    group by 1
),

avg_cash as (
    select
        t.applicant_id,
        avg(t.amount) as avg_cash_withdrawal
    from "loanlens_db"."public_intermediate"."int_transactions_categorized" t
    cross join constants c
    where t.txn_type = c.c_debit
      and t.category = c.c_cash
    group by 1
),

flags as (
    -- sudden large deposits (3x average credit)
    select
        t.raw_applicant_id as applicant_id,
        'sudden_large_deposit' as flag_type,
        'Credit of ' || t.amount || ' exceeds 3x average credit of ' || round(ac.avg_credit, 2) as flag_detail,
        case
            when t.amount > ac.avg_credit * 5 then c.c_high
            when t.amount > ac.avg_credit * 3 then c.c_med
            else c.c_low
        end as severity,
        t.txn_date as detected_at
    from "loanlens_db"."public_staging"."stg_transactions" t
    join avg_credits ac on t.raw_applicant_id = ac.applicant_id
    cross join constants c
    where t.txn_type = c.c_credit
      and ac.avg_credit > 0
      and t.amount > ac.avg_credit * 3

    union all

    -- bounce / insufficient funds
    select
        b.applicant_id,
        'bounce_event' as flag_type,
        'Bounce count: ' || b.bounce_count as flag_detail,
        case
            when b.bounce_count > 5 then c.c_high
            when b.bounce_count > 2 then c.c_med
            else c.c_low
        end as severity,
        coalesce(b.last_bounce_date, current_date) as detected_at
    from "loanlens_db"."public_intermediate"."int_bounce_history" b
    cross join constants c
    where b.bounce_count > 0

    union all

    -- high frequency small debits
    select
        raw_applicant_id as applicant_id,
        'high_frequency_small_txns' as flag_type,
        'More than 50 small debits under INR 500 detected' as flag_detail,
        c.c_med as severity,
        max(txn_date) as detected_at
    from "loanlens_db"."public_staging"."stg_transactions"
    cross join constants c
    where txn_type = c.c_debit
      and amount < 500
    group by raw_applicant_id, c.c_med
    having count(*) > 50

    union all

    -- circular transfers: matching credit/debit pairs within 3 days
    select
        c_txn.raw_applicant_id as applicant_id,
        'circular_transfer' as flag_type,
        'Matching credit/debit of ' || c_txn.amount || ' within 3 days' as flag_detail,
        case
            when c_txn.amount > 50000 then c.c_high
            when c_txn.amount > 10000 then c.c_med
            else c.c_low
        end as severity,
        c_txn.txn_date as detected_at
    from "loanlens_db"."public_staging"."stg_transactions" c_txn
    join "loanlens_db"."public_staging"."stg_transactions" d
        on c_txn.raw_applicant_id = d.raw_applicant_id
       and c_txn.txn_type = c.c_credit
       and d.txn_type = c.c_debit
       and c_txn.amount = d.amount
       and d.txn_date between c_txn.txn_date and c_txn.txn_date + interval '3 days'
    cross join constants c
    where lower(c_txn.description) like '%transfer%'
       or lower(d.description) like '%transfer%'
       or lower(c_txn.description) like '%neft%'
       or lower(d.description) like '%neft%'

    union all

    -- unusual cash spikes (ATM withdrawals > 3x average cash withdrawal)
    select
        t.applicant_id,
        'unusual_cash_spike' as flag_type,
        'Cash withdrawal of ' || t.amount || ' exceeds 3x average cash withdrawal' as flag_detail,
        case
            when t.amount > ac.avg_cash_withdrawal * 5 then c.c_high
            when t.amount > ac.avg_cash_withdrawal * 3 then c.c_med
            else c.c_low
        end as severity,
        t.txn_date as detected_at
    from "loanlens_db"."public_intermediate"."int_transactions_categorized" t
    join avg_cash ac on t.applicant_id = ac.applicant_id
    cross join constants c
    where t.txn_type = c.c_debit
      and t.category = c.c_cash
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
  );
  