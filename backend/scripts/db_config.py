"""Shared DB connection config for scripts — uses same .env as the app."""
from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv

# Load backend .env
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

def psycopg2_dsn() -> str:
    """Return explicit psycopg2 DSN — parses DB_URL env var."""
    db_url = os.getenv(
        "DB_URL",
        "postgresql+asyncpg://postgres:admin@127.0.0.1:5432/loanlens_db",
    )
    # Strip driver prefix
    clean = db_url.replace("postgresql+asyncpg://", "").replace("postgresql+psycopg2://", "")
    # clean is now: user:pass@host:port/dbname
    # Parse manually to build explicit DSN (avoids urllib issues on Windows)
    userpass, rest = clean.split("@", 1)
    user, password = userpass.split(":", 1)
    hostport, dbname = rest.split("/", 1)
    if ":" in hostport:
        host, port_str = hostport.split(":", 1)
        port = int(port_str)
    else:
        host = hostport
        port = 5433
    return f"host={host} port={port} dbname={dbname} user={user} password={password}"

