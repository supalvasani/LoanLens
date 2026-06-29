-- LoanLens Docker init — extensions only.
-- Schema is managed by Alembic; seed users run via scripts/seed_users.py on API startup.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
