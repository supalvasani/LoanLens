
    
    

select
    raw_applicant_id as unique_field,
    count(*) as n_records

from "loanlens_db"."public_staging"."stg_applicants"
where raw_applicant_id is not null
group by raw_applicant_id
having count(*) > 1


