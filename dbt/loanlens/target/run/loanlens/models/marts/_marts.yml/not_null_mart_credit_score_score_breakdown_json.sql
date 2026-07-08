
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select score_breakdown_json
from "loanlens_db"."public_marts"."mart_credit_score"
where score_breakdown_json is null



  
  
      
    ) dbt_internal_test