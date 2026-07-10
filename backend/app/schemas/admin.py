"""Pydantic v2 DTOs for admin-only operations:
user management, loan type config edits, audit log listing.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.enums import RoleEnum

# ── User management ──────────────────────────────────────────────────────────

class AdminCreateUserRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    role: RoleEnum


class AdminChangeRoleRequest(BaseModel):
    role: RoleEnum


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: UUID
    name: str
    email: str
    role: RoleEnum
    is_active: bool
    created_at: datetime


# ── Loan type config ──────────────────────────────────────────────────────────

class AdminConfigUpdateRequest(BaseModel):
    """All fields optional — only provided fields are updated.
    Every change is logged in audit_log with old and new values.
    """
    min_score: int | None = Field(default=None, ge=0, le=100)
    max_amount: Decimal | None = Field(default=None, gt=0)
    manager_threshold_amount: Decimal | None = Field(default=None, gt=0)
    approve_threshold: int | None = Field(default=None, ge=0, le=100)
    review_lower: int | None = Field(default=None, ge=0, le=100)
    review_upper: int | None = Field(default=None, ge=0, le=100)


class AdminConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    loan_type_id: int
    loan_type: str
    min_score: int
    max_amount: Decimal
    manager_threshold_amount: Decimal
    approve_threshold: int
    review_lower: int
    review_upper: int
    updated_by: UUID | None
    updated_at: datetime


# ── Audit log ─────────────────────────────────────────────────────────────────

class AuditLogEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    log_id: UUID
    user_id: UUID
    action: str
    target_type: str
    target_id: str
    old_value: dict | None
    new_value: dict | None
    created_at: datetime
