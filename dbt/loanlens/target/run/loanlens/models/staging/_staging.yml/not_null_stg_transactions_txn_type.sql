
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select txn_type
from "loanlens_db"."public_staging"."stg_transactions"
where txn_type is null



  
  
      
    ) dbt_internal_test