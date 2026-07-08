
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select gap_reason
from "loanlens_db"."public_marts"."mart_loan_eligibility"
where gap_reason is null



  
  
      
    ) dbt_internal_test