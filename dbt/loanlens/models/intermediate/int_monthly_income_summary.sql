with salary_txns as (
    select
        applicant_id,
        date_trunc('month', txn_date)::date as month,
        sum(amount) as monthly_income
    from {{ ref('int_transactions_categorized') }}
    where txn_type = 'credit'
      and category in ('income', 'salary')
    group by 1, 2
),

stats as (
    select
        applicant_id,
        avg(monthly_income) as avg_monthly_income,
        stddev_pop(monthly_income) as income_stddev,
        count(*) as salary_months
    from salary_txns
    group by 1
)

select
    a.raw_applicant_id as applicant_id,
    coalesce(s.avg_monthly_income, a.monthly_income_declared) as avg_monthly_income,
    coalesce(s.income_stddev, 0) as income_stddev,
    coalesce(s.salary_months, 0) as salary_months,
    case
        when coalesce(s.avg_monthly_income, a.monthly_income_declared, 0) = 0 then 0
        when coalesce(s.salary_months, 0) < 2 then 40
        else greatest(
            0,
            least(
                100,
                100 - (coalesce(s.income_stddev, 0) / s.avg_monthly_income * 100)
            )
        )
    end as income_stability_score
from {{ ref('stg_applicants') }} a
left join stats s on a.raw_applicant_id = s.applicant_id
