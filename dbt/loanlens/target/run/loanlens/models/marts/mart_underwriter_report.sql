
  
    

  create  table "loanlens_db"."public_marts"."mart_underwriter_report__dbt_tmp"
  
  
    as
  
  (
    select
    s.applicant_id,
    s.detected_monthly_income as avg_monthly_income,
    s.emi_burden_ratio,
    s.bounce_count,
    s.bounce_rate,
    s.savings_potential,
    coalesce(
        (
            select jsonb_agg(jsonb_build_object('flag_type', f.flag_type, 'severity', f.severity, 'detail', f.flag_detail))
            from "loanlens_db"."public_marts"."mart_fraud_flags" f
            where f.applicant_id = s.applicant_id
        ),
        '[]'::jsonb
    ) as fraud_flags,
    case
        when cs.score >= 65 then 'low'
        when cs.score >= 45 then 'medium'
        else 'high'
    end as risk_segment
from "loanlens_db"."public_intermediate"."int_combined_signals" s
left join "loanlens_db"."public_marts"."mart_credit_score" cs on s.applicant_id = cs.applicant_id
  );
  