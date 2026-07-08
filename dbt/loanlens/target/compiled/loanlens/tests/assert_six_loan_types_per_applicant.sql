select applicant_id, count(*) as loan_type_count
from "loanlens_db"."public_marts"."mart_loan_eligibility"
group by applicant_id
having count(*) != 6