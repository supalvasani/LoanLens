from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import bcrypt as _bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.enums import RoleEnum
from app.models.user import User
from app.repositories.user_repository import UserRepository

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _bcrypt.checkpw(password.encode(), password_hash.encode())
    except Exception:
        return False



def _create_token(user: User, *, secret: str, expires_delta: timedelta, token_type: str) -> str:
    now = datetime.now(UTC)
    payload = {"user_id": str(user.user_id), "role": user.role.value, "type": token_type, "iat": now, "exp": now + expires_delta}
    return jwt.encode(payload, secret, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user: User) -> str:
    return _create_token(user, secret=settings.JWT_SECRET, expires_delta=timedelta(hours=settings.JWT_EXPIRY_HOURS), token_type="access")


def create_refresh_token(user: User) -> str:
    return _create_token(user, secret=settings.REFRESH_TOKEN_SECRET, expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRY_DAYS), token_type="refresh")


def decode_token(token: str, *, refresh: bool = False) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.REFRESH_TOKEN_SECRET if refresh else settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        expected_type = "refresh" if refresh else "access"
        if payload.get("type") != expected_type or not payload.get("user_id") or not payload.get("role"):
            raise ValueError("Invalid token claims")
        return payload
    except (JWTError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token", headers={"WWW-Authenticate": "Bearer"}) from exc


async def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(security), db: AsyncSession = Depends(get_db)) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})
    payload = decode_token(credentials.credentials)
    user = await UserRepository(db).get_by_id(UUID(payload["user_id"]))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive or no longer exists")
    return user


def require_role(*roles: RoleEnum) -> Callable:
    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return dependency
