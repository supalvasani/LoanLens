select applicant_id
from "loanlens_db"."public_marts"."mart_credit_score"
where income_stability_score < 0 or income_stability_score > 100
   or emi_burden_score < 0 or emi_burden_score > 100
   or bounce_score < 0 or bounce_score > 100
   or balance_score < 0 or balance_score > 100