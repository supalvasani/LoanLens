
    
    

with child as (
    select applicant_id as from_field
    from "loanlens_db"."public_marts"."mart_risk_segmentation"
    where applicant_id is not null
),

parent as (
    select applicant_id as to_field
    from "loanlens_db"."public_marts"."mart_credit_score"
)

select
    from_field

from child
left join parent
    on child.from_field = parent.to_field

where parent.to_field is null


