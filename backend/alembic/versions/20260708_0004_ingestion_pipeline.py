"""Universal ingestion pipeline — schema additions

- raw_transactions: rename applicant_id → raw_applicant_id, make
  balance_after nullable, widen description to TEXT, add source_format
  and source_file_hash columns.
- New tables: statement_uploads, format_registry, format_review_queue.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260708_0004"
down_revision = "20260630_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Drop dependent staging view ───────────────────────────────────────────
    # Since stg_transactions is a view referencing raw_transactions.description,
    # Postgres forbids altering that column's type until the view is dropped.
    op.execute("DROP VIEW IF EXISTS public_staging.stg_transactions CASCADE")

    # ── raw_transactions column changes ────────────────────────────────────────

    # 1. Rename applicant_id → raw_applicant_id
    op.alter_column("raw_transactions", "applicant_id", new_column_name="raw_applicant_id")

    # 2. Drop the old unnamed FK constraint and re-create with a proper name.
    op.execute("""
        ALTER TABLE raw_transactions
            DROP CONSTRAINT IF EXISTS raw_transactions_applicant_id_fkey,
            DROP CONSTRAINT IF EXISTS raw_transactions_raw_applicant_id_fkey
    """)
    op.create_foreign_key(
        "fk_raw_transactions_raw_applicant_id",
        "raw_transactions",
        "raw_applicants",
        ["raw_applicant_id"],
        ["raw_applicant_id"],
    )

    # 3. Make balance_after nullable (many exports omit a running balance)
    op.alter_column("raw_transactions", "balance_after", nullable=True)

    # 4. Widen description to TEXT (bank narrations can exceed 255 chars)
    op.execute("ALTER TABLE raw_transactions ALTER COLUMN description TYPE TEXT")

    # 5. Add source_format — backfill existing rows as 'legacy'
    op.add_column(
        "raw_transactions",
        sa.Column(
            "source_format",
            sa.String(50),
            nullable=False,
            server_default="legacy",
        ),
    )
    # Remove the server_default so new rows must supply an explicit value
    op.alter_column("raw_transactions", "source_format", server_default=None)

    # 6. Add source_file_hash — backfill existing rows as 'unknown'
    op.add_column(
        "raw_transactions",
        sa.Column(
            "source_file_hash",
            sa.String(64),
            nullable=False,
            server_default="unknown",
        ),
    )
    op.alter_column("raw_transactions", "source_file_hash", server_default=None)

    # Update the applicant_id index to match the renamed column
    op.execute("DROP INDEX IF EXISTS ix_raw_transactions_applicant_id")
    op.create_index(
        "ix_raw_transactions_raw_applicant_id",
        "raw_transactions",
        ["raw_applicant_id"],
    )

    # ── statement_uploads ──────────────────────────────────────────────────────
    op.create_table(
        "statement_uploads",
        sa.Column(
            "upload_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("applicant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_hash", sa.String(64), nullable=False),
        sa.Column("file_name", sa.Text(), nullable=True),
        sa.Column("source_format", sa.String(50), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reconciliation_verdict", sa.String(20), nullable=True),
        sa.Column("reconciliation_match_rate", sa.Numeric(5, 4), nullable=True),
        sa.Column("date_range_start", sa.Date(), nullable=True),
        sa.Column("date_range_end", sa.Date(), nullable=True),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["applicant_id"], ["raw_applicants.raw_applicant_id"]),
        sa.UniqueConstraint("applicant_id", "file_hash", name="uq_statement_uploads_applicant_file"),
    )
    op.create_index("ix_statement_uploads_applicant_id", "statement_uploads", ["applicant_id"])
    op.create_index("ix_statement_uploads_file_hash", "statement_uploads", ["file_hash"])

    # ── format_registry ────────────────────────────────────────────────────────
    op.create_table(
        "format_registry",
        sa.Column(
            "format_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("bank_name", sa.String(100), nullable=True),
        sa.Column("match_headers", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("column_map", postgresql.JSONB(), nullable=False),
        sa.Column("amount_pattern", sa.String(20), nullable=False),
        sa.Column(
            "confidence_source",
            sa.String(20),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "confidence_source IN ('manual', 'heuristic_promoted')",
            name="ck_format_registry_confidence_source",
        ),
    )

    # ── format_review_queue ────────────────────────────────────────────────────
    op.create_table(
        "format_review_queue",
        sa.Column(
            "review_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("file_name", sa.Text(), nullable=True),
        sa.Column("detected_headers", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("sample_rows", postgresql.JSONB(), nullable=False),
        sa.Column("reason", sa.String(50), nullable=False),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_format_review_queue_resolved", "format_review_queue", ["resolved"])


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS public_staging.stg_transactions CASCADE")

    op.drop_table("format_review_queue")
    op.drop_table("format_registry")
    op.drop_table("statement_uploads")

    # Reverse raw_transactions changes
    op.drop_index("ix_raw_transactions_raw_applicant_id", "raw_transactions")
    op.create_index(
        "ix_raw_transactions_applicant_id",
        "raw_transactions",
        ["applicant_id"],
    )
    op.drop_column("raw_transactions", "source_file_hash")
    op.drop_column("raw_transactions", "source_format")
    op.execute("ALTER TABLE raw_transactions ALTER COLUMN description TYPE VARCHAR(255)")
    op.alter_column("raw_transactions", "balance_after", nullable=False)
    op.drop_constraint("fk_raw_transactions_raw_applicant_id", "raw_transactions", type_="foreignkey")
    op.alter_column("raw_transactions", "raw_applicant_id", new_column_name="applicant_id")
    op.execute("""
        ALTER TABLE raw_transactions
            ADD CONSTRAINT raw_transactions_applicant_id_fkey
            FOREIGN KEY (applicant_id) REFERENCES raw_applicants(raw_applicant_id)
    """)
