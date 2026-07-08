
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  
    
    

with all_values as (

    select
        risk_segment as value_field,
        count(*) as n_records

    from "loanlens_db"."public_marts"."mart_underwriter_report"
    group by risk_segment

)

select *
from all_values
where value_field not in (
    'low','medium','high'
)



  
  
      
    ) dbt_internal_test