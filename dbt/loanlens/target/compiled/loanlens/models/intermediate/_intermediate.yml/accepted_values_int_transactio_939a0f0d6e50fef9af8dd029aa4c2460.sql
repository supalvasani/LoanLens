
    
    

with all_values as (

    select
        txn_type as value_field,
        count(*) as n_records

    from "loanlens_db"."public_intermediate"."int_transactions_categorized"
    group by txn_type

)

select *
from all_values
where value_field not in (
    'credit','debit'
)


