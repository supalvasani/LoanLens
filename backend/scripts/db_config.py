"""Parse database connection settings from the same DB_URL the API uses."""

from __future__ import annotations

from urllib.parse import urlparse


def _normalize_url(url: str) -> str:
    for prefix in ("postgresql+asyncpg://", "postgresql+psycopg2://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql://" + url[len(prefix) :]
    return url


def get_db_params() -> dict[str, str | int]:
    from app.core.config import settings

    parsed = urlparse(_normalize_url(settings.DB_URL))
    return {
        "host": parsed.hostname or "127.0.0.1",
        "port": parsed.port or 5432,
        "user": parsed.username or "postgres",
        "password": parsed.password or "admin",
        "database": (parsed.path or "/loanlens_db").lstrip("/") or "loanlens_db",
    }


def psycopg2_dsn() -> str:
    p = get_db_params()
    return (
        f"host={p['host']} port={p['port']} user={p['user']} "
        f"password={p['password']} dbname={p['database']}"
    )


def asyncpg_dsn() -> str:
    p = get_db_params()
    return (
        f"postgresql://{p['user']}:{p['password']}@{p['host']}:{p['port']}/{p['database']}"
    )
