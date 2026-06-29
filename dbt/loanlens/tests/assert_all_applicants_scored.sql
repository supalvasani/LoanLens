select
    (select count(*) from {{ ref('stg_applicants') }}) as applicant_count,
    (select count(*) from {{ ref('mart_credit_score') }}) as scored_count
where (select count(*) from {{ ref('stg_applicants') }})
   != (select count(*) from {{ ref('mart_credit_score') }})
