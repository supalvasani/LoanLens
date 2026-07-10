"""Eligibility route — GET /eligibility/me.

Applicant-only. applicant_id always from JWT — never from URL or body.
Returns all 6 loan types with eligibility data from mart_loan_eligibility.
Gracefully returns empty list when dbt hasn't run yet.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_role
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.enums import RoleEnum
from app.models.user import User
from app.repositories.mart_repository import MartRepository

router = APIRouter(prefix="/eligibility", tags=["Eligibility"])

# ── Plain-language gap reason mapping ────────────────────────────────────────

GAP_REASON_LABELS: dict[str, str] = {
    "low_score":             "Credit score is below the minimum threshold for this product",
    "high_emi_burden":       "Existing EMI commitments exceed the allowed FOIR ceiling",
    "high_bounce_rate":      "Too many payment failures or bounced transactions in recent months",
    "insufficient_income":   "Detected income is too low for this loan amount",
    "fraud_flag":            "Account has been flagged for suspicious activity",
    "below_min_amount":      "Requested amount is below the product minimum",
    "above_max_amount":      "Requested amount exceeds your eligible limit",
    "insufficient_data":     "Less than the required months of bank statement data — eligible amount is indicative only",
    "low_income_stability":  "Income has high variability across months — stability score below threshold",
}

LOAN_TYPE_LABELS: dict[str, str] = {
    "home_loan":       "Home Loan",
    "personal_loan":   "Personal Loan",
    "business_loan":   "Business Loan",
    "auto_loan":       "Auto Loan",
    "vehicle_loan":    "Vehicle Loan",
    "education_loan":  "Education Loan",
    "two_wheeler_loan":"Two-Wheeler Loan",
    "gold_loan":       "Gold Loan",
}


# ── Response DTOs ─────────────────────────────────────────────────────────────

class EligibilityItemDTO(BaseModel):
    loan_type: str
    loan_type_label: str
    eligible_amount: Decimal | None
    applied_amount: Decimal | None
    gap_amount: Decimal | None
    gap_reason: str | None          # raw code
    gap_reason_label: str | None    # plain English
    decision: str | None            # "eligible" | "ineligible" | "partial"


class EligibilityResponse(BaseModel):
    items: list[EligibilityItemDTO]
    has_data: bool
    best_eligible_amount: Decimal | None   # highest eligible amount across all types


# ── GET /eligibility/me ───────────────────────────────────────────────────────

@router.get(
    "/me",
    status_code=status.HTTP_200_OK,
    summary="Get own loan eligibility across all types (applicant only)",
)
@limiter.limit("60/minute")
async def get_my_eligibility(
    request: Request,
    current_user: Annotated[User, Depends(require_role(RoleEnum.applicant))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EligibilityResponse:
    """
    Returns mart_loan_eligibility for the authenticated applicant across
    all available loan types. Returns `has_data: false` when dbt hasn't run.
    """
    mart = MartRepository(db)
    applicant_id = await mart.get_applicant_id_for_user(current_user.user_id)

    if not applicant_id:
        return EligibilityResponse(items=[], has_data=False, best_eligible_amount=None)

    rows = await mart.get_loan_eligibility(applicant_id)

    if not rows:
        return EligibilityResponse(items=[], has_data=False, best_eligible_amount=None)

    items = [
        EligibilityItemDTO(
            loan_type=r["loan_type"],
            loan_type_label=LOAN_TYPE_LABELS.get(r["loan_type"], r["loan_type"].replace("_", " ").title()),
            eligible_amount=r.get("eligible_amount"),
            applied_amount=r.get("applied_amount"),
            gap_amount=r.get("gap_amount"),
            gap_reason=r.get("gap_reason"),
            gap_reason_label=GAP_REASON_LABELS.get(r.get("gap_reason") or "", r.get("gap_reason")),
            decision=(
                "eligible" if r.get("decision") == "approve"
                else "ineligible" if r.get("decision") == "reject"
                else r.get("decision")
            ),
        )
        for r in rows
    ]

    best = max(
        (i.eligible_amount for i in items if i.eligible_amount is not None),
        default=None,
    )

    return EligibilityResponse(items=items, has_data=True, best_eligible_amount=best)
