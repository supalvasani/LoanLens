
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select emi_burden_score
from "loanlens_db"."public_intermediate"."int_combined_signals"
where emi_burden_score is null



  
  
      
    ) dbt_internal_test