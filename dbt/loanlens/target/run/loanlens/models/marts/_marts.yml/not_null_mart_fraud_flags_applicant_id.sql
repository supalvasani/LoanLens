
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select applicant_id
from "loanlens_db"."public_marts"."mart_fraud_flags"
where applicant_id is null



  
  
      
    ) dbt_internal_test