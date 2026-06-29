select
    applicant_id,
    category,
    is_essential,
    sum(case when txn_type = 'debit' then amount else 0 end) as total_spend,
    sum(case when txn_type = 'debit' and is_essential then amount else 0 end) as essential_spend,
    sum(case when txn_type = 'debit' and not is_essential then amount else 0 end) as discretionary_spend,
    sum(case when txn_type = 'credit' then amount else 0 end) as total_credits
from {{ ref('int_transactions_categorized') }}
group by 1, 2, 3
