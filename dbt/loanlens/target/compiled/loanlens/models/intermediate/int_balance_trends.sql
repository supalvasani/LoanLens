with monthly_balance as (
    select
        applicant_id,
        date_trunc('month', txn_date)::date as month,
        max(balance_after) as max_balance,
        min(balance_after) as min_balance,
        avg(balance_after) as avg_balance
    from "loanlens_db"."public_staging"."stg_transactions"
    group by 1, 2
),

recent as (
    select *
    from monthly_balance
    where month >= date_trunc('month', current_date - interval '6 months')::date
),

stats as (
    select
        applicant_id,
        avg(avg_balance) as avg_monthly_balance,
        avg(max_balance - min_balance) as avg_balance_swing,
        count(*) as months_tracked
    from recent
    group by 1
)

select
    a.raw_applicant_id as applicant_id,
    coalesce(s.avg_monthly_balance, 0) as avg_monthly_balance,
    coalesce(s.avg_balance_swing, 0) as avg_balance_swing,
    coalesce(s.months_tracked, 0) as months_tracked,
    case
        when coalesce(s.avg_monthly_balance, 0) <= 0 then 20
        when coalesce(s.avg_balance_swing, 0) / nullif(s.avg_monthly_balance, 0) > 0.8 then 40
        when coalesce(s.avg_balance_swing, 0) / nullif(s.avg_monthly_balance, 0) > 0.4 then 65
        else 90
    end as balance_score
from "loanlens_db"."public_staging"."stg_applicants" a
left join stats s on a.raw_applicant_id = s.applicant_id