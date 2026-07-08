select applicant_id, month, count(*) as row_count
from "loanlens_db"."public_marts"."mart_monthly_credit_trend"
group by applicant_id, month
having count(*) > 1