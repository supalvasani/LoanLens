
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select rate_type
from "loanlens_db"."public_staging"."stg_rbi_rates"
where rate_type is null



  
  
      
    ) dbt_internal_test