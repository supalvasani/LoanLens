
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    

with all_values as (

    select
        decision as value_field,
        count(*) as n_records

    from "loanlens_db"."public_marts"."decisions"
    group by decision

)

select *
from all_values
where value_field not in (
    'approved','rejected','escalated'
)



  
  
      
    ) dbt_internal_test