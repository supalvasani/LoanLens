"""create raw layer tables and mart_pipeline_audit"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260629_0002"
down_revision = "20260623_0001"
branch_labels = None
depends_on = None


def _create_enum(name: str, values: list[str]) -> postgresql.ENUM:
    enum_type = postgresql.ENUM(*values, name=name, create_type=False)
    enum_type.create(op.get_bind(), checkfirst=True)
    return enum_type


def upgrade() -> None:
    txn_type = _create_enum("txn_type_enum", ["credit", "debit"])
    app_status = _create_enum(
        "application_status_enum",
        ["pending", "under_review", "approved", "rejected", "escalated"],
    )
    loan_type = _create_enum(
        "loan_type_enum",
        [
            "home_loan",
            "personal_loan",
            "auto_loan",
            "education_loan",
            "two_wheeler_loan",
            "business_loan",
        ],
    )

    op.create_table(
        "raw_applicants",
        sa.Column("raw_applicant_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("applicant_ref", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("pan_number", sa.String(length=10), nullable=False),
        sa.Column("phone", sa.String(length=15), nullable=False),
        sa.Column("city", sa.String(length=80), nullable=False),
        sa.Column("monthly_income_declared", sa.Numeric(14, 2), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("applicant_ref"),
    )
    op.create_index("ix_raw_applicants_applicant_ref", "raw_applicants", ["applicant_ref"], unique=True)
    op.create_index("ix_raw_applicants_ingested_at", "raw_applicants", ["ingested_at"])

    op.create_table(
        "raw_transactions",
        sa.Column("raw_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("applicant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("txn_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("txn_type", txn_type, nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("balance_after", sa.Numeric(14, 2), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["applicant_id"], ["raw_applicants.raw_applicant_id"]),
    )
    op.create_index("ix_raw_transactions_applicant_id", "raw_transactions", ["applicant_id"])
    op.create_index("ix_raw_transactions_txn_date", "raw_transactions", ["txn_date"])
    op.create_index("ix_raw_transactions_ingested_at", "raw_transactions", ["ingested_at"])

    op.create_table(
        "raw_loan_applications",
        sa.Column("application_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("loan_type", loan_type, nullable=False),
        sa.Column("amount_requested", sa.Numeric(14, 2), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("status", app_status, nullable=False, server_default="pending"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"]),
    )
    op.create_index("ix_raw_loan_applications_user_id", "raw_loan_applications", ["user_id"])
    op.create_index("ix_raw_loan_applications_status", "raw_loan_applications", ["status"])

    op.create_table(
        "landing_ingest_log",
        sa.Column("log_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_file", sa.String(length=512), nullable=False),
        sa.Column("record_type", sa.String(length=32), nullable=False),
        sa.Column("rows_loaded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("source_file"),
    )

    op.create_table(
        "stg_rbi_rates",
        sa.Column("rate_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("rate_type", sa.String(length=64), nullable=False),
        sa.Column("rate_value", sa.Numeric(8, 4), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("source", sa.String(length=64), nullable=False, server_default="RBI"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_stg_rbi_rates_effective_from", "stg_rbi_rates", ["effective_from"])

    op.create_table(
        "mart_pipeline_audit",
        sa.Column("run_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("dag_name", sa.String(length=128), nullable=False),
        sa.Column("rows_processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("failures", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
    )
    op.create_index("ix_mart_pipeline_audit_dag_name", "mart_pipeline_audit", ["dag_name"])
    op.create_index("ix_mart_pipeline_audit_started_at", "mart_pipeline_audit", ["started_at"])


def downgrade() -> None:
    op.drop_table("mart_pipeline_audit")
    op.drop_table("stg_rbi_rates")
    op.drop_table("landing_ingest_log")
    op.drop_table("raw_loan_applications")
    op.drop_table("raw_transactions")
    op.drop_table("raw_applicants")
    postgresql.ENUM(name="loan_type_enum").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="application_status_enum").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="txn_type_enum").drop(op.get_bind(), checkfirst=True)
