with emi_txns as (
    select
        applicant_id,
        date_trunc('month', txn_date)::date as month,
        sum(amount) as monthly_emi
    from {{ ref('int_transactions_categorized') }}
    where txn_type = 'debit'
      and category in ('emi', 'loan_obligation')
    group by 1, 2
),

income as (
    select applicant_id, avg_monthly_income
    from {{ ref('int_monthly_income_summary') }}
),

aggregated as (
    select
        e.applicant_id,
        avg(e.monthly_emi) as avg_monthly_emi,
        count(distinct e.month) as emi_active_months
    from emi_txns e
    group by 1
),

all_applicants as (
    select applicant_id, avg_monthly_income
    from income
)

select
    a.applicant_id,
    coalesce(agg.avg_monthly_emi, 0) as avg_monthly_emi,
    coalesce(agg.emi_active_months, 0) as active_loan_months,
    case
        when coalesce(a.avg_monthly_income, 0) = 0 then 1.0
        else coalesce(agg.avg_monthly_emi, 0) / a.avg_monthly_income
    end as emi_burden_ratio,
    case
        when coalesce(a.avg_monthly_income, 0) = 0 then 0
        else greatest(
            0,
            least(
                100,
                100 - (coalesce(agg.avg_monthly_emi, 0) / a.avg_monthly_income * 200)
            )
        )
    end as emi_burden_score
from all_applicants a
left join aggregated agg on a.applicant_id = agg.applicant_id
