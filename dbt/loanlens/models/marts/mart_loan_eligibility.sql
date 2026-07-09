-- ──────────────────────────────────────────────────────────────────────────
-- mart_loan_eligibility.sql
--
-- Real NBFC underwriting logic per RBI/industry standards:
--
-- 1. FOIR (Fixed Obligation to Income Ratio) gate:
--    if total outflows / income > 50% → ineligible (industry standard is 40-65%)
--
-- 2. Score-based multiplier: loan quantum scales with creditworthiness
--    score >= 80 → 100% of max multiplier
--    score 65-79 → 75%
--    score 50-64 → 50%
--    score < 50  → 30% (capped, high-risk tier)
--
-- 3. Minimum data sufficiency: salary_months must meet per-product floor.
--    Fewer months → income estimate is unreliable → eligibility capped.
--    With only 2 months of statements:
--      - Home / Business loan: max 30% of computed amount (unreliable sample)
--      - Personal / Auto: max 60%
--
-- 4. Hard per-product FOIR ceilings align with how Indian banks underwrite:
--    home_loan:     max FOIR 40% (conservative asset-backed)
--    personal_loan: max FOIR 50%
--    business_loan: max FOIR 65% (business cash-flow supported)
--    auto/vehicle:  max FOIR 50%
--    education:     max FOIR 60% (future income discount)
--    two_wheeler:   max FOIR 50%
--
-- 5. Eligible amount = min(
--      product max_amount,
--      disposable_income_based_emi_capacity * tenure_multiplier,
--      score_multiplier_adjusted_amount,
--      data_coverage_confidence_cap
--    )
-- ──────────────────────────────────────────────────────────────────────────

{{ config(materialized='table') }}

with config as (
    select * from {{ source('app', 'loan_type_config') }}
),

applicants as (
    select
        a.*,
        -- ── FOIR: actual outflow / actual income ──────────────────────────
        case
            when coalesce(a.detected_monthly_income, 0) = 0 then 1.0
            else greatest(0,
                (coalesce(a.emi_burden_ratio, 0) * coalesce(a.detected_monthly_income, 0))
                / nullif(a.detected_monthly_income, 0)
            )
        end as foir_actual
    from {{ ref('int_combined_signals') }} a
),

