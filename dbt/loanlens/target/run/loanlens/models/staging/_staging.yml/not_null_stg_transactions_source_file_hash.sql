
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select source_file_hash
from "loanlens_db"."public_staging"."stg_transactions"
where source_file_hash is null



  
  
      
    ) dbt_internal_test