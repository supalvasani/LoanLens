select applicant_id, count(*) as loan_type_count
from {{ ref('mart_loan_eligibility') }}
group by applicant_id
having count(*) != 6
