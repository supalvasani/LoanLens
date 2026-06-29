"""Seed the four Phase 0 test users. Idempotent — skips existing emails."""

import asyncio
import uuid

from app.core.database import SessionLocal
from app.enums import RoleEnum
from app.repositories.user_repository import UserRepository

SEED_USERS = [
    {
        "user_id": uuid.UUID("a0000000-0000-4000-8000-000000000001"),
        "name": "Super Admin",
        "email": "admin@loanlens.in",
        "password_hash": "$2b$12$vEJadtHeHvbMr7iykHnDeOnN1PSWEIbj.ZQfbA.mt1oxK36YGIYTm",
        "role": RoleEnum.admin,
    },
    {
        "user_id": uuid.UUID("a0000000-0000-4000-8000-000000000002"),
        "name": "Rajesh Manager",
        "email": "manager@loanlens.in",
        "password_hash": "$2b$12$HoCTUdSQ5diiHFL0KVefQu1YHQises2.EJRpAklSogs8hVQBo2Cpu",
        "role": RoleEnum.manager,
    },
    {
        "user_id": uuid.UUID("a0000000-0000-4000-8000-000000000003"),
        "name": "Priya Analyst",
        "email": "analyst@loanlens.in",
        "password_hash": "$2b$12$gsK/zxzCg5YYE9tIx4JV5OiDGF3gQdx7XBuXfSoVnSqEir9rxsqcy",
        "role": RoleEnum.analyst,
    },
    {
        "user_id": uuid.UUID("a0000000-0000-4000-8000-000000000004"),
        "name": "Amit Applicant",
        "email": "applicant@loanlens.in",
        "password_hash": "$2b$12$PVuycFCsDVw0AgJQhQVTx.2XhKQL9KNGLbCkTpx8D2s4InoiRvCpa",
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

            session.add(
                User(
                    user_id=entry["user_id"],
                    name=entry["name"],
                    email=entry["email"],
                    password_hash=entry["password_hash"],
                    role=entry["role"],
                    is_active=True,
                )
            )
            created += 1
        if created:
            await session.commit()
            print(f"Seeded {created} user(s)")
        else:
            print("Seed users already present — skipped")


if __name__ == "__main__":
    asyncio.run(seed())
