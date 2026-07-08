
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select detected_at
from "loanlens_db"."public_marts"."mart_fraud_flags"
where detected_at is null



  
  
      
    ) dbt_internal_test