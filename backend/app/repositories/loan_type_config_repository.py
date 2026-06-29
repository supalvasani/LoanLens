"""Repository for loan_type_config — read-all, read-one, and update."""
from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import LoanTypeEnum
from app.models.loan import LoanTypeConfig


class LoanTypeConfigRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Reads ────────────────────────────────────────────────────────────────

    async def get_all(self) -> list[LoanTypeConfig]:
        result = await self.session.execute(
            select(LoanTypeConfig).order_by(LoanTypeConfig.loan_type_id)
        )
        return list(result.scalars().all())

    async def get_by_loan_type(self, loan_type: LoanTypeEnum) -> LoanTypeConfig | None:
        result = await self.session.execute(
            select(LoanTypeConfig).where(LoanTypeConfig.loan_type == loan_type)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, loan_type_id: int) -> LoanTypeConfig | None:
        result = await self.session.execute(
            select(LoanTypeConfig).where(LoanTypeConfig.loan_type_id == loan_type_id)
        )
        return result.scalar_one_or_none()

    # ── Writes ───────────────────────────────────────────────────────────────

    async def update(
        self,
        loan_type_id: int,
        fields: dict[str, Any],
        updated_by: uuid.UUID,
    ) -> LoanTypeConfig | None:
        """Update editable fields on a loan_type_config row.

        Returns the updated ORM object, or None if not found.
        Only the keys present in *fields* are changed.
        """
        allowed = {
            "min_score",
            "max_amount",
            "manager_threshold_amount",
            "approve_threshold",
            "review_lower",
            "review_upper",
        }
        filtered = {k: v for k, v in fields.items() if k in allowed}
        if not filtered:
            return await self.get_by_id(loan_type_id)

        filtered["updated_by"] = updated_by

        await self.session.execute(
            update(LoanTypeConfig)
            .where(LoanTypeConfig.loan_type_id == loan_type_id)
            .values(**filtered)
        )
        await self.session.flush()
        return await self.get_by_id(loan_type_id)
