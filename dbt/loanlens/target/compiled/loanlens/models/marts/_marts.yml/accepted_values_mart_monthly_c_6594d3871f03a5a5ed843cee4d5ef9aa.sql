
    
    

with all_values as (

    select
        trend_direction as value_field,
        count(*) as n_records

    from "loanlens_db"."public_marts"."mart_monthly_credit_trend"
    group by trend_direction

)

select *
from all_values
where value_field not in (
    'up','down','flat'
)


