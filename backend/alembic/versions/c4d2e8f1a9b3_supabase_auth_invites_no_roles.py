"""Supabase Auth sign-in, invite links, no admin role

Revision ID: c4d2e8f1a9b3
Revises: a7c3e9d2b4f1
Create Date: 2026-10-24 12:00:00.000000

Existing accounts used app-managed passwords, which Supabase Auth replaces,
so users and their tasks are cleared.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4d2e8f1a9b3"
down_revision: Union[str, Sequence[str], None] = "a7c3e9d2b4f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("DELETE FROM tasks")
    op.execute("DELETE FROM users")

    op.drop_constraint("ck_user_role", "users", type_="check")
    op.drop_column("users", "role")
    op.drop_column("users", "hashed_password")
    op.add_column("users", sa.Column("auth_id", sa.Uuid(), nullable=False))
    op.add_column("users", sa.Column("display_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(), nullable=True))
    op.create_unique_constraint("uq_users_auth_id", "users", ["auth_id"])

    op.create_table(
        "invites",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token_hash", sa.String(), nullable=False, unique=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_invites_created_by", "invites", ["created_by"])
    # Same reason as a7c3e9d2b4f1: keep Supabase's Data API out of app tables
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TABLE invites ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_invites_created_by", table_name="invites")
    op.drop_table("invites")
    op.execute("DELETE FROM tasks")
    op.execute("DELETE FROM users")
    op.drop_constraint("uq_users_auth_id", "users", type_="unique")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "display_name")
    op.drop_column("users", "auth_id")
    op.add_column("users", sa.Column("hashed_password", sa.String(), nullable=False))
    op.add_column("users", sa.Column("role", sa.String(), server_default="member", nullable=False))
    op.create_check_constraint("ck_user_role", "users", "role IN ('admin', 'member')")
