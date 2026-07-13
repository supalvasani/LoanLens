with constants as (
    select
        0.30::numeric as w_income,
        0.25::numeric as w_emi,
        0.20::numeric as w_balance,
        'approve' as rec_approve,
        'review' as rec_review,
        'reject' as rec_reject,
        'weight' as k_weight,
        'score' as k_score
),
scored as (
    select
        s.applicant_id,
        s.income_stability_score,
        s.emi_burden_score,
        s.bounce_score,
        s.balance_score,
        round(
            s.income_stability_score * c.w_income
            + s.emi_burden_score * c.w_emi
            + s.bounce_score * c.w_emi
            + s.balance_score * c.w_balance,
            2
        ) as raw_score
    from "loanlens_db"."public_intermediate"."int_combined_signals" s
    cross join constants c
),

bounded as (
    select
        applicant_id,
        income_stability_score,
        emi_burden_score,
        bounce_score,
        balance_score,
        greatest(0, least(100, raw_score)) as score
    from scored
)

select
    b.applicant_id,
    b.score,
    b.income_stability_score,
    b.emi_burden_score,
    b.bounce_score,
    b.balance_score,
    case
        when b.score >= 65 then c.rec_approve
        when b.score >= 45 then c.rec_review
        else c.rec_reject
    end as recommendation,
    jsonb_build_object(
        'income_stability', jsonb_build_object(c.k_weight, c.w_income, c.k_score, b.income_stability_score),
        'emi_burden', jsonb_build_object(c.k_weight, c.w_emi, c.k_score, b.emi_burden_score),
        'bounce_history', jsonb_build_object(c.k_weight, c.w_emi, c.k_score, b.bounce_score),
        'balance_maintenance', jsonb_build_object(c.k_weight, c.w_balance, c.k_score, b.balance_score),
        'final_score', b.score
    ) as score_breakdown_json,
    now() as computed_at
from bounded b
cross join constants c