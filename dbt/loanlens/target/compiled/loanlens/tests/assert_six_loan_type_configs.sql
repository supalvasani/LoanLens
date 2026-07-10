select loan_type::text as loan_type, count(*) as config_count
from "loanlens_db"."public"."loan_type_config"
group by loan_type

having count(*) != 1

union all

select 'TOTAL'::text as loan_type, count(*) as config_count
from "loanlens_db"."public"."loan_type_config"
having count(*) != 6