income_meta as (
    -- How many months of salary data did we actually observe?
    select
        raw_applicant_id as applicant_id,
        coalesce(s.salary_months, 0) as data_months
    from {{ ref('stg_applicants') }} sa
    left join {{ ref('int_monthly_income_summary') }} s
        on sa.raw_applicant_id = s.applicant_id
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

eligibility_computed as (
    select
        a.applicant_id,
        c.loan_type_id,
        c.loan_type::text as loan_type,
        c.min_score,
        c.max_amount,
        c.approve_threshold,
        c.review_lower,
        c.review_upper,
        a.detected_monthly_income,
        a.income_stability_score,
        a.emi_burden_ratio,
        a.foir_actual,
        s.score,
        coalesce(app.applied_amount, 0) as applied_amount,
        coalesce(im.data_months, 0) as data_months,

        -- ── Score-based multiplier ──────────────────────────────────────
        case
            when coalesce(s.score, 0) >= 80 then 1.00
            when coalesce(s.score, 0) >= 65 then 0.75
            when coalesce(s.score, 0) >= 50 then 0.50
            else 0.30
        end as score_multiplier,

        -- ── FOIR ceiling per product ────────────────────────────────────
        case c.loan_type::text
            when 'home_loan'       then 0.40
            when 'personal_loan'   then 0.50
            when 'business_loan'   then 0.65
            when 'auto_loan'       then 0.50
            when 'education_loan'  then 0.60
            when 'two_wheeler_loan' then 0.50
            else 0.50
        end as foir_ceiling,

        -- ── Minimum data months required per product ─────────────────
        case c.loan_type::text
            when 'home_loan'       then 6
            when 'business_loan'   then 6
            when 'personal_loan'   then 3
            when 'auto_loan'       then 3
            when 'education_loan'  then 3
            when 'two_wheeler_loan' then 2
            else 3
        end as min_data_months,

        -- ── Data coverage confidence factor (penalises thin samples) ──
        -- 2 months data → 35% confidence; 6+ months → 100%
        case
            when coalesce(im.data_months, 0) = 0 then 0.20
            when coalesce(im.data_months, 0) = 1 then 0.25
            when coalesce(im.data_months, 0) = 2 then 0.35
            when coalesce(im.data_months, 0) = 3 then 0.55
            when coalesce(im.data_months, 0) = 4 then 0.70
            when coalesce(im.data_months, 0) = 5 then 0.85
            else 1.00
        end as coverage_confidence,

        -- ── Disposable income = income × (1 - FOIR ceiling) ──────────
        -- This is the max EMI a borrower can afford
        a.detected_monthly_income * (
            case c.loan_type::text
                when 'home_loan'       then 0.40
                when 'personal_loan'   then 0.50
                when 'business_loan'   then 0.65
                when 'auto_loan'       then 0.50
                when 'education_loan'  then 0.60
                when 'two_wheeler_loan' then 0.50
                else 0.50
            end
        ) as max_monthly_emi_capacity

    from applicants a
    cross join config c
    left join scores s on a.applicant_id = s.applicant_id
    left join applications app
        on a.applicant_id = app.applicant_id
       and c.loan_type::text = app.loan_type
    left join income_meta im on a.applicant_id = im.applicant_id
),

with_eligible_raw as (
    select
        *,
        -- ── EMI-capacity × product-specific tenure ────────────────────
        -- Realistic EMI-to-principal conversions (not raw income × tenure)
        -- max_emi_capacity × tenure_months × 0.85 (buffer for interest overhead)
        case loan_type
            when 'home_loan'        then max_monthly_emi_capacity * 180 * 0.85  -- 15 year
            when 'personal_loan'    then max_monthly_emi_capacity * 60  * 0.85  -- 5 year
            when 'business_loan'    then max_monthly_emi_capacity * 84  * 0.85  -- 7 year
            when 'auto_loan'        then max_monthly_emi_capacity * 60  * 0.85  -- 5 year
            when 'education_loan'   then max_monthly_emi_capacity * 84  * 0.85  -- 7 year
            when 'two_wheeler_loan' then max_monthly_emi_capacity * 36  * 0.85  -- 3 year
            else max_monthly_emi_capacity * 60 * 0.85
        end as emi_based_amount
    from eligibility_computed
),

final as (
    select
        *,
        -- ── Final eligible amount: take the most conservative estimate ──
        greatest(0,
            least(
                max_amount,                                 -- hard product cap
                emi_based_amount * score_multiplier,       -- score-adjusted EMI capacity
                max_amount * coverage_confidence           -- thin-data cap
            )
        ) as eligible_amount_raw,

        -- ── FOIR gate: if actual FOIR already exceeds ceiling → no loan ─
        foir_actual > foir_ceiling as foir_breached,

        -- ── Insufficient data gate ─────────────────────────────────────
        data_months < min_data_months as insufficient_data
    from with_eligible_raw
)

select
    applicant_id,
    loan_type_id,
    loan_type,
    -- Apply gates on top of computed amount
    case
        when score < min_score          then 0
        when foir_breached              then 0
        when insufficient_data          then greatest(0, eligible_amount_raw * 0.20)
        else eligible_amount_raw
    end as eligible_amount,
    applied_amount,
    greatest(0,
        applied_amount - case
            when score < min_score   then 0
            when foir_breached       then 0
            when insufficient_data   then greatest(0, eligible_amount_raw * 0.20)
            else eligible_amount_raw
        end
    ) as gap_amount,

    -- ── Human-readable gap reason ─────────────────────────────────────
    case
        when score < min_score
            then 'low_score'
        when foir_breached
            then 'high_emi_burden'
        when insufficient_data
            then 'insufficient_data'
        when emi_burden_ratio > 0.35 and loan_type = 'home_loan'
            then 'high_emi_burden'
        when income_stability_score < 60 and loan_type in ('home_loan','business_loan')
            then 'low_income_stability'
        when applied_amount > eligible_amount_raw
            then 'above_max_amount'
        else null
    end as gap_reason,

    -- ── Decision ─────────────────────────────────────────────────────
    case
        when score < min_score   then 'reject'
        when foir_breached       then 'reject'
        when score >= approve_threshold
             and not foir_breached
             and applied_amount <= greatest(0,
                 case
                     when insufficient_data then eligible_amount_raw * 0.20
                     else eligible_amount_raw
                 end
             ) then 'approve'
        when score >= review_lower then 'partial'
        else 'reject'
    end as decision,

    -- ── Diagnostic columns for analyst transparency ───────────────────
    round(score, 1)                            as credit_score,
    round(foir_actual * 100, 1)                as foir_pct,
    round(foir_ceiling * 100, 0)               as foir_ceiling_pct,
    round(coverage_confidence * 100, 0)        as data_coverage_pct,
    data_months                                as observed_months,
    min_data_months                            as required_months,
    round(score_multiplier * 100, 0)           as score_multiplier_pct,
    round(detected_monthly_income, 0)          as detected_monthly_income,
    round(max_monthly_emi_capacity, 0)         as max_affordable_emi

from final
