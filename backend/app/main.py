from fastapi import FastAPI
from app.api.tasks import  router as tasks_router
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.services.scheduler import start_scheduler

app = FastAPI()
app.include_router(tasks_router)
app.include_router(auth_router)
app.include_router(admin_router)
@app.on_event("startup")
def on_startup():
    start_scheduler()