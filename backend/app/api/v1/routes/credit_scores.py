"""Credit score routes — GET /credit-scores/me and /credit-scores/me/trend.

Applicant-only. applicant_id is always resolved from JWT via raw_applicants.
No applicant_id is accepted in the request body or URL.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_role
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.enums import RoleEnum
from app.models.user import User
from app.repositories.mart_repository import MartRepository

router = APIRouter(prefix="/credit-scores", tags=["Credit Scores"])


# ── Response DTOs ─────────────────────────────────────────────────────────────

class ScoreComponentDTO(BaseModel):
    key: str
    label: str
    description: str
    weight_pct: int
    score: float | None


class CreditScoreResponse(BaseModel):
    applicant_id: str | None
    score: float | None
    risk_tier: str | None
    recommendation: str | None
    components: list[ScoreComponentDTO]
    computed_at: datetime | None
    has_data: bool


class TrendPointDTO(BaseModel):
    month: str | None
    score: float | None
    trend_direction: str | None


class CreditTrendResponse(BaseModel):
    trend: list[TrendPointDTO]
    has_data: bool


# ── Helper ────────────────────────────────────────────────────────────────────

COMPONENT_META = [
    {
        "key": "income_stability_score",
        "label": "Income Stability",
        "description": "How consistent is your income",
        "weight_pct": 30,
    },
    {
        "key": "emi_burden_score",
        "label": "EMI Burden",
        "description": "How much of your income goes to EMIs",
        "weight_pct": 25,
    },
    {
        "key": "bounce_score",
        "label": "Payment Reliability",
        "description": "How often your payments fail",
        "weight_pct": 25,
    },
    {
        "key": "balance_score",
        "label": "Balance Management",
        "description": "How well you maintain your balance",
        "weight_pct": 20,
    },
]


def _build_components(raw: dict[str, Any]) -> list[ScoreComponentDTO]:
    return [
        ScoreComponentDTO(
            key=m["key"],
            label=m["label"],
            description=m["description"],
            weight_pct=m["weight_pct"],
            score=raw.get(m["key"]),
        )
        for m in COMPONENT_META
    ]


async def _resolve_applicant_id(user: User, mart: MartRepository) -> str | None:
    """Look up raw_applicant_id for the JWT user. Returns None if not found."""
    apid = await mart.get_applicant_id_for_user(user.user_id)
    return str(apid) if apid else None


# ── GET /credit-scores/me ─────────────────────────────────────────────────────

@router.get(
    "/me",
    response_model=CreditScoreResponse,
    status_code=status.HTTP_200_OK,
    summary="Get own credit score breakdown (applicant only)",
)
@limiter.limit("60/minute")
async def get_my_credit_score(
    request: Request,
    current_user: User = Depends(require_role(RoleEnum.applicant)),
    db: AsyncSession = Depends(get_db),
) -> CreditScoreResponse:
    """
    Returns the mart_credit_score for the authenticated applicant.
    Returns `has_data: false` if the dbt pipeline hasn't run yet — never 404.
    """
    mart = MartRepository(db)
    applicant_id = await _resolve_applicant_id(current_user, mart)

    if not applicant_id:
        return CreditScoreResponse(
            applicant_id=None,
            score=None,
            risk_tier=None,
            recommendation=None,
            components=[
                ScoreComponentDTO(key=m["key"], label=m["label"],
                                  description=m["description"],
                                  weight_pct=m["weight_pct"], score=None)
                for m in COMPONENT_META
            ],
            computed_at=None,
            has_data=False,
        )

    from uuid import UUID
    raw = await mart.get_credit_score(UUID(applicant_id))
    risk_tier = await mart.get_risk_tier(UUID(applicant_id))

    if not raw:
        return CreditScoreResponse(
            applicant_id=applicant_id,
            score=None,
            risk_tier=risk_tier,
            recommendation=None,
            components=[
                ScoreComponentDTO(key=m["key"], label=m["label"],
                                  description=m["description"],
                                  weight_pct=m["weight_pct"], score=None)
                for m in COMPONENT_META
            ],
            computed_at=None,
            has_data=False,
        )

    return CreditScoreResponse(
        applicant_id=applicant_id,
        score=raw.get("score"),
        risk_tier=risk_tier,
        recommendation=raw.get("recommendation"),
        components=_build_components(raw),
        computed_at=raw.get("computed_at"),
        has_data=True,
    )


# ── GET /credit-scores/me/trend ───────────────────────────────────────────────

@router.get(
    "/me/trend",
    response_model=CreditTrendResponse,
    status_code=status.HTTP_200_OK,
    summary="Get own 6-month credit score trend (applicant only)",
)
@limiter.limit("60/minute")
async def get_my_credit_trend(
    request: Request,
    current_user: User = Depends(require_role(RoleEnum.applicant)),
    db: AsyncSession = Depends(get_db),
) -> CreditTrendResponse:
    """
    Returns the last 6 months from mart_monthly_credit_trend.
    Returns `has_data: false` if the dbt pipeline hasn't run yet.
    """
    mart = MartRepository(db)
    applicant_id = await _resolve_applicant_id(current_user, mart)

    if not applicant_id:
        return CreditTrendResponse(trend=[], has_data=False)

    from uuid import UUID
    rows = await mart.get_monthly_trend(UUID(applicant_id))

    return CreditTrendResponse(
        trend=[TrendPointDTO(**r) for r in rows],
        has_data=len(rows) > 0,
    )
