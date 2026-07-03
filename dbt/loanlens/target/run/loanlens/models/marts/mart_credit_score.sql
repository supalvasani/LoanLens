
  
    

  create  table "loanlens_db"."public_marts"."mart_credit_score__dbt_tmp"
  
  
    as
  
  (
    with scored as (
    select
        applicant_id,
        income_stability_score,
        emi_burden_score,
        bounce_score,
        balance_score,
        round(
            income_stability_score * 0.30
            + emi_burden_score * 0.25
            + bounce_score * 0.25
            + balance_score * 0.20,
            2
        ) as raw_score
    from "loanlens_db"."public_intermediate"."int_combined_signals"
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
    applicant_id,
    score,
    income_stability_score,
    emi_burden_score,
    bounce_score,
    balance_score,
    case
        when score >= 65 then 'approve'
        when score >= 45 then 'review'
        else 'reject'
    end as recommendation,
    jsonb_build_object(
        'income_stability', jsonb_build_object('weight', 0.30, 'score', income_stability_score),
        'emi_burden', jsonb_build_object('weight', 0.25, 'score', emi_burden_score),
        'bounce_history', jsonb_build_object('weight', 0.25, 'score', bounce_score),
        'balance_maintenance', jsonb_build_object('weight', 0.20, 'score', balance_score),
        'final_score', score
    ) as score_breakdown_json,
    now() as computed_at
from bounded
  );
  