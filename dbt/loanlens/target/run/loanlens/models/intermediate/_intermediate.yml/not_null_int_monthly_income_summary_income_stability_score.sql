
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select income_stability_score
from "loanlens_db"."public_intermediate"."int_monthly_income_summary"
where income_stability_score is null



  
  
      
    ) dbt_internal_test