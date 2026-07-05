"""Pydantic v2 DTOs for loan applications, decisions, and loan-type config."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator  # field_validator used by ManagerDecisionRequest

from app.enums import ApplicationStatusEnum, DecisionEnum, LoanTypeEnum


# ── Loan Application ─────────────────────────────────────────────────────────

class LoanApplicationRequest(BaseModel):
    loan_type: LoanTypeEnum
    amount_requested: Decimal = Field(gt=0, decimal_places=2)
    purpose: str = Field(min_length=10, max_length=1000)

    @field_validator("amount_requested")
    @classmethod
    def amount_must_be_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount_requested must be greater than zero")
        return v


class LoanApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    application_id: UUID
    user_id: UUID
    loan_type: LoanTypeEnum
    amount_requested: Decimal
    purpose: str
    status: ApplicationStatusEnum
    submitted_at: datetime


# ── Mart data sub-schemas (returned alongside application) ───────────────────

class CreditScoreData(BaseModel):
    applicant_id: UUID | None = None
    score: float | None = None
    income_stability_score: float | None = None
    emi_burden_score: float | None = None
    bounce_score: float | None = None
    balance_score: float | None = None
    recommendation: str | None = None
    score_breakdown_json: dict[str, Any] | None = None
    computed_at: datetime | None = None


class FraudFlagData(BaseModel):
    flag_type: str
    flag_detail: str
    severity: str
    detected_at: datetime | None = None


class LoanEligibilityData(BaseModel):
    loan_type: str
    eligible_amount: Decimal | None = None
    applied_amount: Decimal | None = None
    gap_amount: Decimal | None = None
    gap_reason: str | None = None
    decision: str | None = None


class UnderwriterReportData(BaseModel):
    avg_monthly_income: Decimal | None = None
    emi_burden_ratio: float | None = None
    bounce_count: int | None = None
    bounce_rate: float | None = None
    savings_potential: Decimal | None = None
    fraud_flags: list[dict[str, Any]] = Field(default_factory=list)
    risk_segment: str | None = None


class MonthlyTrendPoint(BaseModel):
    month: date | str | None = None
    score: float | None = None
    trend_direction: str | None = None


class ApplicationWithMartDataResponse(BaseModel):
    """Full application response with all mart data joined."""
    application: LoanApplicationResponse
    credit_score: CreditScoreData | None = None
    fraud_flags: list[FraudFlagData] = Field(default_factory=list)
    eligibility: list[LoanEligibilityData] = Field(default_factory=list)
    underwriter_report: UnderwriterReportData | None = None
    monthly_trend: list[MonthlyTrendPoint] = Field(default_factory=list)
    risk_tier: str | None = None
    decisions: list["DecisionResponse"] = Field(default_factory=list)


# ── Analyst Queue (enriched flat row) ────────────────────────────────────────

class AnalystQueueItem(BaseModel):
    """Flat enriched row for the analyst application queue.

    Combines raw_loan_applications with mart credit score, risk, fraud flag
    summary so the analyst doesn't need a separate round-trip per row.
    """
    application_id: UUID
    applicant_name: str | None = None          # from raw_applicants if available
    loan_type: LoanTypeEnum
    amount_requested: Decimal
    purpose: str
    status: ApplicationStatusEnum
    submitted_at: datetime
    score: float | None = None                 # mart_credit_score.score
    risk_tier: str | None = None               # mart_risk_segmentation.risk_tier
    recommendation: str | None = None          # mart_credit_score.recommendation
    has_fraud_flags: bool = False              # True if any row in mart_fraud_flags


# ── Decision ─────────────────────────────────────────────────────────────────

class AnalystDecisionRequest(BaseModel):
    """Used by analyst for close (approve/reject).

    Notes are optional for approve/reject; mandatory for escalation is
    enforced in the service layer via the dedicated escalate endpoint.
    """
    decision: DecisionEnum
    notes: str | None = Field(default=None, max_length=2000)


class ManagerDecisionRequest(BaseModel):
    """Manager approve or reject — notes always required."""
    decision: DecisionEnum = Field(..., description="approved or rejected only")
    notes: str = Field(min_length=10, max_length=2000)

    @field_validator("decision")
    @classmethod
    def manager_cannot_escalate(cls, v: DecisionEnum) -> DecisionEnum:
        if v == DecisionEnum.escalated:
            raise ValueError("Manager must approve or reject, not escalate")
        return v


class AdminOverrideRequest(BaseModel):
    """Admin override — decision + mandatory explanation."""
    decision: DecisionEnum
    notes: str = Field(min_length=10, max_length=2000)


class DecisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    decision_id: UUID
    application_id: UUID
    decided_by: UUID
    decision: DecisionEnum
    notes: str | None
    escalated_to: UUID | None
    decided_at: datetime


# ── Loan Type Config ──────────────────────────────────────────────────────────

class LoanTypeConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    loan_type_id: int
    loan_type: LoanTypeEnum
    min_score: int
    max_amount: Decimal
    manager_threshold_amount: Decimal
    approve_threshold: int
    review_lower: int
    review_upper: int
    updated_by: UUID | None
    updated_at: datetime


class LoanTypeConfigUpdateRequest(BaseModel):
    """All fields optional — only provided fields are updated."""
    min_score: int | None = Field(default=None, ge=0, le=100)
    max_amount: Decimal | None = Field(default=None, gt=0)
    manager_threshold_amount: Decimal | None = Field(default=None, gt=0)
    approve_threshold: int | None = Field(default=None, ge=0, le=100)
    review_lower: int | None = Field(default=None, ge=0, le=100)
    review_upper: int | None = Field(default=None, ge=0, le=100)
