from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, create_refresh_token, decode_token
from app.core.database import get_db
from app.exceptions.domain import DomainException
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import LoginRequest, RefreshTokenRequest, RegisterRequest, TokenResponse, UserResponse
from app.core.rate_limit import limiter
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> UserResponse:
    try:
        return await AuthService(db).register(payload)
    except DomainException as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    try:
        return await AuthService(db).login(payload)
    except DomainException as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: Request, payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    claims = decode_token(payload.refresh_token, refresh=True)
    user = await UserRepository(db).get_by_id(UUID(claims["user_id"]))
    if user is None or not user.is_active:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="User is inactive or no longer exists")
    return TokenResponse(access_token=create_access_token(user), refresh_token=create_refresh_token(user))
