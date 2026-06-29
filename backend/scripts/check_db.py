"""Quick connectivity check against Postgres (uses DB_URL from .env / docker-compose)."""

import asyncio

import asyncpg

from scripts.db_config import get_db_params


async def check() -> None:
    params = get_db_params()
    host = str(params["host"])
    port = int(params["port"])
    user = str(params["user"])
    password = str(params["password"])
    database = str(params["database"])

    try:
        conn = await asyncpg.connect(host=host, port=port, user=user, password=password, database=database)
        version = await conn.fetchval("SELECT version()")
        tables = await conn.fetch(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        )
        print(f"Connected to {database}@{host}:{port}")
        print(f"PostgreSQL: {version[:60]}...")
        print("Tables:")
        for row in tables:
            print(f"  - {row['tablename']}")
        alembic = await conn.fetchval("SELECT version_num FROM alembic_version LIMIT 1")
        print(f"Alembic head: {alembic or '(not stamped)'}")
        await conn.close()
    except Exception as exc:
        print(f"Connection failed: {exc}")


if __name__ == "__main__":
    asyncio.run(check())
