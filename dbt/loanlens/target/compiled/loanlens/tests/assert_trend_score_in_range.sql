select score
from "loanlens_db"."public_marts"."mart_monthly_credit_trend"
where score < 0 or score > 100