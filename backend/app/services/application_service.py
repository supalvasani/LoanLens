"""Service for loan application submission and retrieval.

All business logic lives here — routes are HTTP-only.
Repository layer handles all DB queries.
"""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import logger
from app.enums import ApplicationStatusEnum, RoleEnum
from app.exceptions.domain import InsufficientPermissionsException, ResourceNotFoundException
from app.models.user import User
from app.repositories.application_repository import ApplicationRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.decision_repository import DecisionRepository
from app.repositories.mart_repository import MartRepository
from app.schemas.loan import (
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
        import uuid
        from decimal import Decimal, InvalidOperation
        from datetime import date, datetime, timezone
        import csv
        import io
        from app.exceptions.domain import DomainException
        from sqlalchemy import text
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

        # Ingest statement if file provided
        if file is not None:
            raw_bytes = await file.read()
            if raw_bytes:
                text_content = raw_bytes.decode("utf-8-sig")
                reader = csv.DictReader(io.StringIO(text_content))
                INSERT_SQL = text("""
                    INSERT INTO raw_transactions
                        (raw_id, applicant_id, txn_date, amount, txn_type, description, balance_after, ingested_at)
                    VALUES
                        (:raw_id, :applicant_id, :txn_date, :amount, :txn_type, :description, :balance_after, :ingested_at)
                    ON CONFLICT (raw_id) DO NOTHING
                """)
                for row in reader:
                    # Basic validation of columns
                    raw_date = row.get("txn_date", "").strip()
                    try:
                        txn_date = date.fromisoformat(raw_date)
                        amount_val = Decimal(row.get("amount", "").strip())
                        txn_type = row.get("txn_type", "").strip().lower()
                        balance_after = Decimal(row.get("balance_after", "").strip())
                        description = row.get("description", "").strip()[:255] or "—"
                        
                        await self.session.execute(
                            INSERT_SQL,
                            {
                                "raw_id":       str(uuid.uuid4()),
                                "applicant_id": str(applicant_id),
                                "txn_date":     txn_date,
                                "amount":       amount_val,
                                "txn_type":     txn_type,
                                "description":  description,
                                "balance_after": balance_after,
                                "ingested_at":  datetime.now(timezone.utc),
                            }
                        )
                    except Exception:
                        continue

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
