"""Repository for raw_loan_applications — create, read, role-filtered list, status update."""
from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import ApplicationStatusEnum, LoanTypeEnum, RoleEnum
from app.models.loan import RawLoanApplication
from app.models.user import User


class ApplicationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Writes ───────────────────────────────────────────────────────────────

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        loan_type: LoanTypeEnum,
        amount_requested: Decimal,
        purpose: str,
    ) -> RawLoanApplication:
        row = RawLoanApplication(
            application_id=uuid.uuid4(),
            user_id=user_id,
            loan_type=loan_type,
            amount_requested=amount_requested,
            purpose=purpose,
            status=ApplicationStatusEnum.pending,
        )
        self.session.add(row)
        await self.session.flush()
        await self.session.refresh(row)
        return row

    async def update_status(
        self,
        application_id: uuid.UUID,
        status: ApplicationStatusEnum,
    ) -> RawLoanApplication | None:
        await self.session.execute(
            update(RawLoanApplication)
            .where(RawLoanApplication.application_id == application_id)
            .values(status=status)
        )
        await self.session.flush()
        return await self.get_by_id(application_id)

    # ── Reads ────────────────────────────────────────────────────────────────

    async def get_by_id(self, application_id: uuid.UUID) -> RawLoanApplication | None:
        result = await self.session.execute(
            select(RawLoanApplication).where(
                RawLoanApplication.application_id == application_id
            )
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        *,
        current_user: User,
        status: ApplicationStatusEnum | None = None,
        loan_type: LoanTypeEnum | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[RawLoanApplication]:
        """Return applications filtered by role:
        - admin   → all applications
        - manager → only escalated
        - analyst → all non-escalated (pending, under_review, approved, rejected)
        - applicant → own applications only
        """
        conditions: list = []

        if current_user.role == RoleEnum.applicant:
            conditions.append(RawLoanApplication.user_id == current_user.user_id)
        elif current_user.role == RoleEnum.manager:
            conditions.append(RawLoanApplication.status == ApplicationStatusEnum.escalated)
        elif current_user.role == RoleEnum.analyst:
            conditions.append(
                RawLoanApplication.status != ApplicationStatusEnum.escalated
            )
        # admin sees all — no extra filter

        if status is not None:
            conditions.append(RawLoanApplication.status == status)
        if loan_type is not None:
            conditions.append(RawLoanApplication.loan_type == loan_type)

        stmt = (
            select(RawLoanApplication)
            .where(and_(*conditions) if conditions else True)
            .order_by(RawLoanApplication.submitted_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_status_counts(self) -> dict[str, int]:
        """Return counts of applications grouped by status."""
        result = await self.session.execute(
            select(
                RawLoanApplication.status,
                func.count(RawLoanApplication.application_id)
            )
            .group_by(RawLoanApplication.status)
        )
        return {status.value: count for status, count in result.all()}

