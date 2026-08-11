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

- Python 3.8+
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
   pip install -r backend/requirements.txt
   ```

4. **Configure environment variables**

   ```bash
   cp backend/.env.example backend/.env
   # Edit .env with your database URL, email credentials, and JWT secret
   ```

5. **Run database migrations**

   ```bash
   cd backend && alembic upgrade head
   ```

6. **Start the application**

   ```bash
   cd backend && uvicorn app.main:app --reload
   ```

7. **Access the app**
   - API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

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
│   ├── .env.example                 # Environment template
│   └── requirements.txt             # Python dependencies
├── frontend/                        # Client-side app
│   ├── pages/                       # HTML pages (login, dashboard)
│   ├── css/                         # Stylesheets
│   └── js/                          # Frontend scripts (api, auth, tasks)
├── .gitignore
└── README.md
```

### `backend/` overview

This folder contains all server-side components:

- `app/` — main FastAPI application package
- `alembic/` — migration scripts/history
- `.env` — local development secrets (**never commit**)
- `.env.example` — sample env config
- `requirements.txt` — backend Python dependencies

## Environment Variables

| Variable              | Description                                  |
| --------------------- | -------------------------------------------- |
| `POSTGRES_HOST`       | PostgreSQL host (default: localhost)         |
| `POSTGRES_PORT`       | PostgreSQL port (default: 5432)              |
| `POSTGRES_USER`       | PostgreSQL username                          |
| `POSTGRES_PASSWORD`   | PostgreSQL password                          |
| `POSTGRES_DB`         | PostgreSQL database name                     |
| `SECRET_KEY`          | JWT signing secret (use a strong random key) |
| `MAILTRAP_HOST`       | SMTP server for email sending                |
| `MAILTRAP_PORT`       | SMTP port (default: 2525)                    |
| `MAILTRAP_USER`       | SMTP username                                |
| `MAILTRAP_PASSWORD`   | SMTP password                                |
| `ADMIN_SECRET`        | Secret key for admin registration            |

## License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
