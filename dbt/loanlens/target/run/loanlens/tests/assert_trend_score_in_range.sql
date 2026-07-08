
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  select score
from "loanlens_db"."public_marts"."mart_monthly_credit_trend"
where score < 0 or score > 100
  
  
      
    ) dbt_internal_test