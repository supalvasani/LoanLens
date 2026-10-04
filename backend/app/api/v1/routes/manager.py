from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_role
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.enums import LoanTypeEnum, RoleEnum
from app.exceptions.domain import DomainException
from app.models.user import User
from app.schemas.loan import (
    ConfigUpdateDTO,
    LoanTypeConfigResponse,
    ManagerApplicationResponse,
    ManagerQueueItem,
    PortfolioDTO,
)
from app.services.manager_service import ManagerService

router = APIRouter(prefix="/manager", tags=["Manager"])

def _raise_http(exc: DomainException) -> None:
    from fastapi import HTTPException
    raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# ── GET /manager/queue ────────────────────────────────────────────────────────

@router.get(
    "/queue",
    status_code=status.HTTP_200_OK,
    summary="Manager: view escalation queue sorted by priority",
)
@limiter.limit("60/minute")
async def get_manager_queue(
    request: Request,
    manager: Annotated[User, Depends(require_role(RoleEnum.manager))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[ManagerQueueItem]:
    try:
        return await ManagerService(db).list_queue(manager)
    except DomainException as exc:
        _raise_http(exc)


# ── GET /manager/applications/{application_id} ────────────────────────────────

@router.get(
    "/applications/{application_id}",
    status_code=status.HTTP_200_OK,
    summary="Manager: view full credit report for escalated application",
)
@limiter.limit("60/minute")
async def get_escalated_application(
    request: Request,
    application_id: UUID,
    manager: Annotated[User, Depends(require_role(RoleEnum.manager))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ManagerApplicationResponse:
    try:
        return await ManagerService(db).get_application(application_id, manager)
    except DomainException as exc:
        _raise_http(exc)


# ── GET /manager/portfolio ───────────────────────────────────────────────────

@router.get(
    "/portfolio",
    status_code=status.HTTP_200_OK,
    summary="Manager/Admin: view portfolio aggregated analytics",
)
@limiter.limit("60/minute")
async def get_portfolio_analytics(
    request: Request,
    manager: Annotated[User, Depends(require_role(RoleEnum.manager, RoleEnum.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PortfolioDTO:
    try:
        return await ManagerService(db).get_portfolio_analytics(manager)
    except DomainException as exc:
        _raise_http(exc)


# ── GET /manager/config ───────────────────────────────────────────────────────

@router.get(
    "/config",
    status_code=status.HTTP_200_OK,
    summary="Manager: view current loan type configurations",
)
@limiter.limit("120/minute")
async def list_loan_configs(
    request: Request,
    manager: Annotated[User, Depends(require_role(RoleEnum.manager))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[LoanTypeConfigResponse]:
    try:
        return await ManagerService(db).list_configs(manager)
    except DomainException as exc:
        _raise_http(exc)


# ── PUT /manager/config/{loan_type} ───────────────────────────────────────────

@router.put(
    "/config/{loan_type}",
    status_code=status.HTTP_200_OK,
    summary="Manager: update specific loan type thresholds",
)
@limiter.limit("120/minute")
async def update_loan_config(
    request: Request,
    loan_type: LoanTypeEnum,
    payload: ConfigUpdateDTO,
    manager: Annotated[User, Depends(require_role(RoleEnum.manager))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> LoanTypeConfigResponse:
    try:
        return await ManagerService(db).update_config(loan_type, manager, payload)
    except DomainException as exc:
        _raise_http(exc)
