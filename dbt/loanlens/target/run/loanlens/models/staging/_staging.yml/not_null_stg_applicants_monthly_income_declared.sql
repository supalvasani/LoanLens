
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select monthly_income_declared
from "loanlens_db"."public_staging"."stg_applicants"
where monthly_income_declared is null



  
  
      
    ) dbt_internal_test