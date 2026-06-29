select t.applicant_id
from {{ ref('int_transactions_categorized') }} t
left join {{ ref('stg_applicants') }} a on t.applicant_id = a.raw_applicant_id
where a.raw_applicant_id is null
