"""Admin service — user management, config editing, audit log retrieval.

All business logic lives here; routes are HTTP-only.
Every write is logged in audit_log with old and new values.
"""
from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password
from app.core.logger import logger
from app.enums import RoleEnum
from app.exceptions.domain import (
    InsufficientPermissionsException,
    ResourceAlreadyExistsException,
    ResourceNotFoundException,
)
from app.models.user import User
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.loan_type_config_repository import LoanTypeConfigRepository
from app.repositories.user_repository import UserRepository
from app.schemas.admin import (
    AdminConfigResponse,
    AdminConfigUpdateRequest,
    AdminUserResponse,
    AuditLogEntryResponse,
)


class AdminService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo   = UserRepository(session)
        self.config_repo = LoanTypeConfigRepository(session)
        self.audit_repo  = AuditLogRepository(session)

    # ── User listing ──────────────────────────────────────────────────────────

    async def list_users(
        self,
        current_user: User,
        role: RoleEnum | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> list[AdminUserResponse]:
        if current_user.role != RoleEnum.admin:
            raise InsufficientPermissionsException()
        users = await self.user_repo.get_all(role=role, limit=limit, offset=offset)
        return [AdminUserResponse.model_validate(u) for u in users]

    # ── Create user ───────────────────────────────────────────────────────────

    async def create_user(
        self,
        current_user: User,
        name: str,
        email: str,
        password: str,
        role: RoleEnum,
    ) -> AdminUserResponse:
        if current_user.role != RoleEnum.admin:
            raise InsufficientPermissionsException()

        existing = await self.user_repo.get_by_email(email)
        if existing:
            raise ResourceAlreadyExistsException(f"User with email {email} already exists")

        new_user = await self.user_repo.create(
            name=name,
            email=email,
            password_hash=hash_password(password),
            role=role,
        )
        await self.audit_repo.insert(
            user_id=current_user.user_id,
            action="user_created",
            target_type="users",
            target_id=str(new_user.user_id),
            new_value={"name": name, "email": email, "role": role.value},
        )
        await self.session.commit()
        logger.info("admin_user_created", extra={
            "admin_id": str(current_user.user_id),
            "new_user_id": str(new_user.user_id),
            "role": role.value,
        })
        return AdminUserResponse.model_validate(new_user)

    # ── Change role ───────────────────────────────────────────────────────────

    async def change_role(
        self,
        current_user: User,
        target_user_id: UUID,
        new_role: RoleEnum,
    ) -> AdminUserResponse:
        if current_user.role != RoleEnum.admin:
            raise InsufficientPermissionsException()

        target = await self.user_repo.get_by_id(target_user_id)
        if target is None:
            raise ResourceNotFoundException("User", str(target_user_id))

        old_role = target.role.value
        updated  = await self.user_repo.set_role(target_user_id, new_role)

        await self.audit_repo.insert(
            user_id=current_user.user_id,
            action="user_role_changed",
            target_type="users",
            target_id=str(target_user_id),
            old_value={"role": old_role},
            new_value={"role": new_role.value},
        )
        await self.session.commit()
        logger.info("admin_role_changed", extra={
            "admin_id": str(current_user.user_id),
            "target_user_id": str(target_user_id),
            "old_role": old_role,
            "new_role": new_role.value,
        })
        return AdminUserResponse.model_validate(updated)

    # ── Deactivate / reactivate ───────────────────────────────────────────────

    async def set_active(
        self,
        current_user: User,
        target_user_id: UUID,
        *,
        is_active: bool,
    ) -> AdminUserResponse:
        if current_user.role != RoleEnum.admin:
            raise InsufficientPermissionsException()

        target = await self.user_repo.get_by_id(target_user_id)
        if target is None:
            raise ResourceNotFoundException("User", str(target_user_id))

        updated = await self.user_repo.set_active(target_user_id, is_active=is_active)
        action  = "user_activated" if is_active else "user_deactivated"

        await self.audit_repo.insert(
            user_id=current_user.user_id,
            action=action,
            target_type="users",
            target_id=str(target_user_id),
            old_value={"is_active": not is_active},
            new_value={"is_active": is_active},
        )
        await self.session.commit()
        logger.info(action, extra={
            "admin_id": str(current_user.user_id),
            "target_user_id": str(target_user_id),
        })
        return AdminUserResponse.model_validate(updated)

    # ── Loan type config ──────────────────────────────────────────────────────

    async def list_configs(self, current_user: User) -> list[AdminConfigResponse]:
        if current_user.role != RoleEnum.admin:
            raise InsufficientPermissionsException()
        rows = await self.config_repo.get_all()
        return [AdminConfigResponse.model_validate(r) for r in rows]

    async def update_config(
        self,
        current_user: User,
        loan_type_id: int,
        payload: AdminConfigUpdateRequest,
    ) -> AdminConfigResponse:
        if current_user.role != RoleEnum.admin:
            raise InsufficientPermissionsException()

        existing = await self.config_repo.get_by_id(loan_type_id)
        if existing is None:
            raise ResourceNotFoundException("LoanTypeConfig", str(loan_type_id))

        old_value = {
            "min_score": existing.min_score,
            "max_amount": str(existing.max_amount),
            "manager_threshold_amount": str(existing.manager_threshold_amount),
            "approve_threshold": existing.approve_threshold,
            "review_lower": existing.review_lower,
            "review_upper": existing.review_upper,
        }

        fields = {k: v for k, v in payload.model_dump().items() if v is not None}
        updated = await self.config_repo.update(loan_type_id, fields, current_user.user_id)

        await self.audit_repo.insert(
            user_id=current_user.user_id,
            action="config_updated",
            target_type="loan_type_config",
            target_id=str(loan_type_id),
            old_value=old_value,
            new_value={k: str(v) for k, v in fields.items()},
        )
        await self.session.commit()
        logger.info("admin_config_updated", extra={
            "admin_id": str(current_user.user_id),
            "loan_type_id": loan_type_id,
            "fields": list(fields.keys()),
        })
        return AdminConfigResponse.model_validate(updated)

    # ── Audit log ─────────────────────────────────────────────────────────────

    async def get_audit_log(
        self,
        current_user: User,
        user_id: UUID | None = None,
        action: str | None = None,
        target_type: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> list[AuditLogEntryResponse]:
        if current_user.role != RoleEnum.admin:
            raise InsufficientPermissionsException()
        rows = await self.audit_repo.get_all(
            user_id=user_id,
            action=action,
            target_type=target_type,
            limit=limit,
            offset=offset,
        )
        return [AuditLogEntryResponse.model_validate(r) for r in rows]
