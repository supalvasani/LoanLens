
    
    

select
    decision_id as unique_field,
    count(*) as n_records

from "loanlens_db"."public_marts"."decisions"
where decision_id is not null
group by decision_id
having count(*) > 1


