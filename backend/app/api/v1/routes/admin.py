"""Admin routes — user management, loan type config, and audit log.

Admin-only. All routes require role=admin in JWT.
Every write logs old + new values to audit_log.
"""
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_role
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.enums import RoleEnum
from app.exceptions.domain import DomainException
from app.models.user import User
from app.schemas.admin import (
    AdminChangeRoleRequest,
    AdminConfigResponse,
    AdminConfigUpdateRequest,
    AdminCreateUserRequest,
    AdminUserResponse,
    AuditLogEntryResponse,
)
from app.services.admin_service import AdminService

router = APIRouter(prefix="/admin", tags=["Admin"])


def _handle(exc: DomainException):
    from fastapi import HTTPException
    raise HTTPException(status_code=exc.status_code, detail=exc.message)


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get(
    "/users",
    summary="List all users (admin only)",
)
@limiter.limit("120/minute")
async def list_users(
    request: Request,
    current_user: Annotated[User, Depends(require_role(RoleEnum.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
    role: Annotated[RoleEnum | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[AdminUserResponse]:
    try:
        return await AdminService(db).list_users(current_user, role=role, limit=limit, offset=offset)
    except DomainException as exc:
        _handle(exc)


@router.post(
    "/users",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user (any role)",
)
@limiter.limit("20/minute")
async def create_user(
    request: Request,
    payload: AdminCreateUserRequest,
    current_user: Annotated[User, Depends(require_role(RoleEnum.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminUserResponse:
    try:
        return await AdminService(db).create_user(
            current_user,
            name=payload.name,
            email=str(payload.email),
            password=payload.password,
            role=payload.role,
        )
    except DomainException as exc:
        _handle(exc)


@router.patch(
    "/users/{user_id}/role",
    summary="Change a user's role",
)
@limiter.limit("20/minute")
async def change_role(
    request: Request,
    user_id: UUID,
    payload: AdminChangeRoleRequest,
    current_user: Annotated[User, Depends(require_role(RoleEnum.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminUserResponse:
    try:
        return await AdminService(db).change_role(current_user, user_id, payload.role)
    except DomainException as exc:
        _handle(exc)


@router.patch(
    "/users/{user_id}/deactivate",
    summary="Deactivate a user account",
)
@limiter.limit("20/minute")
async def deactivate_user(
    request: Request,
    user_id: UUID,
    current_user: Annotated[User, Depends(require_role(RoleEnum.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminUserResponse:
    try:
        return await AdminService(db).set_active(current_user, user_id, is_active=False)
    except DomainException as exc:
        _handle(exc)


@router.patch(
    "/users/{user_id}/reactivate",
    summary="Reactivate a deactivated user",
)
@limiter.limit("20/minute")
async def reactivate_user(
    request: Request,
    user_id: UUID,
    current_user: Annotated[User, Depends(require_role(RoleEnum.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminUserResponse:
    try:
        return await AdminService(db).set_active(current_user, user_id, is_active=True)
    except DomainException as exc:
        _handle(exc)


# ── Loan type config ──────────────────────────────────────────────────────────

@router.get(
    "/config",
    summary="List all loan type configurations",
)
@limiter.limit("120/minute")
async def list_configs(
    request: Request,
    current_user: Annotated[User, Depends(require_role(RoleEnum.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[AdminConfigResponse]:
    try:
        return await AdminService(db).list_configs(current_user)
    except DomainException as exc:
        _handle(exc)


@router.patch(
    "/config/{loan_type_id}",
    summary="Edit loan type thresholds (takes effect immediately, logged in audit_log)",
)
@limiter.limit("20/minute")
async def update_config(
    request: Request,
    loan_type_id: int,
    payload: AdminConfigUpdateRequest,
    current_user: Annotated[User, Depends(require_role(RoleEnum.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AdminConfigResponse:
    try:
        return await AdminService(db).update_config(current_user, loan_type_id, payload)
    except DomainException as exc:
        _handle(exc)


# ── Audit log ─────────────────────────────────────────────────────────────────

@router.get(
    "/audit",
    summary="Filterable audit log (admin only)",
)
@limiter.limit("60/minute")
async def get_audit_log(
    request: Request,
    current_user: Annotated[User, Depends(require_role(RoleEnum.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
    user_id: Annotated[UUID | None, Query()] = None,
    action: Annotated[str | None, Query()] = None,
    target_type: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[AuditLogEntryResponse]:
    try:
        return await AdminService(db).get_audit_log(
            current_user,
            user_id=user_id,
            action=action,
            target_type=target_type,
            limit=limit,
            offset=offset,
        )
    except DomainException as exc:
        _handle(exc)


# ── Ingestion Pipeline Dashboard (admin only) ─────────────────────────────────



class PipelineStatsResponse(BaseModel):
    total_uploads: int
    total_registry: int
    pending_reviews: int
    audit_runs: list[dict[str, Any]]
    registry_entries: list[dict[str, Any]]
    pending_items: list[dict[str, Any]]

class ResolveReviewRequest(BaseModel):
    resolved: bool = True
    promote: bool = False
    bank_name: str | None = None
    column_map: dict[str, Any] | None = None
    amount_pattern: str | None = None

@router.get(
    "/pipeline-dashboard",
    summary="Get data engineering pipeline statistics, audit logs, and formats (admin only)",
)
@limiter.limit("30/minute")
async def get_pipeline_dashboard(
    request: Request,
    current_user: Annotated[User, Depends(require_role(RoleEnum.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PipelineStatsResponse:
    # 1. Total uploads count
    uploads_res = await db.execute(text("SELECT COUNT(*) FROM statement_uploads"))
    total_uploads = uploads_res.scalar() or 0

    # 2. Total registry count
    registry_res = await db.execute(text("SELECT COUNT(*) FROM format_registry"))
    total_registry = registry_res.scalar() or 0

    # 3. Pending reviews count
    reviews_res = await db.execute(text("SELECT COUNT(*) FROM format_review_queue WHERE resolved = false"))
    pending_reviews = reviews_res.scalar() or 0

    # 4. Ingestion runs from audit log
    audit_res = await db.execute(
        text(
            """
            SELECT run_id, dag_name, rows_processed, failures, started_at, ended_at, status 
            FROM mart_pipeline_audit 
            ORDER BY started_at DESC 
            LIMIT 20
            """
        )
    )
    audit_runs = []
    for r in audit_res.mappings().all():
        audit_runs.append({
            "run_id": str(r["run_id"]),
            "dag_name": r["dag_name"],
            "rows_processed": r["rows_processed"],
            "failures": r["failures"],
            "started_at": r["started_at"].isoformat(),
            "ended_at": r["ended_at"].isoformat(),
            "status": r["status"]
        })

    # 5. Format registry list
    reg_list_res = await db.execute(
        text(
            """
            SELECT format_id, bank_name, match_headers, amount_pattern, confidence_source, created_at 
            FROM format_registry 
            ORDER BY created_at DESC
            """
        )
    )
    registry_entries = []
    for r in reg_list_res.mappings().all():
        registry_entries.append({
            "format_id": str(r["format_id"]),
            "bank_name": r["bank_name"],
            "match_headers": r["match_headers"],
            "amount_pattern": r["amount_pattern"],
            "confidence_source": r["confidence_source"],
            "created_at": r["created_at"].isoformat()
        })

    # 6. Unresolved review items
    rev_list_res = await db.execute(
        text(
            """
            SELECT review_id, file_name, detected_headers, sample_rows, reason, created_at 
            FROM format_review_queue 
            WHERE resolved = false 
            ORDER BY created_at DESC
            """
        )
    )
    pending_items = []
    for r in rev_list_res.mappings().all():
        import json
        samples = r["sample_rows"]
        if isinstance(samples, str):
            try:
                samples = json.loads(samples)
            except Exception:
                pass
        pending_items.append({
            "review_id": str(r["review_id"]),
            "file_name": r["file_name"],
            "detected_headers": r["detected_headers"],
            "sample_rows": samples,
            "reason": r["reason"],
            "created_at": r["created_at"].isoformat()
        })

    return PipelineStatsResponse(
        total_uploads=total_uploads,
        total_registry=total_registry,
        pending_reviews=pending_reviews,
        audit_runs=audit_runs,
        registry_entries=registry_entries,
        pending_items=pending_items
    )

@router.post(
    "/pipeline/review/{review_id}/resolve",
    responses={
        400: {"description": "Review queue item already resolved or missing details"},
        404: {"description": "Review queue item not found"},
    },
    summary="Resolve a format review queue item and optionally add to registry (admin only)",
)
@limiter.limit("20/minute")
async def resolve_pipeline_review(
    request: Request,
    review_id: UUID,
    payload: ResolveReviewRequest,
    current_user: Annotated[User, Depends(require_role(RoleEnum.admin))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # 1. Fetch the review queue item
    review_res = await db.execute(
        text("SELECT file_name, detected_headers, resolved FROM format_review_queue WHERE review_id = :rid"),
        {"rid": str(review_id)}
    )
    review_row = review_res.mappings().first()
    if not review_row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Review queue item not found")

    if review_row["resolved"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Review queue item already resolved")

    # 2. Perform registry insertion if promote is requested
    if payload.promote:
        if not payload.column_map or not payload.amount_pattern:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Missing column_map or amount_pattern for promotion")

        # Let's insert into format_registry
        import json
        await db.execute(
            text(
                """
                INSERT INTO format_registry (format_id, bank_name, match_headers, column_map, amount_pattern, confidence_source, created_at)
                VALUES (gen_random_uuid(), :bank_name, :match_headers, :column_map, :amount_pattern, 'manual', NOW())
                """
            ),
            {
                "bank_name": payload.bank_name or review_row["file_name"] or "Unknown Bank",
                "match_headers": review_row["detected_headers"],
                "column_map": json.dumps(payload.column_map),
                "amount_pattern": payload.amount_pattern
            }
        )

    # 3. Resolve the item in review queue
    await db.execute(
        text("UPDATE format_review_queue SET resolved = true WHERE review_id = :rid"),
        {"rid": str(review_id)}
    )

    # 4. Insert to audit log
    await db.execute(
        text(
            """
            INSERT INTO audit_log (log_id, user_id, action, target_type, target_id, old_value, new_value, created_at)
            VALUES (gen_random_uuid(), :uid, :action, 'format_review_queue', :rid, :old, :new, NOW())
            """
        ),
        {
            "uid": str(current_user.user_id),
            "action": "review_resolved_promote" if payload.promote else "review_resolved",
            "rid": str(review_id),
            "old": json.dumps({"resolved": False}),
            "new": json.dumps({"resolved": True, "promoted": payload.promote})
        }
    )

    await db.commit()
    return {"status": "ok", "message": "Review queue item successfully resolved"}

