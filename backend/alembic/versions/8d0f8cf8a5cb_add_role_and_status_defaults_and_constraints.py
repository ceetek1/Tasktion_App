"""add role and status defaults and constraints

Revision ID: 8d0f8cf8a5cb
Revises: 14f06c1c489c
Create Date: 2026-08-11 08:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8d0f8cf8a5cb"
down_revision: Union[str, Sequence[str], None] = "14f06c1c489c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "users",
        "role",
        existing_type=sa.String(),
        existing_nullable=False,
        server_default="member",
    )
    op.alter_column(
        "tasks",
        "status",
        existing_type=sa.String(),
        existing_nullable=False,
        server_default="pending",
    )
    op.execute(
        "UPDATE users SET role = 'member' "
        "WHERE role IS NULL OR role NOT IN ('admin', 'member')"
    )
    op.execute(
        "UPDATE tasks SET status = 'pending' "
        "WHERE status IS NULL OR status NOT IN "
        "('pending', 'in_progress', 'completed')"
    )
    op.create_check_constraint(
        "ck_user_role",
        "users",
        "role IN ('admin', 'member')",
    )
    op.create_check_constraint(
        "ck_task_status",
        "tasks",
        "status IN ('pending', 'in_progress', 'completed')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("ck_task_status", "tasks", type_="check")
    op.drop_constraint("ck_user_role", "users", type_="check")
    op.alter_column(
        "tasks",
        "status",
        existing_type=sa.String(),
        existing_nullable=False,
        server_default=None,
    )
    op.alter_column(
        "users",
        "role",
        existing_type=sa.String(),
        existing_nullable=False,
        server_default=None,
    )
