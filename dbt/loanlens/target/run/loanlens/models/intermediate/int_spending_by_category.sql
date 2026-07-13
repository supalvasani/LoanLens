
  
    

  create  table "loanlens_db"."public_intermediate"."int_spending_by_category__dbt_tmp"
  
  
    as
  
  (
    with constants as (
    select 'debit' as debit_type, 'credit' as credit_type, 0::numeric as c_zero
)
select
    t.applicant_id,
    t.category,
    t.is_essential,
    sum(case when t.txn_type = c.debit_type then t.amount else c.c_zero end) as total_spend,
    sum(case when t.txn_type = c.debit_type and t.is_essential then t.amount else c.c_zero end) as essential_spend,
    sum(case when t.txn_type = c.debit_type and not t.is_essential then t.amount else c.c_zero end) as discretionary_spend,
    sum(case when t.txn_type = c.credit_type then t.amount else c.c_zero end) as total_credits
from "loanlens_db"."public_intermediate"."int_transactions_categorized" t
cross join constants c
group by 1, 2, 3, c.debit_type, c.credit_type, c.c_zero
  );
  