with config as (
    select * from {{ source('app', 'loan_type_config') }}
),

applicants as (
    select * from {{ ref('int_combined_signals') }}
),

scores as (
    select * from {{ ref('mart_credit_score') }}
),

applications as (
    select
        ra.raw_applicant_id as applicant_id,
        la.loan_type::text as loan_type,
        coalesce(sum(la.amount_requested), 0) as applied_amount
    from {{ source('raw', 'raw_loan_applications') }} la
    join {{ ref('stg_applicants') }} ra on ra.user_id = la.user_id
    group by 1, 2
),

eligible_base as (
    select
        a.applicant_id,
        c.loan_type_id,
        c.loan_type,
        c.min_score,
        c.max_amount,
        c.approve_threshold,
        c.review_lower,
        a.detected_monthly_income,
        a.income_stability_score,
        a.emi_burden_ratio,
        s.score,
        coalesce(app.applied_amount, 0) as applied_amount,
        least(
            c.max_amount,
            case
                when c.loan_type in ('home_loan', 'business_loan')
                    then greatest(
                        0,
                        a.detected_monthly_income * 60 * (a.income_stability_score / 100.0)
                    )
                when c.loan_type = 'personal_loan'
                    then least(c.max_amount, a.detected_monthly_income * 24)
                when c.loan_type = 'auto_loan'
                    then least(c.max_amount, a.detected_monthly_income * 36)
                when c.loan_type = 'education_loan'
                    then least(c.max_amount, a.detected_monthly_income * 48)
                when c.loan_type = 'two_wheeler_loan'
                    then least(c.max_amount, a.detected_monthly_income * 12)
                else c.max_amount
            end
        ) as eligible_amount
    from applicants a
    cross join config c
    left join scores s on a.applicant_id = s.applicant_id
    left join applications app
        on a.applicant_id = app.applicant_id
       and c.loan_type::text = app.loan_type
)

select
    applicant_id,
    loan_type_id,
    loan_type,
    eligible_amount,
    applied_amount,
    greatest(0, applied_amount - eligible_amount) as gap_amount,
    case
        when score < min_score
            then 'Score ' || round(score, 0) || ' is below minimum threshold of ' || min_score
        when emi_burden_ratio > 0.35 and loan_type = 'home_loan'
            then 'EMI burden ' || round(emi_burden_ratio * 100, 1) || '% exceeds 35% for home loan'
        when income_stability_score < 75 and loan_type = 'home_loan'
            then 'Income stability score ' || round(income_stability_score, 0) || ' is below 75 for home loan'
        when applied_amount > eligible_amount
            then 'Requested amount exceeds eligible limit by INR ' || round(applied_amount - eligible_amount, 0)
        when score < review_lower
            then 'Credit score in rejection zone; eligible amount capped'
        else 'Eligible based on current profile'
    end as gap_reason,
    case
        when score >= approve_threshold and applied_amount <= eligible_amount then 'approve'
        when score >= review_lower then 'partial'
        else 'reject'
    end as decision
from eligible_base
