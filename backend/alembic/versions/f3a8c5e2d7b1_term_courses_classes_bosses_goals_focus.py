"""Term, courses, class sessions, exam bosses, goals and focus sessions

Revision ID: f3a8c5e2d7b1
Revises: e7b1d4c9f2a6
Create Date: 2026-11-18 15:00:00.000000

Moves each task's free-text course into a `courses` row (one per member and
course name) and adds what the Zen Voyage frontend needs: the member's term,
weekly class sessions, an exam's guardian and the revision tasks aimed at it,
goals, and focus sessions.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f3a8c5e2d7b1"
down_revision: Union[str, Sequence[str], None] = "e7b1d4c9f2a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_TABLES = ("courses", "class_sessions", "goals", "focus_sessions")
# Same palette the app uses for new courses
COLOURS = ("#5F8A8B", "#B98A2F", "#4F6B4A", "#8A4B2E", "#46706F")


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("users", sa.Column("term_name", sa.String(80), nullable=True))
    op.add_column("users", sa.Column("term_start", sa.Date(), nullable=True))
    op.add_column("users", sa.Column("term_weeks", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("onboarded_at", sa.DateTime(timezone=True), nullable=True))
    op.create_check_constraint("ck_user_term_weeks", "users", "term_weeks BETWEEN 1 AND 52")

    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("glyph", sa.String(4), nullable=False),
        sa.Column("colour", sa.String(7), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("colour ~ '^#[0-9A-Fa-f]{6}$'", name="ck_course_colour"),
    )
    op.create_index("ix_courses_user_id", "courses", ["user_id"])
    op.create_index("uq_courses_user_name", "courses", ["user_id", sa.text("lower(name)")], unique=True)

    op.create_table(
        "class_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("weekday", sa.SmallInteger(), nullable=False),
        sa.Column("starts_at", sa.Time(), nullable=False),
        sa.Column("ends_at", sa.Time(), nullable=False),
        sa.Column("place", sa.String(80), nullable=True),
        sa.CheckConstraint("weekday BETWEEN 0 AND 6", name="ck_class_weekday"),
        sa.CheckConstraint("ends_at > starts_at", name="ck_class_times"),
    )
    op.create_index("ix_class_sessions_course_id", "class_sessions", ["course_id"])

    # Tasks: course text -> course_id, plus exam guardians and revision links
    op.add_column(
        "tasks",
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column("tasks", sa.Column("guardian", sa.String(), nullable=True))
    op.add_column(
        "tasks",
        sa.Column("boss_task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_check_constraint("ck_task_guardian", "tasks", "guardian IN ('kraken', 'dragon', 'golem')")
    op.create_index("ix_tasks_course_id", "tasks", ["course_id"])
    op.create_index("ix_tasks_boss_task_id", "tasks", ["boss_task_id"])

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            # Keep the spelling of the earliest task that used each course
            "SELECT user_id, (array_agg(trim(course) ORDER BY id))[1] AS name, min(id) AS first FROM tasks "
            "WHERE course IS NOT NULL AND trim(course) <> '' "
            "GROUP BY user_id, lower(trim(course)) ORDER BY user_id, first"
        )
    ).fetchall()
    per_user: dict[int, int] = {}
    for user_id, name, _first in rows:
        index = per_user.get(user_id, 0)
        per_user[user_id] = index + 1
        bind.execute(
            sa.text("INSERT INTO courses (user_id, name, glyph, colour) VALUES (:u, :n, :g, :c)"),
            {"u": user_id, "n": name[:80], "g": name[0].upper(), "c": COLOURS[index % len(COLOURS)]},
        )
    bind.execute(
        sa.text(
            "UPDATE tasks SET course_id = courses.id FROM courses "
            "WHERE courses.user_id = tasks.user_id AND lower(courses.name) = lower(trim(tasks.course))"
        )
    )
    op.drop_column("tasks", "course")

    op.create_table(
        "goals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("text", sa.String(200), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("target", sa.String(40), nullable=True),
        sa.Column("sealed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("type IN ('grade', 'exam', 'habit', 'balance')", name="ck_goal_type"),
    )
    op.create_index("ix_goals_user_id", "goals", ["user_id"])

    op.create_table(
        "focus_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("minutes > 0 AND minutes <= 600", name="ck_focus_minutes"),
    )
    op.create_index("ix_focus_sessions_user_id_started_at", "focus_sessions", ["user_id", "started_at"])

    # Same reason as a7c3e9d2b4f1: keep Supabase's Data API out of app tables
    if bind.dialect.name == "postgresql":
        for table in NEW_TABLES:
            op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_focus_sessions_user_id_started_at", table_name="focus_sessions")
    op.drop_table("focus_sessions")
    op.drop_index("ix_goals_user_id", table_name="goals")
    op.drop_table("goals")

    op.add_column("tasks", sa.Column("course", sa.String(80), nullable=True))
    op.execute("UPDATE tasks SET course = courses.name FROM courses WHERE courses.id = tasks.course_id")
    op.drop_index("ix_tasks_boss_task_id", table_name="tasks")
    op.drop_index("ix_tasks_course_id", table_name="tasks")
    op.drop_constraint("ck_task_guardian", "tasks", type_="check")
    op.drop_column("tasks", "boss_task_id")
    op.drop_column("tasks", "guardian")
    op.drop_column("tasks", "course_id")

    op.drop_index("ix_class_sessions_course_id", table_name="class_sessions")
    op.drop_table("class_sessions")
    op.drop_index("uq_courses_user_name", table_name="courses")
    op.drop_index("ix_courses_user_id", table_name="courses")
    op.drop_table("courses")

    op.drop_constraint("ck_user_term_weeks", "users", type_="check")
    for column in ("onboarded_at", "term_weeks", "term_start", "term_name"):
        op.drop_column("users", column)
