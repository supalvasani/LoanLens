select ur.applicant_id, ur.risk_segment, cs.score
from {{ ref('mart_underwriter_report') }} ur
join {{ ref('mart_credit_score') }} cs on ur.applicant_id = cs.applicant_id
where (cs.score >= 65 and ur.risk_segment != 'low')
   or (cs.score >= 45 and cs.score < 65 and ur.risk_segment != 'medium')
   or (cs.score < 45 and ur.risk_segment != 'high')
