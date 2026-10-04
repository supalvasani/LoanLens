# LoanLens

**Automated loan eligibility and credit scoring platform for Indian NBFCs.**

LoanLens is an end-to-end data engineering platform and web application. It ingests bank statement CSVs from any Indian bank through a zero-branching universal ingestion pipeline, computes credit scores and loan eligibility using dbt transformations in PostgreSQL, and surfaces actionable insights to applicants, analysts, and managers via a role-scoped web portal.

> 📖 **Deep-Dive Technical Documentation:** For complete Mermaid diagrams, Airflow execution lifecycles, column-level dbt lineage, and ingestion heuristics, see **[ARCHITECTURE.md](file:///d:/LoanLens/ARCHITECTURE.md)**.

---

## Key Features

- **Universal Bank Statement Ingestion:** Parses statement CSVs from any bank without hardcoded bank parsers, using statistical column classification and balance reconciliation verification.
- **Automated Credit Scoring (0–100):** Computes credit scores, income stability metrics, EMI burden ratios, and bounce history via dbt models.
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

For full details on data models, API schemas, and pipeline topology, refer to **[ARCHITECTURE.md](ARCHITECTURE.md)**.

---

## LoanBot — AI Chatbot Setup

LoanBot is the in-app AI assistant for applicants and analysts. It is grounded entirely in database-computed mart data (no hallucination of numbers) and requires an OpenAI-compatible LLM endpoint.

### Recommended models (must support tool/function calling)

| Model | Provider | Notes |
|---|---|---|
| **`llama3.1`** (8B) | Local Ollama | ✅ Recommended default — strong tool calling, 8 GB RAM |
| **`qwen2.5:7b`** | Local Ollama | Good alternative, multilingual |
| **`mistral-nemo`** | Local Ollama | Lighter CPU option |
| **`gpt-4o-mini`** | OpenAI API | Hosted, fastest, best tool-calling accuracy |
| **`gpt-4o`** | OpenAI API | Highest accuracy, higher cost |

> ⚠️ Models that do **not** support tool/function calling (e.g. raw `mistral:7b`, `phi3:mini`) will fail at the tool-execution step. Always verify with `ollama show <model> --verbose` and look for `tools` in the model capabilities.

### Option A — Local Ollama (no GPU required)

```powershell
# 1. Install Ollama from https://ollama.com/download
# 2. Pull the model
ollama pull llama3.1

# 3. Add to backend/.env
#    LLM_BASE_URL=http://localhost:11434/v1
#    LLM_MODEL=llama3.1
#    LLM_MOCK=false

# 4. Verify the endpoint responds
curl http://localhost:11434/api/tags
```

### Option B — Docker Compose Ollama (bundled)

```powershell
# Starts Postgres + Airflow + Ollama container
docker compose --profile ollama up -d

# Pull a model into the container (one-time)
docker exec -it loanlens_ollama ollama pull llama3.1

# backend/.env
# LLM_BASE_URL=http://localhost:11434/v1
# LLM_MODEL=llama3.1
```

### Option C — OpenAI or hosted API

```
# backend/.env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
```

### Option D — Mock mode (CI / offline dev)

```
# backend/.env
LLM_MOCK=true
```

The chatbot route returns HTTP 503 if `LLM_BASE_URL` is blank and `LLM_MOCK` is not `true`.
