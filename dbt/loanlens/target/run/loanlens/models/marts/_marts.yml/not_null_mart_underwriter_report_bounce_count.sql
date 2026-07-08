
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select bounce_count
from "loanlens_db"."public_marts"."mart_underwriter_report"
where bounce_count is null



  
  
      
    ) dbt_internal_test