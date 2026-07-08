
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select raw_id
from "loanlens_db"."public_intermediate"."int_transactions_categorized"
where raw_id is null



  
  
      
    ) dbt_internal_test