
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select category
from "loanlens_db"."public_intermediate"."int_transactions_categorized"
where category is null



  
  
      
    ) dbt_internal_test