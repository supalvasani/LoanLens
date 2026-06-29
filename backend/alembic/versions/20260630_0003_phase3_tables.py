"""loan_type_config, audit_log, decisions, applicant user link"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260630_0003"
down_revision = "20260629_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("raw_applicants", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_raw_applicants_user_id", "raw_applicants", "users", ["user_id"], ["user_id"])
    op.create_index("ix_raw_applicants_user_id", "raw_applicants", ["user_id"])

    loan_type = postgresql.ENUM(
        "home_loan", "personal_loan", "auto_loan", "education_loan", "two_wheeler_loan", "business_loan",
        name="loan_type_enum", create_type=False,
    )
    decision_enum = postgresql.ENUM("approved", "rejected", "escalated", name="decision_enum", create_type=False)
    decision_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "loan_type_config",
        sa.Column("loan_type_id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("loan_type", loan_type, nullable=False, unique=True),
        sa.Column("min_score", sa.Integer(), nullable=False),
        sa.Column("max_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("manager_threshold_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("approve_threshold", sa.Integer(), nullable=False),
        sa.Column("review_lower", sa.Integer(), nullable=False),
        sa.Column("review_upper", sa.Integer(), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.user_id"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "audit_log",
        sa.Column("log_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=False),
        sa.Column("target_id", sa.String(length=64), nullable=False),
        sa.Column("old_value", postgresql.JSONB(), nullable=True),
        sa.Column("new_value", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])
    op.create_index("ix_audit_log_created_at", "audit_log", ["created_at"])

    op.create_table(
        "decisions",
        sa.Column("decision_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("raw_loan_applications.application_id"), nullable=False),
        sa.Column("decided_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("decision", decision_enum, nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("escalated_to", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.user_id"), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_decisions_application_id", "decisions", ["application_id"])

    op.execute("""
        INSERT INTO loan_type_config
        (loan_type, min_score, max_amount, manager_threshold_amount, approve_threshold, review_lower, review_upper)
        VALUES
        ('home_loan', 65, 50000000, 5000000, 65, 45, 65),
        ('personal_loan', 50, 5000000, 5000000, 50, 45, 65),
        ('auto_loan', 45, 3000000, 800000, 45, 45, 65),
        ('education_loan', 40, 2000000, 1000000, 40, 45, 65),
        ('two_wheeler_loan', 40, 300000, 150000, 40, 45, 65),
        ('business_loan', 55, 20000000, 5000000, 55, 45, 65)
        ON CONFLICT (loan_type) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table("decisions")
    op.drop_table("audit_log")
    op.drop_table("loan_type_config")
    op.drop_constraint("fk_raw_applicants_user_id", "raw_applicants", type_="foreignkey")
    op.drop_index("ix_raw_applicants_user_id", "raw_applicants")
    op.drop_column("raw_applicants", "user_id")
    postgresql.ENUM(name="decision_enum").drop(op.get_bind(), checkfirst=True)
