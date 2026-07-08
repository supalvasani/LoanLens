
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select category
from "loanlens_db"."public_staging"."stg_merchant_categories"
where category is null



  
  
      
    ) dbt_internal_test