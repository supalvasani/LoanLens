select applicant_id, loan_type, count(*) as row_count
from "loanlens_db"."public_marts"."mart_loan_eligibility"
group by applicant_id, loan_type
having count(*) > 1