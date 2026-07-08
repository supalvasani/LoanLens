
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  select raw_id, txn_date
from "loanlens_db"."public_staging"."stg_transactions"
where txn_date > current_date
  
  
      
    ) dbt_internal_test