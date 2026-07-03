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


from decimal import Decimal
from fastapi import APIRouter, Depends, Query, Request, status, File, Form, UploadFile
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from app.enums import LoanTypeEnum

class MyLoanApplicationResponse(BaseModel):
    application_id: UUID
    loan_type: LoanTypeEnum
    amount_requested: Decimal
    status: ApplicationStatusEnum
    submitted_at: datetime
    primary_rejection_reason: str | None


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
    loan_type: Optional[LoanTypeEnum] = Form(None),
    amount_requested: Optional[Decimal] = Form(None),
    purpose: Optional[str] = Form(None),
    bank_statement_csv: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_role(RoleEnum.applicant)),
    db: AsyncSession = Depends(get_db),
) -> LoanApplicationResponse:
    content_type = request.headers.get("content-type", "")
    if "application/json" in content_type:
        payload = await request.json()
        loan_type_val = LoanTypeEnum(payload.get("loan_type"))
        amount_requested_val = Decimal(str(payload.get("amount_requested")))
        purpose_val = payload.get("purpose")
        file_val = None
    else:
        from fastapi import HTTPException
        if not loan_type or not amount_requested or not purpose:
            raise HTTPException(status_code=400, detail="Missing required form fields")
        loan_type_val = loan_type
        amount_requested_val = amount_requested
        purpose_val = purpose
        file_val = bank_statement_csv

    try:
        return await ApplicationService(db).create_application_with_file(
            current_user=current_user,
            loan_type=loan_type_val,
            amount_requested=amount_requested_val,
            purpose=purpose_val,
            file=file_val,
        )
    except DomainException as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# ── GET /applications/my ─────────────────────────────────────────────────────

@router.get(
    "/my",
    response_model=list[MyLoanApplicationResponse],
    summary="Get own applications only (applicant only)",
)
@limiter.limit("60/minute")
async def get_my_applications_route(
    request: Request,
    current_user: User = Depends(require_role(RoleEnum.applicant)),
    db: AsyncSession = Depends(get_db),
) -> list[MyLoanApplicationResponse]:
    try:
        res = await ApplicationService(db).get_my_applications(current_user)
        return [MyLoanApplicationResponse(**r) for r in res]
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
