
    
    

select
    keyword as unique_field,
    count(*) as n_records

from "loanlens_db"."public_staging"."stg_merchant_categories"
where keyword is not null
group by keyword
having count(*) > 1


