from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import create_access_token, create_refresh_token, hash_password, verify_password
from app.core.logger import logger
from app.enums import RoleEnum
from app.exceptions.domain import InvalidCredentialsException, ResourceAlreadyExistsException
from app.repositories.user_repository import UserRepository
from app.schemas.user import LoginRequest, RegisterRequest, TokenResponse, UserResponse


class AuthService:
    def __init__(self, session: AsyncSession):
        self.repository = UserRepository(session)
        self.session = session

    async def register(self, payload: RegisterRequest) -> UserResponse:
        if await self.repository.get_by_email(str(payload.email)):
            raise ResourceAlreadyExistsException("An account with this email already exists")
        user = await self.repository.create(name=payload.name, email=str(payload.email), password_hash=hash_password(payload.password), role=RoleEnum.applicant)
        
        # Auto-create RawApplicant profile linked to this user
        import uuid
        from decimal import Decimal
        from app.models.loan import RawApplicant
        applicant_ref = f"APP_{str(user.user_id)[:8].upper()}"
        self.session.add(
            RawApplicant(
                raw_applicant_id=uuid.uuid4(),
                applicant_ref=applicant_ref,
                name=user.name,
                pan_number="ABCDE1234F",
                phone="+919999999999",
                city="Mumbai",
                monthly_income_declared=Decimal("50000.00"),
                user_id=user.user_id,
            )
        )
        
        await self.session.commit()
        logger.info("registration_succeeded", extra={"user_id": str(user.user_id), "email": user.email})
        return UserResponse.model_validate(user)

    async def login(self, payload: LoginRequest) -> TokenResponse:
        user = await self.repository.get_by_email(str(payload.email))
        if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
            logger.warning("login_failed", extra={"email": str(payload.email)})
            raise InvalidCredentialsException()
        logger.info("login_succeeded", extra={"user_id": str(user.user_id), "email": user.email})
        return TokenResponse(access_token=create_access_token(user), refresh_token=create_refresh_token(user))
