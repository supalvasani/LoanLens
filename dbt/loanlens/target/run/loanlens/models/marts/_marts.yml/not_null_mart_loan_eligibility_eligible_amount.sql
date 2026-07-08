
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select eligible_amount
from "loanlens_db"."public_marts"."mart_loan_eligibility"
where eligible_amount is null



  
  
      
    ) dbt_internal_test