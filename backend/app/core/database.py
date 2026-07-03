from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator

from app.core.config import settings

# Create async engine
engine = create_async_engine(
    settings.DB_URL,
    echo=settings.APP_ENV == "development",
    connect_args={
        "server_settings": {
            "search_path": "public,public_staging,public_intermediate,public_marts"
        }
    },
)

# Create session factory
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Declarative base for SQLAlchemy 2.x ORM models
class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function to get a database session.
    Yields an AsyncSession and ensures it's safely closed afterward.
    """
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
