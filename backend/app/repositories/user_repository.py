"""Extend user_repository with admin-needed methods:
list all users, update role, toggle active status.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import RoleEnum
from app.models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Reads ──────────────────────────────────────────────────────────────────

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(
            select(User).where(User.email == email.lower())
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: UUID) -> User | None:
        result = await self.session.execute(
            select(User).where(User.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_all(
        self,
        *,
        role: RoleEnum | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> list[User]:
        stmt = select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
        if role is not None:
            stmt = stmt.where(User.role == role)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    # ── Writes ─────────────────────────────────────────────────────────────────

    async def create(
        self,
        *,
        name: str,
        email: str,
        password_hash: str,
        role: RoleEnum = RoleEnum.applicant,
    ) -> User:
        user = User(name=name, email=email.lower(), password_hash=password_hash, role=role)
        self.session.add(user)
        await self.session.flush()
        await self.session.refresh(user)
        return user

    async def set_role(self, user_id: UUID, role: RoleEnum) -> User | None:
        user = await self.get_by_id(user_id)
        if user is None:
            return None
        user.role = role
        await self.session.flush()
        await self.session.refresh(user)
        return user

    async def set_active(self, user_id: UUID, *, is_active: bool) -> User | None:
        user = await self.get_by_id(user_id)
        if user is None:
            return None
        user.is_active = is_active
        await self.session.flush()
        await self.session.refresh(user)
        return user
