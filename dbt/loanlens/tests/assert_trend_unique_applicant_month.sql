select applicant_id, month, count(*) as row_count
from {{ ref('mart_monthly_credit_trend') }}
group by applicant_id, month
having count(*) > 1
