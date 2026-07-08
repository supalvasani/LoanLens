
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select rate_value
from "loanlens_db"."public_staging"."stg_rbi_rates"
where rate_value is null



  
  
      
    ) dbt_internal_test