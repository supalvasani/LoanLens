
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select fraud_flags
from "loanlens_db"."public_marts"."mart_underwriter_report"
where fraud_flags is null



  
  
      
    ) dbt_internal_test