
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  select applicant_id, bounce_rate
from "loanlens_db"."public_intermediate"."int_bounce_history"
where bounce_rate < 0 or bounce_rate > 1
  
  
      
    ) dbt_internal_test