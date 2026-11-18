"""Exams as bosses: each completed revision task aimed at an exam is one strike."""
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.task import Task
from app.models.user import User
from app.schemas.study import BossRead
from app.schemas.task import TaskRead

MAX_HEALTH = 5


def health(completed_revision: int) -> int:
    return max(0, MAX_HEALTH - completed_revision)


def bosses(db: Session, user: User) -> list[BossRead]:
    visible = or_(Task.user_id == user.id, Task.assigned_to == user.id)
    exams = db.query(Task).filter(visible, Task.kind == "exam").order_by(Task.due_date, Task.id).all()
    if not exams:
        return []
    revision = (
        db.query(Task)
        .filter(visible, Task.boss_task_id.in_([e.id for e in exams]))
        .order_by(Task.planned_for.nulls_last(), Task.due_date, Task.id)
        .all()
    )
    out = []
    for exam in exams:
        linked = [t for t in revision if t.boss_task_id == exam.id]
        hp = health(sum(1 for t in linked if t.status == "completed"))
        out.append(
            BossRead(
                exam=TaskRead.model_validate(exam),
                guardian=exam.guardian,
                health=hp,
                max_health=MAX_HEALTH,
                defeated=hp == 0,
                revision=[TaskRead.model_validate(t) for t in linked],
            )
        )
    return out
