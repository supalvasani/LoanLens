select applicant_id, bounce_rate
from {{ ref('int_bounce_history') }}
where bounce_rate < 0 or bounce_rate > 1
