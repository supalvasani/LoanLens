"""Application routes — submit, list, and full detail.

All business logic is in application_service.py.
Routes are HTTP-only: parse request, call service, return response.
Every route logs method + path + status + latency via main.py middleware.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, require_role
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.enums import ApplicationStatusEnum, RoleEnum
from app.exceptions.domain import DomainException
from app.models.user import User
from app.schemas.loan import (
    ApplicationWithMartDataResponse,
    LoanApplicationRequest,
    LoanApplicationResponse,
)
from app.services.application_service import ApplicationService

router = APIRouter(prefix="/applications", tags=["Applications"])


# ── POST /applications/apply ─────────────────────────────────────────────────

@router.post(
    "/apply",
    response_model=LoanApplicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a loan application (applicant only)",
)
@limiter.limit("5/minute")
async def apply_for_loan(
    request: Request,
    payload: LoanApplicationRequest,
    current_user: User = Depends(require_role(RoleEnum.applicant)),
    db: AsyncSession = Depends(get_db),
) -> LoanApplicationResponse:
    try:
        return await ApplicationService(db).create_application(current_user, payload)
    except DomainException as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# ── GET /applications ────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=list[LoanApplicationResponse],
    summary="List applications (role-filtered)",
)
@limiter.limit("60/minute")
async def list_applications(
    request: Request,
    status_filter: Optional[ApplicationStatusEnum] = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[LoanApplicationResponse]:
    """
    Role-based visibility:
    - **admin** → all applications
    - **manager** → escalated only
    - **analyst** → all non-escalated
    - **applicant** → own only
    """
    try:
        return await ApplicationService(db).list_applications(
            current_user,
            status=status_filter,
            limit=limit,
            offset=offset,
        )
    except DomainException as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# ── GET /applications/{id} ───────────────────────────────────────────────────

@router.get(
    "/{application_id}",
    response_model=ApplicationWithMartDataResponse,
    summary="Get full application + mart data",
)
@limiter.limit("60/minute")
async def get_application(
    request: Request,
    application_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApplicationWithMartDataResponse:
    """
    Returns the application plus all available mart data:
    credit score, fraud flags, eligibility, underwriter report, trend.

    Role gates are the same as GET /applications.
    """
    try:
        return await ApplicationService(db).get_application_full(
            application_id, current_user
        )
    except DomainException as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
