select
    keyword,
    category,
    is_essential::boolean as is_essential
from "loanlens_db"."public_staging"."merchant_categories"