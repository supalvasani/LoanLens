
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select risk_segment
from "loanlens_db"."public_marts"."mart_underwriter_report"
where risk_segment is null



  
  
      
    ) dbt_internal_test