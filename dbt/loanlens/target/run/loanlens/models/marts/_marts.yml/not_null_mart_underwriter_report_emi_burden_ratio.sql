
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select emi_burden_ratio
from "loanlens_db"."public_marts"."mart_underwriter_report"
where emi_burden_ratio is null



  
  
      
    ) dbt_internal_test