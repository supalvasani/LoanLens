
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select txn_date
from "loanlens_db"."public_staging"."stg_transactions"
where txn_date is null



  
  
      
    ) dbt_internal_test