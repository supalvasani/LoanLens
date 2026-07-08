
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    



select applicant_ref
from "loanlens_db"."public_staging"."stg_applicants"
where applicant_ref is null



  
  
      
    ) dbt_internal_test