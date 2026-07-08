
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select recommendation
from "loanlens_db"."public_marts"."mart_credit_score"
where recommendation is null



  
  
      
    ) dbt_internal_test