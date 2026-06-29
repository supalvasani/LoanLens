select applicant_id, score
from {{ ref('mart_credit_score') }}
where abs(
    score - round(
        (score_breakdown_json->'income_stability'->>'score')::numeric * 0.30
        + (score_breakdown_json->'emi_burden'->>'score')::numeric * 0.25
        + (score_breakdown_json->'bounce_history'->>'score')::numeric * 0.25
        + (score_breakdown_json->'balance_maintenance'->>'score')::numeric * 0.20,
        2
    )
) > 0.01
