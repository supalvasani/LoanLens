select applicant_id, score, recommendation
from "loanlens_db"."public_marts"."mart_credit_score"
where (score >= 65 and recommendation != 'approve')
   or (score >= 45 and score < 65 and recommendation != 'review')
   or (score < 45 and recommendation != 'reject')