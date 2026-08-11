from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.tasks import router as tasks_router
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.users import router as users_router
from app.services.scheduler import configure_scheduler, scheduler

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(users_router)


@app.on_event("startup")
async def on_startup():
    configure_scheduler()
    scheduler.start()


@app.on_event("shutdown")
async def on_shutdown():
    scheduler.shutdown(wait=True)
