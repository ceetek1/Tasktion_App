# Tasktion

A Productivity Tool that helps groups during group projects assign tasks to members and keep track of their tasks.

## Features

- ✅ **Task Management** — Create, update, and track tasks with deadlines
- 🔔 **Email Reminders** — Automated notifications before tasks are due
- 👥 **Multi-User Support** — Role-based access control
- 📊 **Dashboard** — Overview of your tasks, deadlines, and progress
- ⏰ **Scheduled Jobs** — Background scheduler for reminders and cleanup

## Tech Stack

### Backend

- **FastAPI** — API framework
- **SQLAlchemy** — ORM (Python ↔ database)
- **Alembic** — Database migrations
- **Pydantic** — Request/response validation
- **Passlib + Bcrypt** — Password hashing
- **python-jose** — JWT creation and verification
- **APScheduler** — Background cron jobs
- **smtplib** — Sending emails
- **psycopg2-binary** — PostgreSQL driver

### Frontend

- HTML, CSS, Vanilla JavaScript

### Database

- **PostgreSQL** — Local development
- **Supabase** — Production (hosted PostgreSQL)

## Getting Started

### Prerequisites

- Python 3.10+
- PostgreSQL (for local development)
- pip or poetry for dependency management

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Tasktion_App
   ```

2. **Set up a virtual environment**

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**

   ```bash
   cp backend/.env.example backend/.env
   # Edit .env with your database URL, email credentials, and JWT secret
   ```

5. **Run database migrations**

   ```bash
   alembic -c backend/alembic.ini upgrade head
   ```

6. **Start the application**

   ```bash
   uvicorn app.main:app --reload --app-dir backend
   ```

7. **Access the app**
   - App: http://localhost:8000
   - API Docs: http://localhost:8000/docs
   - Health check: http://localhost:8000/health

## Deployment

The FastAPI backend serves the static frontend from `frontend/`, so the app can be deployed as a single web service.

Typical production commands from the repository root:

```bash
pip install -r requirements.txt
alembic -c backend/alembic.ini upgrade head
uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --app-dir backend
```

For Procfile-based platforms, this repo includes:

```Procfile
release: alembic -c backend/alembic.ini upgrade head
web: uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --app-dir backend
```

Set `DATABASE_URL` to your deployed PostgreSQL connection string when available. `postgres://` and `postgresql://` URLs are accepted and normalized for the installed psycopg2 driver.

Set `ENVIRONMENT=production` and provide a unique `SECRET_KEY` of at least 32 characters. If the frontend is hosted separately from the API, set `ALLOWED_ORIGINS` to the frontend origin list. Leave the Mailtrap/SMTP variables blank to disable scheduled email reminders.

## Project Structure

```
Tasktion_App/
├── backend/                         # All Python server-side code
│   ├── app/
│   │   ├── api/                     # FastAPI route modules (auth, tasks, users)
│   │   ├── core/                    # Config, security, database setup
│   │   ├── models/                  # SQLAlchemy models
│   │   ├── schemas/                 # Pydantic schemas
│   │   ├── services/                # Task logic, email, scheduler services
│   │   └── main.py                  # FastAPI app entrypoint
│   ├── alembic/                     # Database migration history
│   ├── .env                         # Local secrets (never commit)
│   └── .env.example                 # Environment template
├── frontend/                        # Client-side app
│   ├── pages/                       # HTML pages (login, dashboard)
│   ├── css/                         # Stylesheets
│   └── js/                          # Frontend scripts (api, auth, tasks)
├── requirements.txt                 # Python dependencies
├── Procfile                         # PaaS process commands
├── .gitignore
└── README.md
```

### `backend/` overview

This folder contains all server-side components:

- `app/` — main FastAPI application package
- `alembic/` — migration scripts/history
- `.env` — local development secrets (**never commit**)
- `.env.example` — sample env config
- `requirements.txt` — Python dependencies at the repository root

## Environment Variables

| Variable              | Description                                  |
| --------------------- | -------------------------------------------- |
| `ENVIRONMENT`         | Set to `production` in deployed environments |
| `DATABASE_URL`        | Preferred deployed PostgreSQL connection URL |
| `POSTGRES_HOST`       | PostgreSQL host when `DATABASE_URL` is unset |
| `POSTGRES_PORT`       | PostgreSQL port when `DATABASE_URL` is unset |
| `POSTGRES_USER`       | PostgreSQL user when `DATABASE_URL` is unset |
| `POSTGRES_PASSWORD`   | PostgreSQL password when `DATABASE_URL` is unset |
| `POSTGRES_DB`         | PostgreSQL database when `DATABASE_URL` is unset |
| `SECRET_KEY`          | JWT signing secret (use a strong random key) |
| `MAILTRAP_HOST`       | Optional SMTP server for email sending       |
| `MAILTRAP_PORT`       | Optional SMTP port (default: 2525)           |
| `MAILTRAP_USER`       | Optional SMTP username                       |
| `MAILTRAP_PASSWORD`   | Optional SMTP password                       |
| `ADMIN_SECRET`        | Secret key for admin registration            |
| `ALLOWED_ORIGINS`     | Comma-separated origins for separate frontend hosting |
| `SCHEDULER_ENABLED`   | Enable or disable reminder scheduler         |

## License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
