"""Chatbot service — self mode (applicant) and analyst mode (staff).

Self mode:
  - applicant_id ALWAYS from JWT, never from request body
  - Fetches mart_credit_score, mart_loan_eligibility, mart_underwriter_report
  - Injects as context, calls LLM, returns plain-language answer

Analyst mode:
  - Available to analyst, manager, admin roles only
  - Accepts any applicant_id as input
  - Same mart data injection, richer context
"""
from __future__ import annotations

import json
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.clients.llm_client import call_llm
from app.core.logger import logger
from app.enums import RoleEnum
from app.models.user import User
from app.repositories.mart_repository import MartRepository

# ── System prompts ────────────────────────────────────────────────────────────

SELF_SYSTEM = """You are LoanBot, an AI assistant for LoanLens — an Indian NBFC credit platform.
You help loan applicants understand their own credit report, score, and eligibility.
Be warm, concise, and use simple language. Avoid jargon.
Always refer to INR amounts. If data is unavailable, say so clearly.
Never fabricate financial data."""

ANALYST_SYSTEM = """You are LoanBot in analyst mode for LoanLens — an Indian NBFC credit platform.
You help credit analysts and bank managers understand applicant credit reports.
Be precise, cite specific scores and ratios, and flag any anomalies.
Refer to INR amounts. If data is unavailable, say so clearly.
Never fabricate financial data."""


def _fmt_inr(val: float | None) -> str:
    if val is None:
        return "N/A"
    return f"₹{val:,.0f}"


def _build_context(
    *,
    score_row: dict | None,
    eligibility_rows: list[dict],
    underwriter_row: dict | None,
    risk_tier: str | None,
) -> str:
    """Build a concise text context block from mart data."""
    lines: list[str] = []

    if score_row:
        lines += [
            "=== CREDIT SCORE ===",
            f"Final Score: {score_row.get('score', 'N/A')}/100",
            f"Recommendation: {score_row.get('recommendation', 'N/A')}",
            f"Income Stability: {score_row.get('income_stability_score', 'N/A')}/100",
            f"EMI Burden:       {score_row.get('emi_burden_score', 'N/A')}/100",
            f"Bounce Rate:      {score_row.get('bounce_score', 'N/A')}/100",
            f"Balance Stability:{score_row.get('balance_score', 'N/A')}/100",
            f"Risk Tier:        {risk_tier or 'N/A'}",
        ]
        breakdown = score_row.get("score_breakdown_json")
        if breakdown:
            lines.append(f"Score Breakdown (JSON): {json.dumps(breakdown)}")
    else:
        lines.append("=== CREDIT SCORE: Not yet computed (run dbt pipeline) ===")

    if underwriter_row:
        lines += [
            "",
            "=== UNDERWRITER REPORT ===",
            f"Avg Monthly Income:   {_fmt_inr(float(underwriter_row.get('avg_monthly_income') or 0))}",
            f"EMI Burden Ratio:     {underwriter_row.get('emi_burden_ratio', 'N/A')}",
            f"Bounce Count:         {underwriter_row.get('bounce_count', 'N/A')}",
            f"Bounce Rate:          {underwriter_row.get('bounce_rate', 'N/A')}",
            f"Savings Potential:    {_fmt_inr(float(underwriter_row.get('savings_potential') or 0))}",
            f"Risk Segment:         {underwriter_row.get('risk_segment', 'N/A')}",
        ]
    else:
        lines.append("\n=== UNDERWRITER REPORT: Not yet computed ===")

    if eligibility_rows:
        lines.append("\n=== LOAN ELIGIBILITY ===")
        for row in eligibility_rows:
            lines.append(
                f"  {row.get('loan_type', '?')}: eligible={_fmt_inr(float(row.get('eligible_amount') or 0))} "
                f"| decision={row.get('decision', 'N/A')} | gap={row.get('gap_reason', 'none')}"
            )
    else:
        lines.append("\n=== LOAN ELIGIBILITY: Not yet computed ===")

    return "\n".join(lines)


class ChatbotService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.mart_repo = MartRepository(session)

    async def chat(
        self,
        current_user: User,
        question: str,
        target_applicant_id: str | None = None,
    ) -> str:
        """Route to self or analyst mode based on role.

        Args:
            current_user:          Authenticated user from JWT.
            question:              The user's natural language question.
            target_applicant_id:   Only honoured for analyst/manager/admin.
                                   Applicants always query their own data.
        """
        is_staff = current_user.role in (
            RoleEnum.analyst, RoleEnum.manager, RoleEnum.admin
        )

        if not is_staff:
            # Self mode — applicant_id from JWT, never from input
            return await self._self_mode(current_user, question)
        else:
            return await self._analyst_mode(current_user, question, target_applicant_id)

    # ── Self mode ─────────────────────────────────────────────────────────────

    async def _self_mode(self, current_user: User, question: str) -> str:
        # Look up raw_applicant for this user
        applicant_id = await self.mart_repo.get_applicant_id_for_user(current_user.user_id)

        score_row       = await self.mart_repo.get_credit_score(applicant_id) if applicant_id else None
        eligibility     = await self.mart_repo.get_loan_eligibility(applicant_id) if applicant_id else []
        underwriter     = await self.mart_repo.get_underwriter_report(applicant_id) if applicant_id else None
        risk_tier       = await self.mart_repo.get_risk_tier(applicant_id) if applicant_id else None

        context = _build_context(
            score_row=score_row,
            eligibility_rows=eligibility,
            underwriter_row=underwriter,
            risk_tier=risk_tier,
        )

        prompt = (
            f"Applicant's financial data:\n{context}\n\n"
            f"Applicant asks: {question}"
        )

        logger.info(
            "chatbot_self_mode",
            extra={"user_id": str(current_user.user_id), "has_mart_data": score_row is not None},
        )

        return await call_llm(prompt, system=SELF_SYSTEM)

    # ── Analyst mode ──────────────────────────────────────────────────────────

    async def _analyst_mode(
        self,
        current_user: User,
        question: str,
        target_applicant_id: str | None,
    ) -> str:
        if not target_applicant_id:
            return (
                "Please provide an applicant_id to query. "
                "Example: applicant_id=<UUID from raw_applicants>"
            )

        # Validate UUID format
        try:
            UUID(target_applicant_id)
        except ValueError:
            return "Invalid applicant_id format. Please provide a valid UUID."

        score_row   = await self.mart_repo.get_credit_score(target_applicant_id)
        eligibility = await self.mart_repo.get_loan_eligibility(target_applicant_id)
        underwriter = await self.mart_repo.get_underwriter_report(target_applicant_id)
        risk_tier   = await self.mart_repo.get_risk_tier(target_applicant_id)

        context = _build_context(
            score_row=score_row,
            eligibility_rows=eligibility,
            underwriter_row=underwriter,
            risk_tier=risk_tier,
        )

        prompt = (
            f"Applicant ID: {target_applicant_id}\n"
            f"Financial data:\n{context}\n\n"
            f"Staff query: {question}"
        )

        logger.info(
            "chatbot_analyst_mode",
            extra={
                "queried_by": str(current_user.user_id),
                "role": current_user.role.value,
                "target_applicant_id": target_applicant_id,
                "has_mart_data": score_row is not None,
            },
        )

        return await call_llm(prompt, system=ANALYST_SYSTEM)
