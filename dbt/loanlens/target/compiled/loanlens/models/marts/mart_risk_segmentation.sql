select
    cs.applicant_id,
    case
        when cs.score >= 75 then 'low'
        when cs.score >= 45 then 'medium'
        else 'high'
    end as risk_tier
from "loanlens_db"."public_marts"."mart_credit_score" cs