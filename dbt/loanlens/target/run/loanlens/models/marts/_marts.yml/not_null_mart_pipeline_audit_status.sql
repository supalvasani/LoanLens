
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select status
from "loanlens_db"."public_marts"."mart_pipeline_audit"
where status is null



  
  
      
    ) dbt_internal_test