
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  select
    (select count(*) from "loanlens_db"."public_staging"."stg_applicants") as applicant_count,
    (select count(*) from "loanlens_db"."public_marts"."mart_credit_score") as scored_count
where (select count(*) from "loanlens_db"."public_staging"."stg_applicants")
   != (select count(*) from "loanlens_db"."public_marts"."mart_credit_score")
  
  
      
    ) dbt_internal_test