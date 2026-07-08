
    
    

select
    run_id as unique_field,
    count(*) as n_records

from "loanlens_db"."public_marts"."mart_pipeline_audit"
where run_id is not null
group by run_id
having count(*) > 1


