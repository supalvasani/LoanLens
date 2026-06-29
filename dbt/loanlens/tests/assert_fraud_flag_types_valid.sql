select flag_type
from {{ ref('mart_fraud_flags') }}
where flag_type not in (
    'sudden_large_deposit',
    'bounce_event',
    'high_frequency_small_txns',
    'circular_transfer',
    'unusual_cash_spike'
)
