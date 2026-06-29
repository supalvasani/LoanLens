import asyncio
import os

from app.core.auth import hash_password
from app.core.database import SessionLocal
from app.enums import RoleEnum
from app.repositories.user_repository import UserRepository


async def seed() -> None:
    email = os.getenv("ADMIN_EMAIL", "admin@loanlens.local")
    password = os.getenv("ADMIN_PASSWORD", "ChangeMeNow123!")
    async with SessionLocal() as session:
        repository = UserRepository(session)
        if await repository.get_by_email(email):
            print(f"Admin already exists: {email}")
            return
        await repository.create(name=os.getenv("ADMIN_NAME", "LoanLens Admin"), email=email, password_hash=hash_password(password), role=RoleEnum.admin)
        await session.commit()
        print(f"Admin created: {email}")


if __name__ == "__main__":
    asyncio.run(seed())
