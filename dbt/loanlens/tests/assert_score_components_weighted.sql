with constants as (
    select 0.25::numeric as weight_emi_bounce
)
select m.applicant_id, m.score
from {{ ref('mart_credit_score') }} m
cross join constants c
where abs(
    m.score - round(
        (m.score_breakdown_json->'income_stability'->>'score')::numeric * 0.30
        + (m.score_breakdown_json->'emi_burden'->>'score')::numeric * c.weight_emi_bounce
        + (m.score_breakdown_json->'bounce_history'->>'score')::numeric * c.weight_emi_bounce
        + (m.score_breakdown_json->'balance_maintenance'->>'score')::numeric * 0.20,
        2
    )
) > 0.01
