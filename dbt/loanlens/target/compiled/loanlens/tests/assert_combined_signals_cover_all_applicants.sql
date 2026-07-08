select a.raw_applicant_id
from "loanlens_db"."public_staging"."stg_applicants" a
left join "loanlens_db"."public_intermediate"."int_combined_signals" s on a.raw_applicant_id = s.applicant_id
where s.applicant_id is null