
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select flag_type
from "loanlens_db"."public_marts"."mart_fraud_flags"
where flag_type is null



  
  
      
    ) dbt_internal_test