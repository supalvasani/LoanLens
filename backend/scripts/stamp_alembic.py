"""
Stamp Alembic version when schema already exists.
Use only when tables were created outside Alembic and you need to sync version state.
"""

import asyncio

import asyncpg

from scripts.db_config import asyncpg_dsn, get_db_params

REVISION = "20260629_0002"


async def stamp() -> None:
    params = get_db_params()
    conn = await asyncpg.connect(asyncpg_dsn())
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS alembic_version (
                version_num VARCHAR(32) NOT NULL,
                CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
            )
            """
        )
        await conn.execute("DELETE FROM alembic_version")
        await conn.execute(
            "INSERT INTO alembic_version (version_num) VALUES ($1)",
            REVISION,
        )
        row = await conn.fetchrow("SELECT version_num FROM alembic_version")
        print(f"Alembic stamped at: {row['version_num']} ({params['database']}@{params['host']})")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(stamp())
