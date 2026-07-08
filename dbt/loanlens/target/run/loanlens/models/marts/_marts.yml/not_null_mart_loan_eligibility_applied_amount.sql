
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select applied_amount
from "loanlens_db"."public_marts"."mart_loan_eligibility"
where applied_amount is null



  
  
      
    ) dbt_internal_test