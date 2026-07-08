
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select severity
from "loanlens_db"."public_marts"."mart_fraud_flags"
where severity is null



  
  
      
    ) dbt_internal_test