
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    

select
    applicant_ref as unique_field,
    count(*) as n_records

from "loanlens_db"."public_staging"."stg_applicants"
where applicant_ref is not null
group by applicant_ref
having count(*) > 1



  
  
      
    ) dbt_internal_test