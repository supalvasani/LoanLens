
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select risk_tier
from "loanlens_db"."public_marts"."mart_risk_segmentation"
where risk_tier is null



  
  
      
    ) dbt_internal_test