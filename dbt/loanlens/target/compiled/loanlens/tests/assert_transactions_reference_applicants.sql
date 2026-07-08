select t.applicant_id
from "loanlens_db"."public_intermediate"."int_transactions_categorized" t
left join "loanlens_db"."public_staging"."stg_applicants" a on t.applicant_id = a.raw_applicant_id
where a.raw_applicant_id is null