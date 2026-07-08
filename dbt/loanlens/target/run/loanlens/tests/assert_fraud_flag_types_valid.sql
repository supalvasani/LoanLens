
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  select flag_type
from "loanlens_db"."public_marts"."mart_fraud_flags"
where flag_type not in (
    'sudden_large_deposit',
    'bounce_event',
    'high_frequency_small_txns',
    'circular_transfer',
    'unusual_cash_spike'
)
  
  
      
    ) dbt_internal_test