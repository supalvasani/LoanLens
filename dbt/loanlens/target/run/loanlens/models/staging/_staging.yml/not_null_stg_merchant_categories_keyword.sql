
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select keyword
from "loanlens_db"."public_staging"."stg_merchant_categories"
where keyword is null



  
  
      
    ) dbt_internal_test