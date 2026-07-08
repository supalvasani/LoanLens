
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select source_format
from "loanlens_db"."public_staging"."stg_transactions"
where source_format is null



  
  
      
    ) dbt_internal_test