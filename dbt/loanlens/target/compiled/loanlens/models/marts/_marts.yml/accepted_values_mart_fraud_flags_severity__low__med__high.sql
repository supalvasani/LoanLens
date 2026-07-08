
    
    

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


