"""Analyst-specific routes.

All business logic lives in ApplicationService — routes are HTTP-only.
Every route is protected by @require_role(RoleEnum.analyst).
Request latency is logged by the global middleware in main.py.
"""
from typing import Annotated, Literal
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
    status_code=status.HTTP_200_OK,
    summary="Analyst: enriched application queue with mart-data filters",
)
@limiter.limit(_QUEUE_LIMIT)
async def list_analyst_applications(
    request: Request,
    analyst: Annotated[User, Depends(require_role(RoleEnum.analyst))],
    db: Annotated[AsyncSession, Depends(get_db)],
    score_min: Annotated[float | None, Query(default=None, ge=0, le=100, description="Min credit score")] = None,
    score_max: Annotated[float | None, Query(default=None, ge=0, le=100, description="Max credit score")] = None,
    risk_segment: Annotated[str | None, Query(default=None, description="low | medium | high")] = None,
    loan_type: Annotated[LoanTypeEnum | None, Query(default=None)] = None,
    recommendation: Annotated[str | None, Query(default=None, description="approve | review | reject")] = None,
    sort_by: Annotated[Literal["score", "submitted_at", "amount_requested"], Query(default="submitted_at")] = "submitted_at",
    sort_dir: Annotated[Literal["asc", "desc"], Query(default="desc")] = "desc",
    limit: Annotated[int, Query(default=50, ge=1, le=200)] = 50,
    offset: Annotated[int, Query(default=0, ge=0)] = 0,
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
    status_code=status.HTTP_200_OK,
    summary="Analyst: full credit report for one applicant",
)
@limiter.limit(_QUEUE_LIMIT)
async def get_analyst_application(
    request: Request,
    application_id: UUID,
    analyst: Annotated[User, Depends(require_role(RoleEnum.analyst))],
    db: Annotated[AsyncSession, Depends(get_db)],
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
