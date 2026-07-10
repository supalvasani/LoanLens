import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.logger import logger
from app.core.rate_limit import limiter


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("application_started", extra={"env": settings.APP_ENV})
    yield
    logger.info("application_stopped")


app = FastAPI(
    title="LoanLens API",
    version="0.1.0",
    description="Automated loan eligibility and credit scoring platform for Indian NBFCs.",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_request(request: Request, call_next):
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "request_failed",
            extra={"method": request.method, "path": request.url.path},
        )
        raise
    latency = round((time.perf_counter() - started) * 1000, 2)
    logger.info(
        "request_completed",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "latency_ms": latency,
        },
    )
    return response


@app.get("/health", tags=["Health"])
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "version": "0.1.0"})


# ── Routers ────────────────────────────────────────────────────────────────────
from app.api.v1.routes.admin import router as admin_router  # noqa: E402
from app.api.v1.routes.analyst import router as analyst_router  # noqa: E402
from app.api.v1.routes.applications import router as applications_router  # noqa: E402
from app.api.v1.routes.auth import router as auth_router  # noqa: E402
from app.api.v1.routes.chatbot import router as chatbot_router  # noqa: E402
from app.api.v1.routes.credit_scores import router as credit_scores_router  # noqa: E402
from app.api.v1.routes.decisions import router as decisions_router  # noqa: E402
from app.api.v1.routes.eligibility import router as eligibility_router  # noqa: E402
from app.api.v1.routes.manager import router as manager_router  # noqa: E402
from app.api.v1.routes.upload import router as upload_router  # noqa: E402
from app.api.v1.routes.users import router as users_router  # noqa: E402

app.include_router(auth_router,          prefix="/api/v1")
app.include_router(users_router,         prefix="/api/v1")
app.include_router(applications_router,  prefix="/api/v1")
app.include_router(decisions_router,     prefix="/api/v1")
app.include_router(admin_router,         prefix="/api/v1")
app.include_router(chatbot_router,       prefix="/api/v1")
app.include_router(upload_router,        prefix="/api/v1")
app.include_router(credit_scores_router, prefix="/api/v1")
app.include_router(eligibility_router,   prefix="/api/v1")
app.include_router(analyst_router,       prefix="/api/v1")
app.include_router(manager_router,       prefix="/api/v1")
