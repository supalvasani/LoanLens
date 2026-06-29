# LoanLens

Automated loan eligibility and credit scoring platform for Indian NBFCs.

## Quick Start (Docker)

From the repository root:

```powershell
# 1. Ensure backend/.env exists (copy from example if needed)
Copy-Item backend\.env.example backend\.env

# 2. Reset DB if you had an older init.sql schema (first time or after Phase 0 fix)
docker compose down -v

# 3. Start core infra
docker compose up -d postgres redis

# 4. Run migrations + seed users + start API
docker compose up -d --build fastapi

# 5. Generate raw data (~500 applicants, ~180K transactions)
docker compose exec fastapi python -m scripts.generate_raw_data --load

# 6. Start Airflow + worker + frontend (optional full stack)
docker compose up -d --build airflow-init airflow-webserver airflow-scheduler airflow-worker frontend metabase
```

## Service URLs

| Service   | URL                      |
|-----------|--------------------------|
| FastAPI   | http://localhost:8000    |
| Frontend  | http://localhost:5173    |
| Airflow   | http://localhost:8080    |
| Metabase  | http://localhost:3000    |
| Postgres  | localhost:5432           |

**Airflow login:** `admin` / `admin`

## Seed Users (login)

| Role      | Email                 | Password      |
|-----------|-----------------------|---------------|
| Admin     | admin@loanlens.in     | Admin@123     |
| Manager   | manager@loanlens.in   | Manager@123   |
| Analyst   | analyst@loanlens.in   | Analyst@123   |
| Applicant | applicant@loanlens.in | Applicant@123 |

## Local Development (without full Docker)

```powershell
# Postgres must be running via Docker on port 5432
cd backend
pip install -r requirements.txt
alembic upgrade head
python -m scripts.seed_users
python -m scripts.generate_raw_data --load
python -m scripts.check_db
uvicorn app.main:app --reload --port 8000
```

## dbt (staging layer)

```powershell
pip install dbt-core dbt-postgres
$env:DBT_HOST="127.0.0.1"
$env:DBT_PORT="5432"
$env:DBT_USER="postgres"
$env:DBT_PASSWORD="admin"
$env:DBT_DBNAME="loanlens_db"
dbt seed --project-dir dbt/loanlens --profiles-dir dbt/loanlens --target dev
dbt run  --project-dir dbt/loanlens --profiles-dir dbt/loanlens --target dev --select path:models/staging
dbt test --project-dir dbt/loanlens --profiles-dir dbt/loanlens --target dev
```

## Phase 0 Fixes Applied

- **Port mismatch fixed:** all configs now use `5432` (not `5433`)
- **Alembic vs init.sql conflict fixed:** init.sql only adds extensions; schema via Alembic; users seeded on API startup
- **Airflow Celery worker added** (required for task execution)

## Troubleshooting

**`relation "users" already exists` on startup**
→ Old Postgres volume has pre-Alembic schema. Run `docker compose down -v` and start fresh.

**Port 5432 already in use**
→ Stop other Postgres instances or change the host port in `docker-compose.yml`.

**Airflow tasks stuck in queued**
→ Ensure `airflow-worker` container is running.

**dbt source not found**
→ Run `alembic upgrade head` and `python -m scripts.generate_raw_data --load` first.
