"""Read-only repository for dbt mart tables (postgres dev target).

These tables are materialized by dbt — they are NOT SQLAlchemy-managed.
All queries use async text() to avoid ORM coupling.
Every method returns None / [] gracefully when the table hasn't been
materialized yet (dbt hasn't run against this postgres instance).
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncSession


class MartRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Credit Score ─────────────────────────────────────────────────────────

    async def get_credit_score(self, applicant_id: uuid.UUID) -> dict[str, Any] | None:
        """Returns the mart_credit_score row for one applicant."""
        try:
            result = await self.session.execute(
                text(
                    """
                    SELECT
                        applicant_id,
                        score,
                        income_stability_score,
                        emi_burden_score,
                        bounce_score,
                        balance_score,
                        recommendation,
                        score_breakdown_json,
                        computed_at
                    FROM mart_credit_score
                    WHERE applicant_id = :applicant_id
                    LIMIT 1
                    """
                ),
                {"applicant_id": str(applicant_id)},
            )
            row = result.mappings().first()
            return dict(row) if row else None
        except ProgrammingError:
            # Table doesn't exist yet (dbt hasn't run)
            await self.session.rollback()
            return None

    # ── Fraud Flags ───────────────────────────────────────────────────────────

    async def get_fraud_flags(self, applicant_id: uuid.UUID) -> list[dict[str, Any]]:
        """Returns all mart_fraud_flags rows for one applicant."""
        try:
            result = await self.session.execute(
                text(
                    """
                    SELECT
                        applicant_id,
                        flag_type,
                        flag_detail,
                        severity,
                        detected_at
                    FROM mart_fraud_flags
                    WHERE applicant_id = :applicant_id
                    ORDER BY
                        CASE severity
                            WHEN 'high' THEN 1
                            WHEN 'med'  THEN 2
                            ELSE 3
                        END
                    """
                ),
                {"applicant_id": str(applicant_id)},
            )
            return [dict(r) for r in result.mappings().all()]
        except ProgrammingError:
            await self.session.rollback()
            return []

    async def has_any_fraud_flag(self, applicant_id: uuid.UUID) -> bool:
        """Returns True if the applicant has at least one fraud flag."""
        flags = await self.get_fraud_flags(applicant_id)
        return len(flags) > 0

    # ── Loan Eligibility ──────────────────────────────────────────────────────

    async def get_loan_eligibility(
        self,
        applicant_id: uuid.UUID,
        loan_type: str | None = None,
    ) -> list[dict[str, Any]]:
        """Returns mart_loan_eligibility rows, optionally filtered by loan_type."""
        try:
            where_extra = "AND loan_type = :loan_type" if loan_type else ""
            result = await self.session.execute(
                text(
                    f"""
                    SELECT
                        applicant_id,
                        loan_type_id,
                        loan_type,
                        eligible_amount,
                        applied_amount,
                        gap_amount,
                        gap_reason,
                        decision
                    FROM mart_loan_eligibility
                    WHERE applicant_id = :applicant_id
                    {where_extra}
                    ORDER BY loan_type_id
                    """
                ),
                {
                    "applicant_id": str(applicant_id),
                    **({"loan_type": loan_type} if loan_type else {}),
                },
            )
            return [dict(r) for r in result.mappings().all()]
        except ProgrammingError:
            await self.session.rollback()
            return []

    # ── Underwriter Report ────────────────────────────────────────────────────

    async def get_underwriter_report(
        self, applicant_id: uuid.UUID
    ) -> dict[str, Any] | None:
        try:
            result = await self.session.execute(
                text(
                    """
                    SELECT
                        applicant_id,
                        avg_monthly_income,
                        emi_burden_ratio,
                        bounce_count,
                        bounce_rate,
                        savings_potential,
                        fraud_flags,
                        risk_segment
                    FROM mart_underwriter_report
                    WHERE applicant_id = :applicant_id
                    LIMIT 1
                    """
                ),
                {"applicant_id": str(applicant_id)},
            )
            row = result.mappings().first()
            return dict(row) if row else None
        except ProgrammingError:
            await self.session.rollback()
            return None

    # ── Monthly Trend ─────────────────────────────────────────────────────────

    async def get_monthly_trend(
        self, applicant_id: uuid.UUID
    ) -> list[dict[str, Any]]:
        try:
            result = await self.session.execute(
                text(
                    """
                    SELECT
                        applicant_id,
                        month,
                        score,
                        trend_direction
                    FROM mart_monthly_credit_trend
                    WHERE applicant_id = :applicant_id
                    ORDER BY month DESC
                    LIMIT 6
                    """
                ),
                {"applicant_id": str(applicant_id)},
            )
            return [dict(r) for r in result.mappings().all()]
        except ProgrammingError:
            await self.session.rollback()
            return []

    # ── Risk Segmentation ─────────────────────────────────────────────────────

    async def get_risk_tier(self, applicant_id: uuid.UUID) -> str | None:
        try:
            result = await self.session.execute(
                text(
                    """
                    SELECT risk_tier
                    FROM mart_risk_segmentation
                    WHERE applicant_id = :applicant_id
                    LIMIT 1
                    """
                ),
                {"applicant_id": str(applicant_id)},
            )
            row = result.mappings().first()
            return row["risk_tier"] if row else None
        except ProgrammingError:
            await self.session.rollback()
            return None

    # ── Applicant lookup (raw_applicants) ─────────────────────────────────────

    async def get_applicant_id_for_user(
        self, user_id: uuid.UUID
    ) -> uuid.UUID | None:
        """Look up the raw_applicant_id for a given user_id via raw_applicants."""
        try:
            result = await self.session.execute(
                text(
                    """
                    SELECT raw_applicant_id
                    FROM raw_applicants
                    WHERE user_id = :user_id
                    LIMIT 1
                    """
                ),
                {"user_id": str(user_id)},
            )
            row = result.mappings().first()
            return uuid.UUID(str(row["raw_applicant_id"])) if row else None
        except ProgrammingError:
            await self.session.rollback()
            return None
