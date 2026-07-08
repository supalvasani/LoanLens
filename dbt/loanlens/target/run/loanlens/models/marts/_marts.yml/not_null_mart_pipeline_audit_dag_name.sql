
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select dag_name
from "loanlens_db"."public_marts"."mart_pipeline_audit"
where dag_name is null



  
  
      
    ) dbt_internal_test