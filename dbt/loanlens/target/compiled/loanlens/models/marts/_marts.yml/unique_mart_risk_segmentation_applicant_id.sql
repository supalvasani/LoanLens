
    
    

select
    applicant_id as unique_field,
    count(*) as n_records

from "loanlens_db"."public_marts"."mart_risk_segmentation"
where applicant_id is not null
group by applicant_id
having count(*) > 1


