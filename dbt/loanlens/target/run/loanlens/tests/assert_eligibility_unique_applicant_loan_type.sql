
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  select applicant_id, loan_type, count(*) as row_count
from "loanlens_db"."public_marts"."mart_loan_eligibility"
group by applicant_id, loan_type
having count(*) > 1
  
  
      
    ) dbt_internal_test