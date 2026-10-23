"""timestamptz due dates, reminder tracking, case-insensitive emails, RLS

Revision ID: a7c3e9d2b4f1
Revises: 8d0f8cf8a5cb
Create Date: 2026-10-23 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7c3e9d2b4f1"
down_revision: Union[str, Sequence[str], None] = "8d0f8cf8a5cb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RLS_TABLES = ("users", "tasks", "alembic_version")


def upgrade() -> None:
    """Upgrade schema."""
    # Existing values were stored as UTC wall-clock time
    op.alter_column(
        "tasks",
        "due_date",
        existing_type=sa.DateTime(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=False,
        postgresql_using="due_date AT TIME ZONE 'UTC'",
    )
    op.add_column(
        "tasks",
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE users SET email = lower(trim(email))")
    op.create_index(
        "uq_users_email_lower",
        "users",
        [sa.text("lower(email)")],
        unique=True,
    )
    # Supabase exposes the public schema over its Data API; RLS with no
    # policies blocks that path. The app connects as the table owner, which
    # bypasses RLS.
    if op.get_bind().dialect.name == "postgresql":
        for table in RLS_TABLES:
            op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    """Downgrade schema."""
    if op.get_bind().dialect.name == "postgresql":
        for table in RLS_TABLES:
            op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.drop_index("uq_users_email_lower", table_name="users")
    op.drop_column("tasks", "reminder_sent_at")
    op.alter_column(
        "tasks",
        "due_date",
        existing_type=sa.DateTime(timezone=True),
        type_=sa.DateTime(),
        existing_nullable=False,
        postgresql_using="due_date AT TIME ZONE 'UTC'",
    )
