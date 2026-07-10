"""Decision and admin-override routes.

All escalation logic lives in decision_service.py — never here.
Routes are HTTP-only.
"""

from uuid import UUID

from fastapi import APIRouter, Body, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_role
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.enums import RoleEnum
from app.exceptions.domain import DomainException
from app.models.user import User
from app.schemas.loan import (
    AdminOverrideRequest,
    AnalystDecisionRequest,
    DecisionResponse,
    ManagerDecisionDTO,
    ManagerDecisionRequest,
)
from app.services.decision_service import DecisionService

router = APIRouter(tags=["Decisions"])

_DECISION_LIMIT = "20/minute"


def _raise_domain(exc: DomainException) -> None:
    from fastapi import HTTPException
    raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# ── POST /decisions/{id} ──────────────────────────────────────────────────────

@router.post(
    "/decisions/{application_id}",
    response_model=DecisionResponse,
    status_code=status.HTTP_200_OK,
    summary="Manager: approve or reject escalated application (final authority)",
)
@limiter.limit(_DECISION_LIMIT)
async def manager_decide_short(
    request: Request,
    application_id: UUID,
    payload: ManagerDecisionDTO,
    manager: User = Depends(require_role(RoleEnum.manager, RoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> DecisionResponse:
    """
    Manager/Admin final decision on an escalated application.
    Notes are mandatory. Action updates application status and appends to decisions + audit_log.
    """
    try:
        # Map ManagerDecisionDTO fields to manager_decide
        return await DecisionService(db).manager_decide(application_id, manager, payload)
    except DomainException as exc:
        _raise_domain(exc)


# ── POST /decisions/{id}/analyst ─────────────────────────────────────────────

@router.post(
    "/decisions/{application_id}/analyst",
    response_model=DecisionResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyst: approve or reject (score must be outside grey zone)",
)
@limiter.limit(_DECISION_LIMIT)
async def analyst_close(
    request: Request,
    application_id: UUID,
    payload: AnalystDecisionRequest,
    analyst: User = Depends(require_role(RoleEnum.analyst)),
    db: AsyncSession = Depends(get_db),
) -> DecisionResponse:
    """
    Analyst closes a non-escalated application.

    - **approve** — only allowed when score > 65
    - **reject** — only allowed when score < 45
    - Grey zone (45–65), fraud, or above manager threshold → **403 EscalationRequired**
    """
    try:
        return await DecisionService(db).analyst_close(application_id, analyst, payload)
    except DomainException as exc:
        _raise_domain(exc)


# ── POST /decisions/{id}/escalate ────────────────────────────────────────────

@router.post(
    "/decisions/{application_id}/escalate",
    response_model=DecisionResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyst: escalate to Bank Manager (notes required)",
)
@limiter.limit(_DECISION_LIMIT)
async def analyst_escalate(
    request: Request,
    application_id: UUID,
    notes: str = Body(..., min_length=10, max_length=2000, embed=True),
    analyst: User = Depends(require_role(RoleEnum.analyst)),
    db: AsyncSession = Depends(get_db),
) -> DecisionResponse:
    """
    Analyst escalates a grey-zone / fraud-flagged / above-threshold application.
    A written note (min 10 chars) is mandatory.
    """
    try:
        return await DecisionService(db).analyst_escalate(application_id, analyst, notes)
    except DomainException as exc:
        _raise_domain(exc)


# ── POST /decisions/{id}/manager ─────────────────────────────────────────────

@router.post(
    "/decisions/{application_id}/manager",
    response_model=DecisionResponse,
    status_code=status.HTTP_200_OK,
    summary="Manager: final approve or reject on escalated application (legacy endpoint)",
)
@limiter.limit(_DECISION_LIMIT)
async def manager_decide(
    request: Request,
    application_id: UUID,
    payload: ManagerDecisionRequest,
    manager: User = Depends(require_role(RoleEnum.manager, RoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> DecisionResponse:
    """
    Manager has final authority on escalated applications.
    Notes are mandatory.  Only approved or rejected decisions are accepted.
    """
    try:
        return await DecisionService(db).manager_decide(application_id, manager, payload)
    except DomainException as exc:
        _raise_domain(exc)


# ── PUT /applications/{id}/override ─────────────────────────────────────────

@router.put(
    "/applications/{application_id}/override",
    response_model=DecisionResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin: override any decision regardless of status",
)
@limiter.limit(_DECISION_LIMIT)
async def admin_override(
    request: Request,
    application_id: UUID,
    payload: AdminOverrideRequest,
    admin: User = Depends(require_role(RoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> DecisionResponse:
    """
    Admin-only.  Overrides any application decision regardless of current status.
    Old and new values are written to audit_log.
    """
    try:
        return await DecisionService(db).admin_override(application_id, admin, payload)
    except DomainException as exc:
        _raise_domain(exc)
