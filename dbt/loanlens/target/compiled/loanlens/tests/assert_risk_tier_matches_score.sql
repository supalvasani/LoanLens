select cs.applicant_id, cs.score, rs.risk_tier
from "loanlens_db"."public_marts"."mart_credit_score" cs
join "loanlens_db"."public_marts"."mart_risk_segmentation" rs on cs.applicant_id = rs.applicant_id
where (cs.score >= 75 and rs.risk_tier != 'low')
   or (cs.score >= 45 and cs.score < 75 and rs.risk_tier != 'medium')
   or (cs.score < 45 and rs.risk_tier != 'high')