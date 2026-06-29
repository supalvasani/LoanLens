select
    decision_id,
    application_id,
    decided_by,
    decision,
    notes,
    escalated_to,
    decided_at
from {{ source('app', 'decisions') }}
