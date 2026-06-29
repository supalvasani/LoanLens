select a.raw_applicant_id
from {{ ref('stg_applicants') }} a
left join {{ ref('int_combined_signals') }} s on a.raw_applicant_id = s.applicant_id
where s.applicant_id is null
