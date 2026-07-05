"""Analyst-specific routes.

All business logic lives in ApplicationService — routes are HTTP-only.
Every route is protected by @require_role(RoleEnum.analyst).
Request latency is logged by the global middleware in main.py.
"""
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_role
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.enums import LoanTypeEnum, RoleEnum
from app.exceptions.domain import DomainException
from app.models.user import User
from app.schemas.loan import AnalystQueueItem, ApplicationWithMartDataResponse
from app.services.application_service import ApplicationService

router = APIRouter(prefix="/analyst", tags=["Analyst"])

_QUEUE_LIMIT = "60/minute"


def _http(exc: DomainException) -> None:
    from fastapi import HTTPException
    raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


# ── GET /analyst/applications ─────────────────────────────────────────────────

@router.get(
    "/applications",
    response_model=list[AnalystQueueItem],
    status_code=status.HTTP_200_OK,
    summary="Analyst: enriched application queue with mart-data filters",
)
@limiter.limit(_QUEUE_LIMIT)
async def list_analyst_applications(
    request: Request,
    score_min: Optional[float] = Query(default=None, ge=0, le=100, description="Min credit score"),
    score_max: Optional[float] = Query(default=None, ge=0, le=100, description="Max credit score"),
    risk_segment: Optional[str] = Query(default=None, description="low | medium | high"),
    loan_type: Optional[LoanTypeEnum] = Query(default=None),
    recommendation: Optional[str] = Query(default=None, description="approve | review | reject"),
    sort_by: Literal["score", "submitted_at", "amount_requested"] = Query(default="submitted_at"),
    sort_dir: Literal["asc", "desc"] = Query(default="desc"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    analyst: User = Depends(require_role(RoleEnum.analyst)),
    db: AsyncSession = Depends(get_db),
) -> list[AnalystQueueItem]:
    """
    Returns all non-escalated applications enriched with mart data.

    Supports filters:
    - **score_min / score_max** — credit score range
    - **risk_segment** — low / medium / high
    - **loan_type** — any valid LoanTypeEnum value
    - **recommendation** — approve / review / reject

    Supports sorting by **score**, **submitted_at**, **amount_requested**.
    Rate limited to **60/minute**.
    """
    try:
        return await ApplicationService(db).list_analyst_queue(
            analyst,
            score_min=score_min,
            score_max=score_max,
            risk_segment=risk_segment,
            loan_type=loan_type,
            recommendation=recommendation,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )
    except DomainException as exc:
        _http(exc)


# ── GET /analyst/applications/{id} ───────────────────────────────────────────

@router.get(
    "/applications/{application_id}",
    response_model=ApplicationWithMartDataResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyst: full credit report for one applicant",
)
@limiter.limit(_QUEUE_LIMIT)
async def get_analyst_application(
    request: Request,
    application_id: UUID,
    analyst: User = Depends(require_role(RoleEnum.analyst)),
    db: AsyncSession = Depends(get_db),
) -> ApplicationWithMartDataResponse:
    """
    Returns the full application with all mart data:
    credit score breakdown, underwriter report, fraud flags,
    eligibility for all 6 loan types, monthly trend (6 months),
    and previous decision history.

    The analyst role gate is enforced in the service layer —
    escalated applications return 403.

    Rate limited to **60/minute**.
    """
    try:
        return await ApplicationService(db).get_application_full(
            str(application_id), analyst
        )
    except DomainException as exc:
        _http(exc)
