"""Repository for audit_log — append-only insert, filterable admin listing."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.loan import AuditLog


class AuditLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Writes (append-only — never update or delete) ────────────────────────

    async def insert(
        self,
        *,
        user_id: uuid.UUID,
        action: str,
        target_type: str,
        target_id: str,
        old_value: dict[str, Any] | None = None,
        new_value: dict[str, Any] | None = None,
    ) -> AuditLog:
        row = AuditLog(
            log_id=uuid.uuid4(),
            user_id=user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            old_value=old_value,
            new_value=new_value,
        )
        self.session.add(row)
        await self.session.flush()
        await self.session.refresh(row)
        return row

    # ── Reads ────────────────────────────────────────────────────────────────

    async def get_all(
        self,
        *,
        user_id: uuid.UUID | None = None,
        action: str | None = None,
        target_type: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> list[AuditLog]:
        conditions: list = []
        if user_id is not None:
            conditions.append(AuditLog.user_id == user_id)
        if action is not None:
            conditions.append(AuditLog.action == action)
        if target_type is not None:
            conditions.append(AuditLog.target_type == target_type)
        if date_from is not None:
            conditions.append(AuditLog.created_at >= date_from)
        if date_to is not None:
            conditions.append(AuditLog.created_at <= date_to)

        stmt = (
            select(AuditLog)
            .where(and_(*conditions) if conditions else True)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
