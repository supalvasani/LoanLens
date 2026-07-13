"""Chatbot route — POST /chatbot.

Dispatches to self-mode (applicant) or analyst-mode (staff) based on JWT role.
Rate limited to 10/minute per spec.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.logger import logger
from app.core.rate_limit import limiter
from app.exceptions.domain import DomainException
from app.models.user import User
from app.services.chatbot_service import ChatbotService

router = APIRouter(prefix="/chatbot", tags=["Chatbot"])


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    applicant_id: str | None = Field(
        default=None,
        description="Only honoured for analyst/manager/admin roles",
    )


class ChatResponse(BaseModel):
    answer: str
    mode: str  # "self" or "analyst"


@router.post(
    "",
    status_code=status.HTTP_200_OK,
    summary="Ask LoanBot a question about credit report and eligibility",
    responses={
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "description": "LoanBot is temporarily unavailable. Please try again shortly.",
        },
    },
)
@limiter.limit("10/minute")
async def chat(
    request: Request,
    payload: ChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ChatResponse:
    """
    - **Applicant role**: applicant_id is always taken from JWT (self mode).
      `applicant_id` field in body is silently ignored.
    - **Analyst / Manager / Admin**: `applicant_id` must be provided to query
      any applicant's data (analyst mode).

    Rate limited to **10 requests/minute**.
    """
    try:
        service = ChatbotService(db)
        answer = await service.chat(
            current_user=current_user,
            question=payload.question,
            target_applicant_id=payload.applicant_id,
        )
    except DomainException as exc:
        logger.warning(
            "chatbot_domain_error",
            extra={"user_id": str(current_user.user_id), "error": exc.message},
        )
        raise
    except RuntimeError as exc:
        logger.error("chatbot_llm_error", extra={"error": str(exc)})
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail="LoanBot is temporarily unavailable. Please try again shortly.",
        )

    from app.enums import RoleEnum
    mode = "self" if current_user.role == RoleEnum.applicant else "analyst"

    return ChatResponse(answer=answer, mode=mode)
