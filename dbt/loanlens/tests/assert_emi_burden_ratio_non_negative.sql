select applicant_id, emi_burden_ratio
from {{ ref('int_monthly_obligation_summary') }}
where emi_burden_ratio < 0
