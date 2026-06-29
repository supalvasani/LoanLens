select
    raw_applicant_id,
    applicant_ref,
    trim(name) as name,
    upper(pan_number) as pan_number,
    phone,
    trim(city) as city,
    monthly_income_declared::numeric(14, 2) as monthly_income_declared,
    user_id,
    ingested_at
from {{ source('raw', 'raw_applicants') }}
