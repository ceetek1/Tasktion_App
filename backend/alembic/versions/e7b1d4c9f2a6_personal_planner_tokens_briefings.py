"""Personal planner: task planning fields, planner settings, personal access tokens

Revision ID: e7b1d4c9f2a6
Revises: c4d2e8f1a9b3
Create Date: 2026-11-18 12:00:00.000000

Adds what the Claude Desktop planner needs: when a task is planned and how
long it takes, each member's timezone, daily study capacity and briefing
times, and hashed personal access tokens for the local MCP server.
Briefings default to off, so nobody gets new emails until they opt in.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e7b1d4c9f2a6"
down_revision: Union[str, Sequence[str], None] = "c4d2e8f1a9b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TASK_KINDS = "('task', 'assignment', 'exam', 'reading', 'revision', 'study')"


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("tasks", sa.Column("course", sa.String(80), nullable=True))
    op.add_column("tasks", sa.Column("kind", sa.String(), server_default="task", nullable=False))
    op.add_column("tasks", sa.Column("planned_for", sa.Date(), nullable=True))
    op.add_column("tasks", sa.Column("estimate_minutes", sa.Integer(), nullable=True))
    op.add_column("tasks", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint("ck_task_kind", "tasks", f"kind IN {TASK_KINDS}")
    op.create_check_constraint("ck_task_estimate_positive", "tasks", "estimate_minutes > 0")
    op.create_index("ix_tasks_user_id_planned_for", "tasks", ["user_id", "planned_for"])

    op.add_column("users", sa.Column("timezone", sa.String(), server_default="UTC", nullable=False))
    op.add_column(
        "users", sa.Column("daily_capacity_minutes", sa.Integer(), server_default="180", nullable=False)
    )
    op.add_column(
        "users", sa.Column("briefings_enabled", sa.Boolean(), server_default=sa.false(), nullable=False)
    )
    op.add_column("users", sa.Column("morning_at", sa.Time(), server_default="07:30", nullable=False))
    op.add_column("users", sa.Column("evening_at", sa.Time(), server_default="21:00", nullable=False))
    op.add_column("users", sa.Column("last_morning_briefing_on", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("last_evening_briefing_on", sa.Date(), nullable=True))
    op.create_check_constraint("ck_user_capacity_positive", "users", "daily_capacity_minutes > 0")

    op.create_table(
        "access_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        # SHA-256 of the token; the token itself is never stored
        sa.Column("token_hash", sa.String(), nullable=False, unique=True),
        sa.Column("prefix", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_access_tokens_user_id", "access_tokens", ["user_id"])
    # Same reason as a7c3e9d2b4f1: keep Supabase's Data API out of app tables
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE access_tokens ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_access_tokens_user_id", table_name="access_tokens")
    op.drop_table("access_tokens")

    op.drop_constraint("ck_user_capacity_positive", "users", type_="check")
    for column in (
        "last_evening_briefing_on",
        "last_morning_briefing_on",
        "evening_at",
        "morning_at",
        "briefings_enabled",
        "daily_capacity_minutes",
        "timezone",
    ):
        op.drop_column("users", column)

    op.drop_index("ix_tasks_user_id_planned_for", table_name="tasks")
    op.drop_constraint("ck_task_estimate_positive", "tasks", type_="check")
    op.drop_constraint("ck_task_kind", "tasks", type_="check")
    for column in ("completed_at", "estimate_minutes", "planned_for", "kind", "course"):
        op.drop_column("tasks", column)
