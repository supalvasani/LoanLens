select score
from "loanlens_db"."public_marts"."mart_credit_score"
where score < 0 or score > 100