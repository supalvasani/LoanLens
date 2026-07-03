with monthly_income as (
    select
        applicant_id,
        date_trunc('month', txn_date)::date as month,
        sum(case when txn_type = 'credit' and category in ('income', 'salary') then amount else 0 end) as income
    from "loanlens_db"."public_intermediate"."int_transactions_categorized"
    where txn_date >= date_trunc('month', current_date - interval '6 months')::date
    group by 1, 2
),

monthly_emi as (
    select
        applicant_id,
        date_trunc('month', txn_date)::date as month,
        sum(case when txn_type = 'debit' and category in ('emi', 'loan_obligation') then amount else 0 end) as emi
    from "loanlens_db"."public_intermediate"."int_transactions_categorized"
    where txn_date >= date_trunc('month', current_date - interval '6 months')::date
    group by 1, 2
),

monthly_bounces as (
    select
        applicant_id,
        date_trunc('month', txn_date)::date as month,
        count(*) filter (where category = 'bounce') as bounce_count
    from "loanlens_db"."public_intermediate"."int_transactions_categorized"
    where txn_date >= date_trunc('month', current_date - interval '6 months')::date
    group by 1, 2
),

monthly_balance as (
    select
        applicant_id,
        date_trunc('month', txn_date)::date as month,
        avg(balance_after) as avg_balance,
        max(balance_after) - min(balance_after) as balance_swing
    from "loanlens_db"."public_staging"."stg_transactions"
    where txn_date >= date_trunc('month', current_date - interval '6 months')::date
    group by 1, 2
),

months as (
    select applicant_id, month from monthly_income
    union
    select applicant_id, month from monthly_balance
),

base_income as (
    select applicant_id, income_stability_score
    from "loanlens_db"."public_intermediate"."int_monthly_income_summary"
),

components as (
    select
        m.applicant_id,
        m.month,
        coalesce(bi.income_stability_score, 50) as income_stability_score,
        case
            when coalesce(mi.income, 0) = 0 then 50
            else greatest(0, least(100, 100 - (coalesce(me.emi, 0) / mi.income * 200)))
        end as emi_burden_score,
        case
            when coalesce(mb.bounce_count, 0) = 0 then 100
            when mb.bounce_count <= 1 then 70
            when mb.bounce_count <= 3 then 40
            else 10
        end as bounce_score,
        case
            when coalesce(mbal.avg_balance, 0) <= 0 then 20
            when mbal.balance_swing / nullif(mbal.avg_balance, 0) > 0.8 then 40
            when mbal.balance_swing / nullif(mbal.avg_balance, 0) > 0.4 then 65
            else 90
        end as balance_score
    from months m
    left join base_income bi on m.applicant_id = bi.applicant_id
    left join monthly_income mi on m.applicant_id = mi.applicant_id and m.month = mi.month
    left join monthly_emi me on m.applicant_id = me.applicant_id and m.month = me.month
    left join monthly_bounces mb on m.applicant_id = mb.applicant_id and m.month = mb.month
    left join monthly_balance mbal on m.applicant_id = mbal.applicant_id and m.month = mbal.month
),

scored as (
    select
        applicant_id,
        month,
        greatest(
            0,
            least(
                100,
                round(
                    income_stability_score * 0.30
                    + emi_burden_score * 0.25
                    + bounce_score * 0.25
                    + balance_score * 0.20,
                    2
                )
            )
        ) as score
    from components
)

select
    applicant_id,
    month,
    score,
    case
        when lag(score) over (partition by applicant_id order by month) is null then 'flat'
        when score > lag(score) over (partition by applicant_id order by month) then 'up'
        when score < lag(score) over (partition by applicant_id order by month) then 'down'
        else 'flat'
    end as trend_direction
from scored