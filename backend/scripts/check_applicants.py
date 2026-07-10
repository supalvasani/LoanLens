import asyncio

from sqlalchemy import text

from app.core.database import SessionLocal


async def f():
    async with SessionLocal() as s:
        res = await s.execute(text("SELECT COUNT(*), COUNT(user_id) FROM raw_applicants"))
        print("Total applicants:", res.all())
        res = await s.execute(text("SELECT user_id, name, email FROM users"))
        print("Users:", res.all())

asyncio.run(f())
