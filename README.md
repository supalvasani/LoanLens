# LoanLens

**Automated loan eligibility and credit scoring platform for Indian NBFCs.**

LoanLens is an end-to-end data engineering platform and web application. It ingests bank statement CSVs from any Indian bank through a zero-branching universal ingestion pipeline, computes credit scores and loan eligibility using dbt transformations in PostgreSQL, and surfaces actionable insights to applicants, analysts, and managers via a role-scoped web portal.

> 📖 **Deep-Dive Technical Documentation:** For complete Mermaid diagrams, Airflow execution lifecycles, column-level dbt lineage, and ingestion heuristics, see **[ARCHITECTURE.md](file:///d:/LoanLens/ARCHITECTURE.md)**.

---

## Key Features

- **Universal Bank Statement Ingestion:** Parses statement CSVs from any bank without hardcoded bank parsers, using statistical column classification and balance reconciliation verification.
- **Automated Credit Scoring (300–900):** Computes credit scores, income stability metrics, EMI burden ratios, and bounce history via dbt models.
- **Orchestrated Pipelines:** Apache Airflow DAGs automate statement ingestion, dbt transforms, data quality checks, and daily reporting.
- **Role-Based Web Portal:** Dedicated views for Loan Applicants (scores & applications) and Analysts/Managers (risk queues, fraud indicators, manual decision overrides).

---

## Tech Stack

| Domain | Technologies |
|---|---|
| **Backend API** | Python 3.12, FastAPI, Pydantic, SQLAlchemy, Uvicorn |
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Data Engineering** | PostgreSQL 16, dbt Core (`dbt-postgres`), Pandas |
| **Orchestration & Containerization** | Apache Airflow (LocalExecutor), Docker & Docker Compose |

---

## System Overview

```
+-------------------------+     HTTPS/REST     +---------------------------+
|   React Frontend        |<------------------>|   FastAPI Backend         |
|   (Vite, TypeScript)    |                    |   (Python 3.12, asyncio)  |
|   Port 5173             |                    |   Port 8000               |
+-------------------------+                    +---------------------------+
                                                        |
                          +-----------------------------+
                          |                             |
                  +-------+-------+           +---------+------+
                  |  PostgreSQL   |           | Apache Airflow |
                  |  (Port 5432)  |           | (Port 8080)    |
                  |  Raw & Marts  |           | Ingest & dbt   |
                  +---------------+           +----------------+
```

---

## Project Structure

```
LoanLens/
├── backend/                  # FastAPI API, ingestion pipeline & Airflow DAGs
│   ├── app/                  # REST routes, services, schemas & ingestion engine
│   └── airflow/dags/         # Apache Airflow DAG definitions
├── frontend/                 # React + Vite TypeScript web portal
├── dbt/                      # dbt transformation models (staging, intermediate, marts)
├── ARCHITECTURE.md           # Full technical specifications & data lineage
├── docker-compose.yml        # Docker setup for PostgreSQL and Airflow
└── README.md                 # Project summary and local setup guide
```

---

## Local Development Setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/) installed and running
- [Python 3.12+](https://www.python.org/)
- [Node.js 18+](https://nodejs.org/)

### Quick Start

#### 1. Database & Airflow (Docker)
```powershell
docker compose up -d
```

#### 2. Backend (FastAPI)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

#### 3. Frontend (React / Vite)
```powershell
cd frontend
npm install
npm run dev
```

#### 4. (Optional) Compile dbt Models
```powershell
D:\LoanLens\backend\.venv\Scripts\dbt.exe run --project-dir D:\LoanLens\dbt\loanlens --profiles-dir D:\LoanLens\dbt\loanlens --target dev
```

---

## Service URLs

| Service | Local URL | Default Credentials |
|---|---|---|
| **React Frontend** | [http://localhost:5173](http://localhost:5173) | N/A |
| **FastAPI Docs (Swagger)** | [http://localhost:8000/docs](http://localhost:8000/docs) | N/A |
| **Apache Airflow** | [http://localhost:8080](http://localhost:8080) | `admin` / `admin` |
| **PostgreSQL Database** | `localhost:5432` | `postgres` / `admin` |

For full details on data models, API schemas, and pipeline topology, refer to **[ARCHITECTURE.md](file:///d:/LoanLens/ARCHITECTURE.md)**.
