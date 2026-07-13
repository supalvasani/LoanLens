with constants as (
    select 0.25::numeric as weight_emi_bounce, 'score' as k_score
)
select m.applicant_id, m.score
from {{ ref('mart_credit_score') }} m
cross join constants c
where abs(
    m.score - round(
        (m.score_breakdown_json->'income_stability'->>c.k_score)::numeric * 0.30
        + (m.score_breakdown_json->'emi_burden'->>c.k_score)::numeric * c.weight_emi_bounce
        + (m.score_breakdown_json->'bounce_history'->>c.k_score)::numeric * c.weight_emi_bounce
        + (m.score_breakdown_json->'balance_maintenance'->>c.k_score)::numeric * 0.20,
        2
    )
) > 0.01
