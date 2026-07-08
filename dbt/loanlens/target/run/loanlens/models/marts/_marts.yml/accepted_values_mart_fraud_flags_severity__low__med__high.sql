
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    

with all_values as (

    select
        severity as value_field,
        count(*) as n_records

    from "loanlens_db"."public_marts"."mart_fraud_flags"
    group by severity

)

select *
from all_values
where value_field not in (
    'low','med','high'
)



  
  
      
    ) dbt_internal_test