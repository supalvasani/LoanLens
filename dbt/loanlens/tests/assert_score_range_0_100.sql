select score
from {{ ref('mart_credit_score') }}
where score < 0 or score > 100
