
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select raw_applicant_id
from "loanlens_db"."public_staging"."stg_applicants"
where raw_applicant_id is null



  
  
      
    ) dbt_internal_test