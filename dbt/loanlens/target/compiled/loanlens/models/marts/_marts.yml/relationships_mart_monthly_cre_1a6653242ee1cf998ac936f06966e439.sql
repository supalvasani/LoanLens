
    
    

with child as (
    select applicant_id as from_field
    from "loanlens_db"."public_marts"."mart_monthly_credit_trend"
    where applicant_id is not null
),

parent as (
    select raw_applicant_id as to_field
    from "loanlens_db"."public_staging"."stg_applicants"
)

select
    from_field

from child
left join parent
    on child.from_field = parent.to_field

where parent.to_field is null


