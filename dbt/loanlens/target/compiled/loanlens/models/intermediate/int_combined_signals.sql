select
    a.raw_applicant_id as applicant_id,
    a.applicant_ref,
    a.name,
    a.monthly_income_declared,
    coalesce(i.avg_monthly_income, a.monthly_income_declared) as detected_monthly_income,
    coalesce(i.income_stability_score, 50) as income_stability_score,
    coalesce(o.emi_burden_ratio, 0) as emi_burden_ratio,
    coalesce(o.emi_burden_score, 100) as emi_burden_score,
    coalesce(b.bounce_count, 0) as bounce_count,
    coalesce(b.bounce_rate, 0) as bounce_rate,
    coalesce(b.bounce_score, 100) as bounce_score,
    coalesce(bt.balance_score, 50) as balance_score,
    coalesce(sp.discretionary_spend, 0) as discretionary_spend,
    coalesce(sp.essential_spend, 0) as essential_spend,
    greatest(0,
        coalesce(i.avg_monthly_income, a.monthly_income_declared)
        - coalesce(o.avg_monthly_emi, 0)
        - coalesce(sp.discretionary_spend, 0) / 6
    ) as savings_potential
from "loanlens_db"."public_staging"."stg_applicants" a
left join "loanlens_db"."public_intermediate"."int_monthly_income_summary" i on a.raw_applicant_id = i.applicant_id
left join "loanlens_db"."public_intermediate"."int_monthly_obligation_summary" o on a.raw_applicant_id = o.applicant_id
left join "loanlens_db"."public_intermediate"."int_bounce_history" b on a.raw_applicant_id = b.applicant_id
left join "loanlens_db"."public_intermediate"."int_balance_trends" bt on a.raw_applicant_id = bt.applicant_id
left join (
    select applicant_id,
           sum(discretionary_spend) as discretionary_spend,
           sum(essential_spend) as essential_spend
    from "loanlens_db"."public_intermediate"."int_spending_by_category"
    group by 1
) sp on a.raw_applicant_id = sp.applicant_id