from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import logger
from app.enums import ApplicationStatusEnum, DecisionEnum, LoanTypeEnum, RoleEnum
from app.exceptions.domain import (
    InsufficientPermissionsException,
    ResourceNotFoundException,
)
from app.models.user import User
from app.repositories.application_repository import ApplicationRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.decision_repository import DecisionRepository
from app.repositories.loan_type_config_repository import LoanTypeConfigRepository
from app.repositories.mart_repository import MartRepository
from app.repositories.user_repository import UserRepository
from app.schemas.loan import (
    ConfigUpdateDTO,
    CreditScoreData,
    DecisionResponse,
    FraudFlagData,
    LoanApplicationResponse,
    LoanEligibilityData,
    LoanTypeConfigResponse,
    ManagerApplicationResponse,
    ManagerQueueItem,
    MonthlyTrendPoint,
    PortfolioDTO,
    RiskBreakdown,
    ScoreBucketCount,
    UnderwriterReportData,
)


class ManagerService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.app_repo = ApplicationRepository(session)
        self.config_repo = LoanTypeConfigRepository(session)
        self.audit_repo = AuditLogRepository(session)
        self.decision_repo = DecisionRepository(session)
        self.user_repo = UserRepository(session)
        self.mart_repo = MartRepository(session)

    # ── Manager Queue ─────────────────────────────────────────────────────────

    async def list_queue(self, manager: User) -> list[ManagerQueueItem]:
        """Returns only escalated applications, sorted by priority.

        Priority Sort:
        1. Fraud-flagged first
        2. Grey-zone (score 45-65)
        3. Above threshold amount
        Within each tier, sorted by escalated_at timestamp DESC.
        """
        if manager.role not in (RoleEnum.manager, RoleEnum.admin):
            raise InsufficientPermissionsException()

        # Fetch escalated applications
        raw_apps = await self.app_repo.get_all(
            current_user=manager,
            status=ApplicationStatusEnum.escalated,
            limit=500,
        )

        async def _none() -> None:
            return None

        async def _enrich(app: Any) -> ManagerQueueItem:
            applicant_id = await self.mart_repo.get_applicant_id_for_user(app.user_id)

            # Fetch mart data + decisions in parallel
            score_task = self.mart_repo.get_credit_score(applicant_id) if applicant_id else _none()
            fraud_task = self.mart_repo.get_fraud_flags(applicant_id) if applicant_id else _none()
            name_task = self.mart_repo.get_applicant_name(applicant_id) if applicant_id else _none()
            config_task = self.config_repo.get_by_loan_type(app.loan_type)
            decisions_task = self.decision_repo.get_all_for_application(app.application_id)

            score_row, fraud_rows, applicant_name, config, decisions = await asyncio.gather(
                score_task, fraud_task, name_task, config_task, decisions_task
            )

            score = float(score_row["score"]) if score_row and score_row.get("score") is not None else None
            fraud_flags = [FraudFlagData(**f) for f in fraud_rows] if fraud_rows else []

            # Find latest escalation decision details
            escalation_reason: str | None = None
            escalated_at: datetime | None = None
            escalated_by_name: str | None = None

            escalation_dec = next((d for d in decisions if d.decision == DecisionEnum.escalated), None)
            if escalation_dec:
                escalation_reason = escalation_dec.notes
                escalated_at = escalation_dec.decided_at
                analyst = await self.user_repo.get_by_id(escalation_dec.decided_by)
                if analyst:
                    escalated_by_name = analyst.name

            # Store manager threshold amount for priority check
            manager_threshold = config.manager_threshold_amount if config else None

            # Create item
            item = ManagerQueueItem(
                application_id=app.application_id,
                applicant_name=applicant_name,
                loan_type=app.loan_type,
                amount_requested=app.amount_requested,
                score=score,
                fraud_flags=fraud_flags,
                escalation_reason=escalation_reason,
                escalated_at=escalated_at,
                escalated_by_name=escalated_by_name,
            )

            # Keep threshold attached dynamically for sorting helper
            setattr(item, "_manager_threshold", manager_threshold)
            return item

        items = await asyncio.gather(*[_enrich(a) for a in raw_apps])

        # Priority Sort Key Helper
        def get_sort_key(itm: ManagerQueueItem) -> tuple[int, float]:
            has_fraud = len(itm.fraud_flags) > 0
            is_grey = itm.score is not None and 45 <= itm.score <= 65
            
            threshold = getattr(itm, "_manager_threshold", None)
            is_above = False
            if threshold is not None:
                is_above = itm.amount_requested > threshold

            if has_fraud:
                tier = 0
            elif is_grey:
                tier = 1
            elif is_above:
                tier = 2
            else:
                tier = 3

            ts = itm.escalated_at.timestamp() if itm.escalated_at else 0.0
            return (tier, -ts)

        items.sort(key=get_sort_key)
        return items

    # ── Manager Single Application View ───────────────────────────────────────

    async def get_application(self, application_id: UUID, manager: User) -> ManagerApplicationResponse:
        """Returns details for an escalated application with all mart tables and escalation info."""
        if manager.role not in (RoleEnum.manager, RoleEnum.admin):
            raise InsufficientPermissionsException()

        application = await self.app_repo.get_by_id(application_id)
        if application is None:
            raise ResourceNotFoundException("Application", str(application_id))

        if application.status != ApplicationStatusEnum.escalated:
            raise InsufficientPermissionsException("Manager can only view escalated applications")

        # Resolve applicant_id
        applicant_id = await self.mart_repo.get_applicant_id_for_user(application.user_id)

        # Fetch mart data
        credit_score_raw = await self.mart_repo.get_credit_score(applicant_id) if applicant_id else None
        fraud_flags_raw = await self.mart_repo.get_fraud_flags(applicant_id) if applicant_id else []
        eligibility_raw = await self.mart_repo.get_loan_eligibility(applicant_id) if applicant_id else []
        underwriter_raw = await self.mart_repo.get_underwriter_report(applicant_id) if applicant_id else None
        trend_raw = await self.mart_repo.get_monthly_trend(applicant_id) if applicant_id else []
        risk_tier = await self.mart_repo.get_risk_tier(applicant_id) if applicant_id else None

        # Fetch decisions
        decision_rows = await self.decision_repo.get_all_for_application(application_id)

        # Locate escalation info
        escalation_reason: str | None = None
        escalated_at: datetime | None = None
        escalated_by_name: str | None = None

        escalation_dec = next((d for d in decision_rows if d.decision == DecisionEnum.escalated), None)
        if escalation_dec:
            escalation_reason = escalation_dec.notes
            escalated_at = escalation_dec.decided_at
            analyst = await self.user_repo.get_by_id(escalation_dec.decided_by)
            if analyst:
                escalated_by_name = analyst.name

        return ManagerApplicationResponse(
            application=LoanApplicationResponse.model_validate(application),
            credit_score=CreditScoreData(**credit_score_raw) if credit_score_raw else None,
            fraud_flags=[FraudFlagData(**f) for f in fraud_flags_raw],
            eligibility=[LoanEligibilityData(**e) for e in eligibility_raw],
            underwriter_report=UnderwriterReportData(**underwriter_raw) if underwriter_raw else None,
            monthly_trend=[MonthlyTrendPoint(**t) for t in trend_raw],
            risk_tier=risk_tier,
            decisions=[DecisionResponse.model_validate(d) for d in decision_rows],
            escalation_reason=escalation_reason,
            escalated_at=escalated_at,
            escalated_by_name=escalated_by_name,
        )

    # ── Edit Config ───────────────────────────────────────────────────────────

    async def update_config(self, loan_type: LoanTypeEnum, manager: User, payload: ConfigUpdateDTO) -> LoanTypeConfigResponse:
        """Edit loan config thresholds (manager_threshold_amount, approve_threshold, review_lower, review_upper).

        min_score and max_amount changes are blocked.
        Changes take effect immediately and are saved to audit log.
        """
        if manager.role not in (RoleEnum.manager, RoleEnum.admin):
            raise InsufficientPermissionsException()

        existing = await self.config_repo.get_by_loan_type(loan_type)
        if existing is None:
            raise ResourceNotFoundException("LoanTypeConfig", loan_type.value)

        # Prepare old value dictionary of fields being updated
        old_value = {
            "manager_threshold_amount": str(existing.manager_threshold_amount),
            "approve_threshold": existing.approve_threshold,
            "review_lower": existing.review_lower,
            "review_upper": existing.review_upper,
        }

        # Filter out None values in update payload
        fields = {k: v for k, v in payload.model_dump().items() if v is not None}

        # Perform update
        updated = await self.config_repo.update(existing.loan_type_id, fields, manager.user_id)

        # Insert to audit log
        await self.audit_repo.insert(
            user_id=manager.user_id,
            action="config_updated",
            target_type="loan_type_config",
            target_id=str(existing.loan_type_id),
            old_value=old_value,
            new_value={k: str(v) for k, v in fields.items()},
        )

        await self.session.commit()
        logger.info(
            "manager_config_updated",
            extra={
                "manager_id": str(manager.user_id),
                "loan_type": loan_type.value,
                "fields": list(fields.keys()),
            },
        )
        return LoanTypeConfigResponse.model_validate(updated)

    async def list_configs(self, manager: User) -> list[LoanTypeConfigResponse]:
        """Allows managers to list configurations to view threshold tables."""
        if manager.role not in (RoleEnum.manager, RoleEnum.admin):
            raise InsufficientPermissionsException()
        rows = await self.config_repo.get_all()
        return [LoanTypeConfigResponse.model_validate(r) for r in rows]

    # ── Portfolio Analytics ───────────────────────────────────────────────────

    async def get_portfolio_analytics(self, manager: User) -> PortfolioDTO:
        """Fetch aggregated metrics across all applications and credit scores."""
        if manager.role not in (RoleEnum.manager, RoleEnum.admin):
            raise InsufficientPermissionsException()

        # Score distribution query
        db_score_dist = await self.mart_repo.get_portfolio_score_distribution()
        score_buckets = ["0-20", "21-40", "41-60", "61-80", "81-100"]
        score_dist_map = {bucket: 0 for bucket in score_buckets}
        for item in db_score_dist:
            sb = item.get("score_bucket")
            if sb in score_dist_map:
                score_dist_map[sb] = item.get("count", 0)
        score_distribution = [ScoreBucketCount(score_bucket=k, count=v) for k, v in score_dist_map.items()]

        # Risk segments breakdown query
        db_risk_breakdown = await self.mart_repo.get_portfolio_risk_breakdown()
        risk_map = {"low": 0, "medium": 0, "high": 0}
        for item in db_risk_breakdown:
            rt = str(item.get("risk_tier")).lower()
            if rt in risk_map:
                risk_map[rt] = item.get("count", 0)
        risk_breakdown = RiskBreakdown(
            low_count=risk_map["low"],
            medium_count=risk_map["medium"],
            high_count=risk_map["high"],
        )

        # Avg EMI burden ratio query
        avg_emi = await self.mart_repo.get_portfolio_avg_emi_to_income_ratio()

        # Counts from raw_loan_applications
        counts = await self.app_repo.get_status_counts()

        total_applications = sum(counts.values())
        escalated_count = counts.get(ApplicationStatusEnum.escalated.value, 0)
        approved_count = counts.get(ApplicationStatusEnum.approved.value, 0)
        rejected_count = counts.get(ApplicationStatusEnum.rejected.value, 0)

        # Rate calculation: approved vs total decided (approved + rejected)
        total_decided = approved_count + rejected_count
        approval_rate = round((approved_count / total_decided) * 100, 2) if total_decided > 0 else 0.0

        return PortfolioDTO(
            score_distribution=score_distribution,
            approval_rate=approval_rate,
            risk_breakdown=risk_breakdown,
            avg_emi_to_income_ratio=round(avg_emi, 4),
            total_applications=total_applications,
            escalated_count=escalated_count,
        )
