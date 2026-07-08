
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select loan_type
from "loanlens_db"."public_marts"."mart_loan_eligibility"
where loan_type is null



  
  
      
    ) dbt_internal_test