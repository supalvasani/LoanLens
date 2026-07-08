
    
    

select
    applicant_id as unique_field,
    count(*) as n_records

from "loanlens_db"."public_intermediate"."int_balance_trends"
where applicant_id is not null
group by applicant_id
having count(*) > 1


