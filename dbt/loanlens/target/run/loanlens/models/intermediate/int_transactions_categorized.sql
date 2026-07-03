
  
    

  create  table "loanlens_db"."public_intermediate"."int_transactions_categorized__dbt_tmp"
  
  
    as
  
  (
    with categorized as (
    select
        t.raw_id,
        t.applicant_id,
        t.txn_date,
        t.amount,
        t.txn_type,
        t.description,
        t.balance_after,
        t.ingested_at,
        t.txn_category_hint,
        coalesce(
            (
                select mc.category
                from "loanlens_db"."public_staging"."stg_merchant_categories" mc
                where lower(t.description) like '%' || lower(mc.keyword) || '%'
                order by length(mc.keyword) desc
                limit 1
            ),
            t.txn_category_hint,
            'other'
        ) as category,
        coalesce(
            (
                select mc.is_essential
                from "loanlens_db"."public_staging"."stg_merchant_categories" mc
                where lower(t.description) like '%' || lower(mc.keyword) || '%'
                order by length(mc.keyword) desc
                limit 1
            ),
            false
        ) as is_essential
    from "loanlens_db"."public_staging"."stg_transactions" t
)

select * from categorized
  );
  