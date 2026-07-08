
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select computed_at
from "loanlens_db"."public_marts"."mart_credit_score"
where computed_at is null



  
  
      
    ) dbt_internal_test