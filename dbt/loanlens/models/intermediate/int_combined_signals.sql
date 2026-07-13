with constants as (
    select
        0::numeric as val_zero,
        50::numeric as val_fifty,
        100::numeric as val_hundred
),
income_and_obligations as (
    select
        a.raw_applicant_id as applicant_id,
        a.applicant_ref,
        a.name,
        a.monthly_income_declared,
        coalesce(i.avg_monthly_income, a.monthly_income_declared) as detected_monthly_income,
        coalesce(i.income_stability_score, c.val_fifty) as income_stability_score,
        coalesce(o.emi_burden_ratio, c.val_zero) as emi_burden_ratio,
        coalesce(o.emi_burden_score, c.val_hundred) as emi_burden_score,
        coalesce(o.avg_monthly_emi, c.val_zero) as avg_monthly_emi
    from {{ ref('stg_applicants') }} a
    cross join constants c
    left join {{ ref('int_monthly_income_summary') }} i on a.raw_applicant_id = i.applicant_id
    left join {{ ref('int_monthly_obligation_summary') }} o on a.raw_applicant_id = o.applicant_id
),
bounces_and_trends as (
    select
        coalesce(b.applicant_id, bt.applicant_id) as applicant_id,
        coalesce(b.bounce_count, c.val_zero) as bounce_count,
        coalesce(b.bounce_rate, c.val_zero) as bounce_rate,
        coalesce(b.bounce_score, c.val_hundred) as bounce_score,
        coalesce(bt.balance_score, c.val_fifty) as balance_score
    from {{ ref('int_bounce_history') }} b
    cross join constants c
    full outer join {{ ref('int_balance_trends') }} bt on b.applicant_id = bt.applicant_id
),
spend_agg as (
    select
        applicant_id,
        sum(discretionary_spend) as discretionary_spend,
        sum(essential_spend) as essential_spend
    from {{ ref('int_spending_by_category') }}
    group by 1
)
select
    io.applicant_id,
    io.applicant_ref,
    io.name,
    io.monthly_income_declared,
    io.detected_monthly_income,
    io.income_stability_score,
    io.emi_burden_ratio,
    io.emi_burden_score,
    coalesce(bt.bounce_count, c.val_zero) as bounce_count,
    coalesce(bt.bounce_rate, c.val_zero) as bounce_rate,
    coalesce(bt.bounce_score, c.val_hundred) as bounce_score,
    coalesce(bt.balance_score, c.val_fifty) as balance_score,
    coalesce(sp.discretionary_spend, c.val_zero) as discretionary_spend,
    coalesce(sp.essential_spend, c.val_zero) as essential_spend,
    greatest(c.val_zero,
        io.detected_monthly_income
        - io.avg_monthly_emi
        - coalesce(sp.discretionary_spend, c.val_zero) / 6
    ) as savings_potential
from income_and_obligations io
cross join constants c
left join bounces_and_trends bt on io.applicant_id = bt.applicant_id
left join spend_agg sp on io.applicant_id = sp.applicant_id
