select applicant_id, score, recommendation
from {{ ref('mart_credit_score') }}
where (score >= 65 and recommendation != 'approve')
   or (score >= 45 and score < 65 and recommendation != 'review')
   or (score < 45 and recommendation != 'reject')
