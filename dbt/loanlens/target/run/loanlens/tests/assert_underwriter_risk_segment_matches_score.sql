
    
    select
      count(*) as failures,
      count(*) != 0 as should_warn,
      count(*) != 0 as should_error
    from (
      
    
  select ur.applicant_id, ur.risk_segment, cs.score
from "loanlens_db"."public_marts"."mart_underwriter_report" ur
join "loanlens_db"."public_marts"."mart_credit_score" cs on ur.applicant_id = cs.applicant_id
where (cs.score >= 65 and ur.risk_segment != 'low')
   or (cs.score >= 45 and cs.score < 65 and ur.risk_segment != 'medium')
   or (cs.score < 45 and ur.risk_segment != 'high')
  
  
      
    ) dbt_internal_test