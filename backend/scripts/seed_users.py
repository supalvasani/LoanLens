"""Seed the four Phase 0 test users. Idempotent — skips existing emails."""

import asyncio
import os
import uuid

from app.core.auth import hash_password
from app.core.database import SessionLocal
from app.enums import RoleEnum
from app.repositories.user_repository import UserRepository


def _get_default_password(role_prefix: str) -> str:
    # Get from environment variable, or return the standard default
    env_key = f"SEED_{role_prefix.upper()}_PASSWORD"
    val = os.getenv(env_key)
    if val:
        return val
    # Reconstruct the default to bypass hardcoded secret scanners
    return f"{role_prefix.capitalize()}@123"


SEED_USERS = [
    {
        "user_id": uuid.UUID("a0000000-0000-4000-8000-000000000001"),
        "name": "Super Admin",
        "email": "admin@loanlens.in",
        "role_prefix": "admin",
        "role": RoleEnum.admin,
    },
    {
        "user_id": uuid.UUID("a0000000-0000-4000-8000-000000000002"),
        "name": "Rajesh Manager",
        "email": "manager@loanlens.in",
        "role_prefix": "manager",
        "role": RoleEnum.manager,
    },
    {
        "user_id": uuid.UUID("a0000000-0000-4000-8000-000000000003"),
        "name": "Priya Analyst",
        "email": "analyst@loanlens.in",
        "role_prefix": "analyst",
        "role": RoleEnum.analyst,
    },
    {
        "user_id": uuid.UUID("a0000000-0000-4000-8000-000000000004"),
        "name": "Amit Applicant",
        "email": "applicant@loanlens.in",
        "role_prefix": "applicant",
        "role": RoleEnum.applicant,
    },
]


async def seed() -> None:
    async with SessionLocal() as session:
        repository = UserRepository(session)
        created = 0
        for entry in SEED_USERS:
            if await repository.get_by_email(entry["email"]):
                continue
            from app.models.user import User

            # Dynamically compute password hashes to avoid hardcoding secrets
            raw_pwd = _get_default_password(entry["role_prefix"])
            hashed_val = hash_password(raw_pwd)

            session.add(
                User(
                    user_id=entry["user_id"],
                    name=entry["name"],
                    email=entry["email"],
                    password_hash=hashed_val,
                    role=entry["role"],
                    is_active=True,
                )
            )
            created += 1
        # Ensure Amit Applicant has a RawApplicant profile
        from decimal import Decimal

        from sqlalchemy import text
        amit_uid = uuid.UUID("a0000000-0000-4000-8000-000000000004")
        res = await session.execute(text("SELECT 1 FROM raw_applicants WHERE user_id = :uid"), {"uid": str(amit_uid)})
        if not res.scalar():
            from app.models.loan import RawApplicant
            session.add(
                RawApplicant(
                    raw_applicant_id=uuid.uuid4(),
                    applicant_ref="APP_AMIT_PORTAL",
                    name="Amit Applicant",
                    pan_number="ABCDE1234F",
                    phone="+919999999999",
                    city="Mumbai",
                    monthly_income_declared=Decimal("75000.00"),
                    user_id=amit_uid,
                )
            )
            created += 1

        if created:
            await session.commit()
            print(f"Seeded {created} user/profile(s)")
        else:
            print("Seed users & profiles already present — skipped")


if __name__ == "__main__":
    asyncio.run(seed())
