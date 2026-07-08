
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select avg_monthly_income
from "loanlens_db"."public_intermediate"."int_monthly_income_summary"
where avg_monthly_income is null



  
  
      
    ) dbt_internal_test