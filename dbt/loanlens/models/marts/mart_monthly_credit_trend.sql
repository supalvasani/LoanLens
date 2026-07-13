with constants as (
    select
        'credit' as c_credit,
        'debit' as c_debit,
        'month' as c_month,
        0.30::numeric as w_income,
        0.25::numeric as w_emi,
        0.20::numeric as w_balance,
        'flat' as t_flat,
        'up' as t_up,
        'down' as t_down,
        interval '6 months' as lookback_interval
),

int_txns_cat as (
    select * from {{ ref('int_transactions_categorized') }}
),

monthly_income as (
    select
        t.applicant_id,
        date_trunc(c.c_month, t.txn_date)::date as month,
        sum(case when t.txn_type = c.c_credit and t.category in ('income', 'salary') then t.amount else 0 end) as income
    from int_txns_cat t
    cross join constants c
    where t.txn_date >= date_trunc(c.c_month, current_date - c.lookback_interval)::date
    group by 1, 2
),

monthly_emi as (
    select
        t.applicant_id,
        date_trunc(c.c_month, t.txn_date)::date as month,
        sum(case when t.txn_type = c.c_debit and t.category in ('emi', 'loan_obligation') then t.amount else 0 end) as emi
    from int_txns_cat t
    cross join constants c
    where t.txn_date >= date_trunc(c.c_month, current_date - c.lookback_interval)::date
    group by 1, 2
),

monthly_bounces as (
    select
        t.applicant_id,
        date_trunc(c.c_month, t.txn_date)::date as month,
        count(*) filter (where t.category = 'bounce') as bounce_count
    from int_txns_cat t
    cross join constants c
    where t.txn_date >= date_trunc(c.c_month, current_date - c.lookback_interval)::date
    group by 1, 2
),

monthly_balance as (
    select
        t.raw_applicant_id as applicant_id,
        date_trunc(c.c_month, t.txn_date)::date as month,
        avg(t.balance_after) as avg_balance,
        max(t.balance_after) - min(t.balance_after) as balance_swing
    from {{ ref('stg_transactions') }} t
    cross join constants c
    where t.txn_date >= date_trunc(c.c_month, current_date - c.lookback_interval)::date
    group by 1, 2
),

months as (
    select applicant_id, month from monthly_income
    union
    select applicant_id, month from monthly_balance
),

base_income as (
    select applicant_id, income_stability_score
    from {{ ref('int_monthly_income_summary') }}
),

components as (
    select
        m.applicant_id,
        m.month,
        coalesce(bi.income_stability_score, 50) as income_stability_score,
        case
            when coalesce(mi.income, 0) = 0 then 50
            else greatest(0, least(100, 100 - (coalesce(me.emi, 0) / mi.income * 200)))
        end as emi_burden_score,
        case
            when coalesce(mb.bounce_count, 0) = 0 then 100
            when mb.bounce_count <= 1 then 70
            when mb.bounce_count <= 3 then 40
            else 10
        end as bounce_score,
        case
            when coalesce(mbal.avg_balance, 0) <= 0 then 20
            when mbal.balance_swing / nullif(mbal.avg_balance, 0) > 0.8 then 40
            when mbal.balance_swing / nullif(mbal.avg_balance, 0) > 0.4 then 65
            else 90
        end as balance_score
    from months m
    left join base_income bi on m.applicant_id = bi.applicant_id
    left join monthly_income mi on m.applicant_id = mi.applicant_id and m.month = mi.month
    left join monthly_emi me on m.applicant_id = me.applicant_id and m.month = me.month
    left join monthly_bounces mb on m.applicant_id = mb.applicant_id and m.month = mb.month
    left join monthly_balance mbal on m.applicant_id = mbal.applicant_id and m.month = mbal.month
),

scored as (
    select
        s.applicant_id,
        s.month,
        greatest(
            0,
            least(
                100,
                round(
                    s.income_stability_score * c.w_income
                    + s.emi_burden_score * c.w_emi
                    + s.bounce_score * c.w_emi
                    + s.balance_score * c.w_balance,
                    2
                )
            )
        ) as score
    from components s
    cross join constants c
)

select
    s.applicant_id,
    s.month,
    s.score,
    case
        when lag(s.score) over (partition by s.applicant_id order by s.month) is null then c.t_flat
        when s.score > lag(s.score) over (partition by s.applicant_id order by s.month) then c.t_up
        when s.score < lag(s.score) over (partition by s.applicant_id order by s.month) then c.t_down
        else c.t_flat
    end as trend_direction
from scored s
cross join constants c
