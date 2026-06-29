select score
from {{ ref('mart_monthly_credit_trend') }}
where score < 0 or score > 100
