
    
    

select
    raw_id as unique_field,
    count(*) as n_records

from "loanlens_db"."public_intermediate"."int_transactions_categorized"
where raw_id is not null
group by raw_id
having count(*) > 1


