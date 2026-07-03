"""Admin routes — user management, loan type config, and audit log.

Admin-only. All routes require role=admin in JWT.
Every write logs old + new values to audit_log.
"""
from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.enums import RoleEnum
from app.exceptions.domain import DomainException
from app.models.user import User
from app.schemas.admin import (
    AdminChangeRoleRequest,
    AdminConfigResponse,
    AdminConfigUpdateRequest,
    AdminCreateUserRequest,
    AdminUserResponse,
    AuditLogEntryResponse,
)
from app.services.admin_service import AdminService

router = APIRouter(prefix="/admin", tags=["Admin"])


def _handle(exc: DomainException):
    from fastapi import HTTPException
    raise HTTPException(status_code=exc.status_code, detail=exc.message)


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get(
    "/users",
    response_model=list[AdminUserResponse],
    summary="List all users (admin only)",
)
@limiter.limit("120/minute")
async def list_users(
    request: Request,
    role: Optional[RoleEnum] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_role(RoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> list[AdminUserResponse]:
    try:
        return await AdminService(db).list_users(current_user, role=role, limit=limit, offset=offset)
    except DomainException as exc:
        _handle(exc)


@router.post(
    "/users",
    response_model=AdminUserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user (any role)",
)
@limiter.limit("20/minute")
async def create_user(
    request: Request,
    payload: AdminCreateUserRequest,
    current_user: User = Depends(require_role(RoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> AdminUserResponse:
    try:
        return await AdminService(db).create_user(
            current_user,
            name=payload.name,
            email=str(payload.email),
            password=payload.password,
            role=payload.role,
        )
    except DomainException as exc:
        _handle(exc)


@router.patch(
    "/users/{user_id}/role",
    response_model=AdminUserResponse,
    summary="Change a user's role",
)
@limiter.limit("20/minute")
async def change_role(
    request: Request,
    user_id: UUID,
    payload: AdminChangeRoleRequest,
    current_user: User = Depends(require_role(RoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> AdminUserResponse:
    try:
        return await AdminService(db).change_role(current_user, user_id, payload.role)
    except DomainException as exc:
        _handle(exc)


@router.patch(
    "/users/{user_id}/deactivate",
    response_model=AdminUserResponse,
    summary="Deactivate a user account",
)
@limiter.limit("20/minute")
async def deactivate_user(
    request: Request,
    user_id: UUID,
    current_user: User = Depends(require_role(RoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> AdminUserResponse:
    try:
        return await AdminService(db).set_active(current_user, user_id, is_active=False)
    except DomainException as exc:
        _handle(exc)


@router.patch(
    "/users/{user_id}/reactivate",
    response_model=AdminUserResponse,
    summary="Reactivate a deactivated user",
)
@limiter.limit("20/minute")
async def reactivate_user(
    request: Request,
    user_id: UUID,
    current_user: User = Depends(require_role(RoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> AdminUserResponse:
    try:
        return await AdminService(db).set_active(current_user, user_id, is_active=True)
    except DomainException as exc:
        _handle(exc)


# ── Loan type config ──────────────────────────────────────────────────────────

@router.get(
    "/config",
    response_model=list[AdminConfigResponse],
    summary="List all loan type configurations",
)
@limiter.limit("120/minute")
async def list_configs(
    request: Request,
    current_user: User = Depends(require_role(RoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> list[AdminConfigResponse]:
    try:
        return await AdminService(db).list_configs(current_user)
    except DomainException as exc:
        _handle(exc)


@router.patch(
    "/config/{loan_type_id}",
    response_model=AdminConfigResponse,
    summary="Edit loan type thresholds (takes effect immediately, logged in audit_log)",
)
@limiter.limit("20/minute")
async def update_config(
    request: Request,
    loan_type_id: int,
    payload: AdminConfigUpdateRequest,
    current_user: User = Depends(require_role(RoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> AdminConfigResponse:
    try:
        return await AdminService(db).update_config(current_user, loan_type_id, payload)
    except DomainException as exc:
        _handle(exc)


# ── Audit log ─────────────────────────────────────────────────────────────────

@router.get(
    "/audit",
    response_model=list[AuditLogEntryResponse],
    summary="Filterable audit log (admin only)",
)
@limiter.limit("60/minute")
async def get_audit_log(
    request: Request,
    user_id: Optional[UUID] = Query(default=None),
    action: Optional[str] = Query(default=None),
    target_type: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_role(RoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> list[AuditLogEntryResponse]:
    try:
        return await AdminService(db).get_audit_log(
            current_user,
            user_id=user_id,
            action=action,
            target_type=target_type,
            limit=limit,
            offset=offset,
        )
    except DomainException as exc:
        _handle(exc)
