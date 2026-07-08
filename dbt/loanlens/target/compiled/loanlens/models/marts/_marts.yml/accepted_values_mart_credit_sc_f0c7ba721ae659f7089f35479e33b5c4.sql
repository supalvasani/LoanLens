
    
    

with all_values as (

    select
        recommendation as value_field,
        count(*) as n_records

    from "loanlens_db"."public_marts"."mart_credit_score"
    group by recommendation

)

select *
from all_values
where value_field not in (
    'approve','review','reject'
)


