"""Service for loan application submission and retrieval.

All business logic lives here — routes are HTTP-only.
Repository layer handles all DB queries.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import logger
from app.enums import ApplicationStatusEnum, LoanTypeEnum, RoleEnum
from app.exceptions.domain import InsufficientPermissionsException, ResourceNotFoundException
from app.ingestion.pipeline import (
    STATUS_OK,
    STATUS_RECONCILIATION_WARN,
    ingest_statement,
)
from app.models.loan import RawLoanApplication
from app.models.user import User
from app.repositories.application_repository import ApplicationRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.decision_repository import DecisionRepository
from app.repositories.mart_repository import MartRepository
from app.schemas.loan import (
    AnalystQueueItem,
    ApplicationWithMartDataResponse,
    CreditScoreData,
    DecisionResponse,
    FraudFlagData,
    LoanApplicationRequest,
    LoanApplicationResponse,
    LoanEligibilityData,
    MonthlyTrendPoint,
    UnderwriterReportData,
)


class ApplicationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.app_repo = ApplicationRepository(session)
        self.audit_repo = AuditLogRepository(session)
        self.mart_repo = MartRepository(session)
        self.decision_repo = DecisionRepository(session)

    # ── Submit Application ────────────────────────────────────────────────────

    async def create_application(
        self,
        current_user: User,
        payload: LoanApplicationRequest,
    ) -> LoanApplicationResponse:
        """Applicant submits a loan application.

        Only applicants may call this.  applicant_id is sourced from JWT
        (current_user.user_id), never from the request body.
        """
        if current_user.role != RoleEnum.applicant:
            raise InsufficientPermissionsException()

        application = await self.app_repo.create(
            user_id=current_user.user_id,
            loan_type=payload.loan_type,
            amount_requested=payload.amount_requested,
            purpose=payload.purpose,
        )

        await self.audit_repo.insert(
            user_id=current_user.user_id,
            action="application_submitted",
            target_type="raw_loan_applications",
            target_id=str(application.application_id),
            new_value={
                "loan_type": payload.loan_type.value,
                "amount_requested": str(payload.amount_requested),
                "purpose": payload.purpose,
            },
        )

        await self.session.commit()

        logger.info(
            "application_submitted",
            extra={
                "user_id": str(current_user.user_id),
                "application_id": str(application.application_id),
                "loan_type": payload.loan_type.value,
                "amount": str(payload.amount_requested),
            },
        )
        return LoanApplicationResponse.model_validate(application)

    async def create_application_with_file(
        self,
        *,
        current_user: User,
        loan_type: LoanTypeEnum,
        amount_requested: Decimal,
        purpose: str,
        file: Any = None,
    ) -> LoanApplicationResponse:
        from decimal import Decimal

        from app.models.loan import RawApplicant

        if current_user.role != RoleEnum.applicant:
            raise InsufficientPermissionsException()

        # Resolve applicant_id
        applicant_id = await self.mart_repo.get_applicant_id_for_user(current_user.user_id)
        if not applicant_id:
            # Auto-create if missing
            applicant_id = uuid.uuid4()
            self.session.add(
                RawApplicant(
                    raw_applicant_id=applicant_id,
                    applicant_ref=f"APP_{str(current_user.user_id)[:8].upper()}",
                    name=current_user.name,
                    pan_number="ABCDE1234F",
                    phone="+919999999999",
                    city="Mumbai",
                    monthly_income_declared=Decimal("50000.00"),
                    user_id=current_user.user_id,
                )
            )
            await self.session.flush()

        # Create application
        application = await self.app_repo.create(
            user_id=current_user.user_id,
            loan_type=loan_type,
            amount_requested=amount_requested,
            purpose=purpose,
        )

        await self.audit_repo.insert(
            user_id=current_user.user_id,
            action="application_submitted",
            target_type="raw_loan_applications",
            target_id=str(application.application_id),
            new_value={
                "loan_type": loan_type.value,
                "amount_requested": str(amount_requested),
                "purpose": purpose,
            },
        )

        # ── Ingest statement (universal pipeline) ───────────────────────────────
        if file is not None:
            raw_bytes = await file.read()
            if raw_bytes:
                ingest_result = ingest_statement(
                    raw_bytes=raw_bytes,
                    applicant_id=str(applicant_id),
                    file_name=file.filename or "statement.csv",
                    file_hash_lookup=lambda aid, h: False,   # dedup not enforced here
                    registry_lookup=lambda headers: None,    # always use heuristic path
                )
                if ingest_result.status in (STATUS_OK, STATUS_RECONCILIATION_WARN):
                    INSERT_SQL = text("""
                        INSERT INTO raw_transactions
                            (raw_id, raw_applicant_id, txn_date, amount, txn_type,
                             description, balance_after, source_format,
                             source_file_hash, ingested_at)
                        VALUES
                            (:raw_id, :raw_applicant_id, :txn_date, :amount, :txn_type,
                             :description, :balance_after, :source_format,
                             :source_file_hash, :ingested_at)
                        ON CONFLICT (raw_id) DO NOTHING
                    """)
                    now = datetime.now(UTC)
                    for row in (ingest_result.rows or []):
                        try:
                            await self.session.execute(
                                INSERT_SQL,
                                {
                                    "raw_id":           str(row["raw_id"]),
                                    "raw_applicant_id": str(applicant_id),
                                    "txn_date":         row["txn_date"],
                                    "amount":           row["amount"],
                                    "txn_type":         row["txn_type"],
                                    "description":      row.get("description", "—"),
                                    "balance_after":    row.get("balance_after"),
                                    "source_format":    row.get("source_format", "heuristic"),
                                    "source_file_hash": row.get("source_file_hash", ""),
                                    "ingested_at":      now,
                                },
                            )
                        except Exception:
                            continue
                else:
                    logger.warning(
                        "application_statement_ingest_skipped",
                        extra={
                            "status": ingest_result.status,
                            "applicant_id": str(applicant_id),
                        },
                    )

        await self.session.commit()
        return LoanApplicationResponse.model_validate(application)

    # ── List Applications ─────────────────────────────────────────────────────

    async def list_applications(
        self,
        current_user: User,
        status: ApplicationStatusEnum | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[LoanApplicationResponse]:
        """Role-filtered listing:
        - admin   → all
        - manager → escalated only
        - analyst → all non-escalated
        - applicant → own only
        """
        applications = await self.app_repo.get_all(
            current_user=current_user,
            status=status,
            limit=limit,
            offset=offset,
        )
        return [LoanApplicationResponse.model_validate(a) for a in applications]

    async def list_analyst_queue(
        self,
        analyst: User,
        *,
        score_min: float | None = None,
        score_max: float | None = None,
        risk_segment: str | None = None,
        loan_type: LoanTypeEnum | None = None,
        recommendation: str | None = None,
        sort_by: str = "submitted_at",
        sort_dir: str = "desc",
        limit: int = 100,
        offset: int = 0,
    ) -> list[AnalystQueueItem]:
        """Return non-escalated applications enriched with mart data.

        Filters (all optional):
            score_min, score_max  — credit score range (float)
            risk_segment          — low / medium / high
            loan_type             — LoanTypeEnum value
            recommendation        — approve / review / reject

        Sort fields: score, submitted_at, amount_requested
        """
        import asyncio

        if analyst.role != RoleEnum.analyst:
            raise InsufficientPermissionsException()

        # 1. Base list — role gate already filters out escalated for analysts
        raw_apps = await self.app_repo.get_all(
            current_user=analyst,
            loan_type=loan_type,
            limit=500,   # fetch more for in-memory mart filtering
            offset=0,
        )

        # 2. Enrich each application with mart data concurrently
        async def _none() -> None:
            return None

        async def _false() -> bool:
            return False

        async def _enrich(app: RawLoanApplication) -> AnalystQueueItem:
            applicant_id = await self.mart_repo.get_applicant_id_for_user(app.user_id)

            # Fetch mart data in parallel for this application
            score_task = self.mart_repo.get_credit_score(applicant_id) if applicant_id else _none()
            risk_task  = self.mart_repo.get_risk_tier(applicant_id)    if applicant_id else _none()
            fraud_task = self.mart_repo.has_any_fraud_flag(applicant_id) if applicant_id else _false()
            name_task  = self.mart_repo.get_applicant_name(applicant_id) if applicant_id else _none()

            score_row, risk_tier, has_fraud, applicant_name = await asyncio.gather(
                score_task, risk_task, fraud_task, name_task
            )

            score = float(score_row["score"]) if score_row and score_row.get("score") is not None else None
            rec   = score_row.get("recommendation") if score_row else None

            return AnalystQueueItem(
                application_id=app.application_id,
                applicant_name=applicant_name,
                loan_type=app.loan_type,
                amount_requested=app.amount_requested,
                purpose=app.purpose,
                status=app.status,
                submitted_at=app.submitted_at,
                score=score,
                risk_tier=risk_tier,
                recommendation=rec,
                has_fraud_flags=bool(has_fraud),
            )

        items = await asyncio.gather(*[_enrich(a) for a in raw_apps])

        # 3. Apply mart-level filters (cannot be done in DB query)
        result: list[AnalystQueueItem] = []
        for item in items:
            if score_min is not None and (item.score is None or item.score < score_min):
                continue
            if score_max is not None and (item.score is None or item.score > score_max):
                continue
            if risk_segment is not None and (item.risk_tier or "").lower() != risk_segment.lower():
                continue
            if recommendation is not None and (item.recommendation or "").lower() != recommendation.lower():
                continue
            result.append(item)

        # 4. Sort
        reverse = sort_dir.lower() == "desc"
        if sort_by == "score":
            result.sort(key=lambda x: (x.score is None, x.score or 0), reverse=reverse)
        elif sort_by == "amount_requested":
            result.sort(key=lambda x: float(x.amount_requested), reverse=reverse)
        else:  # default: submitted_at
            result.sort(key=lambda x: x.submitted_at, reverse=reverse)

        # 5. Paginate
        return result[offset: offset + limit]


    async def get_my_applications(
        self,
        current_user: User,
    ) -> list[dict]:
        if current_user.role != RoleEnum.applicant:
            raise InsufficientPermissionsException()

        # Fetch applications for this user
        apps = await self.app_repo.get_all(current_user=current_user)

        res = []
        for app in apps:
            reason = None
            if app.status == ApplicationStatusEnum.rejected:
                # Find last decision notes
                decisions = await self.decision_repo.get_all_for_application(app.application_id)
                rejections = [d for d in decisions if d.decision.value == "rejected"]
                if rejections:
                    # Use the latest rejection notes
                    reason = rejections[-1].notes
                if not reason:
                    # Fallback to credit score recommendation or gap reason
                    applicant_id = await self.mart_repo.get_applicant_id_for_user(current_user.user_id)
                    if applicant_id:
                        elig = await self.mart_repo.get_loan_eligibility(applicant_id, app.loan_type.value)
                        if elig and elig[0].get("gap_reason"):
                            from app.api.v1.routes.eligibility import GAP_REASON_LABELS
                            raw_gap = elig[0]["gap_reason"]
                            reason = GAP_REASON_LABELS.get(raw_gap, raw_gap.replace("_", " ").title())
                        else:
                            score_row = await self.mart_repo.get_credit_score(applicant_id)
                            if score_row and score_row.get("recommendation"):
                                reason = score_row["recommendation"]
                
                if not reason:
                    reason = "Application did not meet NBFC risk thresholds"

            res.append({
                "application_id": app.application_id,
                "loan_type": app.loan_type,
                "amount_requested": app.amount_requested,
                "status": app.status,
                "submitted_at": app.submitted_at,
                "primary_rejection_reason": reason,
            })
        return res

    # ── Get Single Application (with mart data) ───────────────────────────────

    async def get_application_full(
        self,
        application_id: str,
        current_user: User,
    ) -> ApplicationWithMartDataResponse:
        """Returns a full application + all mart data for the applicant.

        Role gates:
        - applicant can only see their own
        - manager can only see escalated
        - analyst can see all non-escalated
        - admin sees everything
        """
        from uuid import UUID

        try:
            app_uuid = UUID(application_id)
        except ValueError as exc:
            raise ResourceNotFoundException("Application", application_id) from exc

        application = await self.app_repo.get_by_id(app_uuid)
        if application is None:
            raise ResourceNotFoundException("Application", application_id)

        # Role gate
        if current_user.role == RoleEnum.applicant:
            if application.user_id != current_user.user_id:
                raise InsufficientPermissionsException()
        elif current_user.role == RoleEnum.manager:
            if application.status != ApplicationStatusEnum.escalated:
                raise InsufficientPermissionsException()
        elif current_user.role == RoleEnum.analyst:
            if application.status == ApplicationStatusEnum.escalated:
                raise InsufficientPermissionsException()

        # Resolve applicant_id from raw_applicants (user → applicant mapping)
        applicant_id = await self.mart_repo.get_applicant_id_for_user(application.user_id)

        # Fetch mart data (all gracefully return None / [] if dbt hasn't run)
        credit_score_raw = await self.mart_repo.get_credit_score(applicant_id) if applicant_id else None
        fraud_flags_raw = await self.mart_repo.get_fraud_flags(applicant_id) if applicant_id else []
        eligibility_raw = await self.mart_repo.get_loan_eligibility(applicant_id) if applicant_id else []
        underwriter_raw = await self.mart_repo.get_underwriter_report(applicant_id) if applicant_id else None
        trend_raw = await self.mart_repo.get_monthly_trend(applicant_id) if applicant_id else []
        risk_tier = await self.mart_repo.get_risk_tier(applicant_id) if applicant_id else None

        # Decision history for this application
        decision_rows = await self.decision_repo.get_all_for_application(app_uuid)

        return ApplicationWithMartDataResponse(
            application=LoanApplicationResponse.model_validate(application),
            credit_score=CreditScoreData(**credit_score_raw) if credit_score_raw else None,
            fraud_flags=[FraudFlagData(**f) for f in fraud_flags_raw],
            eligibility=[LoanEligibilityData(**e) for e in eligibility_raw],
            underwriter_report=UnderwriterReportData(**underwriter_raw) if underwriter_raw else None,
            monthly_trend=[MonthlyTrendPoint(**t) for t in trend_raw],
            risk_tier=risk_tier,
            decisions=[DecisionResponse.model_validate(d) for d in decision_rows],
        )
