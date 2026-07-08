
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select month
from "loanlens_db"."public_marts"."mart_monthly_credit_trend"
where month is null



  
  
      
    ) dbt_internal_test