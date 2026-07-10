with constants as (
    select
        0::numeric as val_zero,
        50::numeric as val_fifty,
        100::numeric as val_hundred
),
step1 as (
    select
        a.raw_applicant_id as applicant_id,
        a.applicant_ref,
        a.name,
        a.monthly_income_declared,
        coalesce(i.avg_monthly_income, a.monthly_income_declared) as detected_monthly_income,
        coalesce(i.income_stability_score, c.val_fifty) as income_stability_score
    from {{ ref('stg_applicants') }} a
    cross join constants c
    left join {{ ref('int_monthly_income_summary') }} i on a.raw_applicant_id = i.applicant_id
),
step2 as (
    select
        s1.*,
        coalesce(o.emi_burden_ratio, c.val_zero) as emi_burden_ratio,
        coalesce(o.emi_burden_score, c.val_hundred) as emi_burden_score,
        coalesce(o.avg_monthly_emi, c.val_zero) as avg_monthly_emi
    from step1 s1
    cross join constants c
    left join {{ ref('int_monthly_obligation_summary') }} o on s1.applicant_id = o.applicant_id
),
step3 as (
    select
        s2.*,
        coalesce(b.bounce_count, c.val_zero) as bounce_count,
        coalesce(b.bounce_rate, c.val_zero) as bounce_rate,
        coalesce(b.bounce_score, c.val_hundred) as bounce_score
    from step2 s2
    cross join constants c
    left join {{ ref('int_bounce_history') }} b on s2.applicant_id = b.applicant_id
),
step4 as (
    select
        s3.*,
        coalesce(bt.balance_score, c.val_fifty) as balance_score
    from step3 s3
    cross join constants c
    left join {{ ref('int_balance_trends') }} bt on s3.applicant_id = bt.applicant_id
),
spend_agg as (
    select applicant_id,
           sum(discretionary_spend) as discretionary_spend,
           sum(essential_spend) as essential_spend
    from {{ ref('int_spending_by_category') }}
    group by 1
)
select
    s4.applicant_id,
    s4.applicant_ref,
    s4.name,
    s4.monthly_income_declared,
    s4.detected_monthly_income,
    s4.income_stability_score,
    s4.emi_burden_ratio,
    s4.emi_burden_score,
    s4.bounce_count,
    s4.bounce_rate,
    s4.bounce_score,
    s4.balance_score,
    coalesce(sp.discretionary_spend, c.val_zero) as discretionary_spend,
    coalesce(sp.essential_spend, c.val_zero) as essential_spend,
    greatest(c.val_zero,
        s4.detected_monthly_income
        - s4.avg_monthly_emi
        - coalesce(sp.discretionary_spend, c.val_zero) / 6
    ) as savings_potential
from step4 s4
cross join constants c
left join spend_agg sp on s4.applicant_id = sp.applicant_id
