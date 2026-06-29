select
    keyword,
    category,
    is_essential::boolean as is_essential
from {{ ref('merchant_categories') }}
