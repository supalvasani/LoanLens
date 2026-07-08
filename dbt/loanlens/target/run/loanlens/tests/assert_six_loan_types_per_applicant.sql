
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  select applicant_id, count(*) as loan_type_count
from "loanlens_db"."public_marts"."mart_loan_eligibility"
group by applicant_id
having count(*) != 6
  
  
      
    ) dbt_internal_test