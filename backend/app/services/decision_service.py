"""Decision service — full escalation pre-check and all decision paths.

Escalation rules (enforced HERE, never in routes):
  Score > 65  → Analyst MAY approve
  Score < 45  → Analyst MAY reject
  Score 45-65 → MUST escalate (EscalationRequiredError)
  Any fraud flag → MUST escalate
  amount > manager_threshold_amount → MUST escalate

All decisions are append-only (DecisionRepository.insert only).
Every decision writes an audit_log entry.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import logger
from app.enums import ApplicationStatusEnum, DecisionEnum, RoleEnum
from app.exceptions.domain import (
    EscalationRequiredError,
    InsufficientAuthorityError,
    InsufficientPermissionsException,
    ResourceNotFoundException,
)
from app.models.user import User
from app.repositories.application_repository import ApplicationRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.decision_repository import DecisionRepository
from app.repositories.loan_type_config_repository import LoanTypeConfigRepository
from app.repositories.mart_repository import MartRepository
from app.schemas.loan import (
    AdminOverrideRequest,
    AnalystDecisionRequest,
    DecisionResponse,
    ManagerDecisionRequest,
)


class DecisionService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.app_repo = ApplicationRepository(session)
        self.decision_repo = DecisionRepository(session)
        self.audit_repo = AuditLogRepository(session)
        self.mart_repo = MartRepository(session)
        self.config_repo = LoanTypeConfigRepository(session)

    # ── Escalation Pre-Check ──────────────────────────────────────────────────

    async def _escalation_pre_check(
        self,
        application_id: UUID,
    ) -> tuple[float | None, bool, bool]:
        """Run escalation checks for ANALYST role.

        Returns (score, has_fraud, is_above_threshold).
        Raises EscalationRequiredError if any check trips.
        Never called for manager / admin paths.
        """
        application = await self.app_repo.get_by_id(application_id)
        if application is None:
            raise ResourceNotFoundException("Application", str(application_id))

        # Resolve applicant_id
        applicant_id = await self.mart_repo.get_applicant_id_for_user(application.user_id)

        # 1. Read credit score
        score: float | None = None
        if applicant_id:
            score_row = await self.mart_repo.get_credit_score(applicant_id)
            if score_row:
                score = float(score_row["score"])

        # 2. Read fraud flags
        has_fraud = False
        if applicant_id:
            has_fraud = await self.mart_repo.has_any_fraud_flag(applicant_id)

        # 3. Read manager_threshold_amount from loan_type_config
        config = await self.config_repo.get_by_loan_type(application.loan_type)
        is_above_threshold = False
        if config is not None:
            is_above_threshold = float(application.amount_requested) > float(
                config.manager_threshold_amount
            )

        return score, has_fraud, is_above_threshold

    # ── Analyst: Close (Approve or Reject) ────────────────────────────────────

    async def _validate_analyst_decision(self, application, analyst: User, payload: AnalystDecisionRequest) -> None:
        if analyst.role != RoleEnum.analyst:
            raise InsufficientPermissionsException()

        if payload.decision == DecisionEnum.escalated:
            raise InsufficientAuthorityError(
                "Use the escalate action — not close — to escalate an application"
            )

        if application.status not in (
            ApplicationStatusEnum.pending,
            ApplicationStatusEnum.under_review,
        ):
            raise InsufficientAuthorityError(
                f"Application is already in status '{application.status.value}'"
            )

        score, has_fraud, is_above_threshold = await self._escalation_pre_check(
            application.application_id
        )

        # ── Escalation gate ──
        escalation_reasons: list[str] = []
        if has_fraud:
            escalation_reasons.append("application has active fraud flags")
        if is_above_threshold:
            escalation_reasons.append("amount exceeds manager threshold")
        if score is not None and 45 <= score <= 65:
            escalation_reasons.append(f"score {score:.1f} is in grey zone (45–65)")

        if escalation_reasons:
            raise EscalationRequiredError(
                "This case must be escalated: " + "; ".join(escalation_reasons)
            )

        # ── Score-based authority check ──
        if score is not None:
            if payload.decision == DecisionEnum.approved and score <= 65:
                raise InsufficientAuthorityError(
                    f"Score {score:.1f} is not above 65; cannot approve"
                )
            if payload.decision == DecisionEnum.rejected and score >= 45:
                raise InsufficientAuthorityError(
                    f"Score {score:.1f} is not below 45; cannot reject"
                )

    async def analyst_close(
        self,
        application_id: UUID,
        analyst: User,
        payload: AnalystDecisionRequest,
    ) -> DecisionResponse:
        """Analyst closes an application — approve (score>65) or reject (score<45).

        Raises EscalationRequiredError for grey-zone, fraud, or above-threshold.
        Raises InsufficientAuthorityError if decision == escalated (use analyst_escalate).
        """
        application = await self.app_repo.get_by_id(application_id)
        if application is None:
            raise ResourceNotFoundException("Application", str(application_id))

        await self._validate_analyst_decision(application, analyst, payload)

        # Retrieve score again for logging below
        score, _, _ = await self._escalation_pre_check(application_id)

        new_status = (
            ApplicationStatusEnum.approved
            if payload.decision == DecisionEnum.approved
            else ApplicationStatusEnum.rejected
        )

        old_status = application.status.value
        await self.app_repo.update_status(application_id, new_status)

        decision = await self.decision_repo.insert(
            application_id=application_id,
            decided_by=analyst.user_id,
            decision=payload.decision,
            notes=payload.notes,
        )

        await self.audit_repo.insert(
            user_id=analyst.user_id,
            action=f"application_{payload.decision.value}",
            target_type="raw_loan_applications",
            target_id=str(application_id),
            old_value={"status": old_status},
            new_value={
                "status": new_status.value,
                "decision": payload.decision.value,
                "decided_by": str(analyst.user_id),
            },
        )

        await self.session.commit()

        logger.info(
            "analyst_decision",
            extra={
                "analyst_id": str(analyst.user_id),
                "application_id": str(application_id),
                "decision": payload.decision.value,
                "score": score,
            },
        )
        return DecisionResponse.model_validate(decision)

    # ── Analyst: Escalate ─────────────────────────────────────────────────────

    async def analyst_escalate(
        self,
        application_id: UUID,
        analyst: User,
        notes: str,
    ) -> DecisionResponse:
        """Analyst escalates a grey-zone / fraud / above-threshold application.

        Notes are mandatory for escalation.
        """
        if analyst.role != RoleEnum.analyst:
            raise InsufficientPermissionsException()

        if not notes or len(notes.strip()) < 10:
            raise InsufficientAuthorityError(
                "Written escalation note (min 10 chars) is required"
            )

        application = await self.app_repo.get_by_id(application_id)
        if application is None:
            raise ResourceNotFoundException("Application", str(application_id))

        if application.status not in (
            ApplicationStatusEnum.pending,
            ApplicationStatusEnum.under_review,
        ):
            raise InsufficientAuthorityError(
                f"Application is already in status '{application.status.value}'"
            )

        old_status = application.status.value
        await self.app_repo.update_status(application_id, ApplicationStatusEnum.escalated)

        decision = await self.decision_repo.insert(
            application_id=application_id,
            decided_by=analyst.user_id,
            decision=DecisionEnum.escalated,
            notes=notes,
        )

        await self.audit_repo.insert(
            user_id=analyst.user_id,
            action="application_escalated",
            target_type="raw_loan_applications",
            target_id=str(application_id),
            old_value={"status": old_status},
            new_value={"status": "escalated", "escalation_note": notes},
        )

        await self.session.commit()

        logger.info(
            "application_escalated",
            extra={
                "analyst_id": str(analyst.user_id),
                "application_id": str(application_id),
            },
        )
        return DecisionResponse.model_validate(decision)

    # ── Manager: Approve or Reject ────────────────────────────────────────────

    async def manager_decide(
        self,
        application_id: UUID,
        manager: User,
        payload: ManagerDecisionRequest,
    ) -> DecisionResponse:
        """Manager has final authority on escalated applications.

        Notes are mandatory.  Only escalated applications can be decided here.
        """
        if manager.role not in (RoleEnum.manager, RoleEnum.admin):
            raise InsufficientPermissionsException()

        application = await self.app_repo.get_by_id(application_id)
        if application is None:
            raise ResourceNotFoundException("Application", str(application_id))

        if application.status != ApplicationStatusEnum.escalated:
            raise InsufficientAuthorityError(
                "Manager queue only accepts escalated applications; "
                f"this application has status '{application.status.value}'"
            )

        new_status = (
            ApplicationStatusEnum.approved
            if payload.decision == DecisionEnum.approved
            else ApplicationStatusEnum.rejected
        )

        old_status = application.status.value
        await self.app_repo.update_status(application_id, new_status)

        decision = await self.decision_repo.insert(
            application_id=application_id,
            decided_by=manager.user_id,
            decision=payload.decision,
            notes=payload.notes,
        )

        await self.audit_repo.insert(
            user_id=manager.user_id,
            action=f"manager_{payload.decision.value}",
            target_type="raw_loan_applications",
            target_id=str(application_id),
            old_value={"status": old_status},
            new_value={
                "status": new_status.value,
                "decision": payload.decision.value,
                "decided_by": str(manager.user_id),
                "notes": payload.notes,
            },
        )

        await self.session.commit()

        logger.info(
            "manager_decision",
            extra={
                "manager_id": str(manager.user_id),
                "application_id": str(application_id),
                "decision": payload.decision.value,
            },
        )
        return DecisionResponse.model_validate(decision)

    # ── Admin: Override Any Decision ──────────────────────────────────────────

    async def admin_override(
        self,
        application_id: UUID,
        admin: User,
        payload: AdminOverrideRequest,
    ) -> DecisionResponse:
        """Admin can override any decision regardless of current status.

        Logs old and new values in audit_log.
        """
        if admin.role != RoleEnum.admin:
            raise InsufficientPermissionsException()

        application = await self.app_repo.get_by_id(application_id)
        if application is None:
            raise ResourceNotFoundException("Application", str(application_id))

        old_status = application.status.value

        new_status_map = {
            DecisionEnum.approved: ApplicationStatusEnum.approved,
            DecisionEnum.rejected: ApplicationStatusEnum.rejected,
            DecisionEnum.escalated: ApplicationStatusEnum.escalated,
        }
        new_status = new_status_map[payload.decision]

        await self.app_repo.update_status(application_id, new_status)

        decision = await self.decision_repo.insert(
            application_id=application_id,
            decided_by=admin.user_id,
            decision=payload.decision,
            notes=f"[ADMIN OVERRIDE] {payload.notes}",
        )

        await self.audit_repo.insert(
            user_id=admin.user_id,
            action="admin_override",
            target_type="raw_loan_applications",
            target_id=str(application_id),
            old_value={"status": old_status},
            new_value={
                "status": new_status.value,
                "decision": payload.decision.value,
                "override_by": str(admin.user_id),
                "notes": payload.notes,
            },
        )

        await self.session.commit()

        logger.warning(
            "admin_override",
            extra={
                "admin_id": str(admin.user_id),
                "application_id": str(application_id),
                "old_status": old_status,
                "new_decision": payload.decision.value,
            },
        )
        return DecisionResponse.model_validate(decision)
