
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select run_id
from "loanlens_db"."public_marts"."mart_pipeline_audit"
where run_id is null



  
  
      
    ) dbt_internal_test