
    
    

select
    rate_id as unique_field,
    count(*) as n_records

from "loanlens_db"."public_staging"."stg_rbi_rates"
where rate_id is not null
group by rate_id
having count(*) > 1


