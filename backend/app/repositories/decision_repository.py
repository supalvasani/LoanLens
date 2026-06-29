"""Repository for decisions — append-only insert, query helpers."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import DecisionEnum
from app.models.loan import Decision


class DecisionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Writes (append-only — never update or delete) ────────────────────────

    async def insert(
        self,
        *,
        application_id: uuid.UUID,
        decided_by: uuid.UUID,
        decision: DecisionEnum,
        notes: str | None = None,
        escalated_to: uuid.UUID | None = None,
    ) -> Decision:
        row = Decision(
            decision_id=uuid.uuid4(),
            application_id=application_id,
            decided_by=decided_by,
            decision=decision,
            notes=notes,
            escalated_to=escalated_to,
        )
        self.session.add(row)
        await self.session.flush()
        await self.session.refresh(row)
        return row

    # ── Reads ────────────────────────────────────────────────────────────────

    async def get_by_id(self, decision_id: uuid.UUID) -> Decision | None:
        result = await self.session.execute(
            select(Decision).where(Decision.decision_id == decision_id)
        )
        return result.scalar_one_or_none()

    async def get_latest_for_application(self, application_id: uuid.UUID) -> Decision | None:
        """Return the most recent decision for an application."""
        result = await self.session.execute(
            select(Decision)
            .where(Decision.application_id == application_id)
            .order_by(Decision.decided_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_all_for_application(self, application_id: uuid.UUID) -> list[Decision]:
        result = await self.session.execute(
            select(Decision)
            .where(Decision.application_id == application_id)
            .order_by(Decision.decided_at.desc())
        )
        return list(result.scalars().all())
