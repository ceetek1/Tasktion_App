# Tasktion

A private task app for you and your friends: hand each other tasks, see who's doing what, and get a reminder before anything is due.

## Features

- ✅ **Task Management** — Create, update, and track tasks with deadlines
- 🔔 **Email Reminders** — Automated notifications before tasks are due
- 👥 **Friends group** — Sign in with Google, Microsoft or email; new people join only through a one-time invite link, and anyone in the group can give a task to anyone else
- 📱 **iPhone home-screen app** — Installable from Safari, no App Store needed
- 📊 **Dashboard** — Overview of your tasks, deadlines, and progress
- ⏰ **Scheduled Jobs** — Background scheduler that sends one reminder per task, about 24 hours before it is due

## Tech Stack

### Backend

- **FastAPI** — API framework
- **SQLAlchemy** — ORM (Python ↔ database)
- **Alembic** — Database migrations
- **Pydantic** — Request/response validation
- **Supabase Auth** — Google, Microsoft and email sign-in (the API only verifies its tokens)
- **python-jose** — JWT creation and verification
- **APScheduler** — In-process reminder timer for always-on hosts (on Vercel, a GitHub Actions schedule calls `/cron/reminders` instead)
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
   - Database check: http://localhost:8000/health/db

   If sign-up returns 404, check that nothing else is already listening on port 8000 (`lsof -iTCP:8000 -sTCP:LISTEN`).

8. **Run the tests**

   Tests use a separate database. Create it once, then run pytest from the repository root:

   ```bash
   createdb tasktion_test
   pytest
   ```

   Set `TEST_DATABASE_URL` to use a different test database.

## Using Supabase

1. Create a project in the Supabase dashboard.
2. Open **Connect** and copy the **Session pooler** connection string. The direct `db.<ref>.supabase.co` host is IPv6-only and fails on many networks and hosts.
3. Put it in `backend/.env` as `DATABASE_URL`, with `?sslmode=require` at the end. URL-encode special characters in the password (for example `@` becomes `%40`).
4. Run `alembic -c backend/alembic.ini upgrade head`.
5. Check http://localhost:8000/health/db returns `{"status": "ok"}`.

The migrations enable Row Level Security on the app's tables. That blocks Supabase's public Data API from reading them. The backend connects as the table owner, so it is not affected.

## Sign-in setup (Supabase Auth)

All sign-in goes through Supabase Auth. The callback URL every provider needs is `https://<project-ref>.supabase.co/auth/v1/callback`.

1. **Keys:** from Project Settings → API, put the project URL in `SUPABASE_URL` and the publishable (anon) key in `SUPABASE_PUBLISHABLE_KEY`. The browser gets both from `/js/config.js`.
2. **Google:** in Google Cloud console, create an OAuth client ID (type *Web application*) with the callback URL above as an authorized redirect URI. Paste the client ID and secret into Supabase → Authentication → Sign In / Providers → Google.
3. **Microsoft:** in the Microsoft Entra admin center, create an App registration with *Accounts in any organizational directory and personal Microsoft accounts*, add the callback URL as a Web redirect URI, and create a client secret. In Supabase, enable the **Azure** provider with that client ID and secret and the tenant URL `https://login.microsoftonline.com/common`.
4. **Email:** keep *Confirm email* on. Under Authentication → Emails → SMTP Settings, use the same SMTP account as reminders (Supabase's built-in mailer only sends a handful of emails an hour).
5. **URL configuration:** set the Site URL to `APP_URL`, and add `<APP_URL>/pages/*` and `http://localhost:8000/pages/*` to the redirect URLs.
6. Set `FIRST_MEMBER_EMAIL` to your own address. You join on your first sign-in; after that, use **Invite a friend** on the dashboard to make a single-use link (valid for `INVITE_EXPIRE_DAYS` days) for each friend. Anyone else who signs in sees "You need an invite".

## Deployment (Vercel)

The app deploys to Vercel's free Hobby plan as one project. Vercel serves everything in `public/` from its CDN, and runs the FastAPI app (found through the root `index.py`) as a single function for the API and `/js/config.js`.

### 1. Database migrations (from your Mac)

Vercel has no pre-deploy step, so run migrations yourself whenever a change adds one. Point `DATABASE_URL` at Supabase and run:

```bash
alembic -c backend/alembic.ini upgrade head
```

> ⚠️ Migration `c4d2e8f1a9b3` deletes all users and tasks from the old password-based version.

### 2. Create the Vercel project

1. At [vercel.com/new](https://vercel.com/new), import this GitHub repository. Vercel detects FastAPI on its own; leave the build settings empty.
2. Under **Settings → Environment Variables**, add the variables below for Production (and Preview, if you want previews to work).
3. Deploy. Every push to `main` then goes live automatically, and every pull request gets its own preview link.
4. Set `APP_URL` to the production address (for example `https://tasktion.vercel.app`) and redeploy. Add `<APP_URL>/pages/*` to Supabase's redirect URLs and set it as the Site URL.

Required on Vercel: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `FIRST_MEMBER_EMAIL`, `APP_URL`, `CRON_SECRET`, `ENVIRONMENT=production`, plus the SMTP variables for reminder emails.

For `DATABASE_URL` on Vercel, use Supabase's **Transaction pooler** string (port `6543`). Serverless instances open a short connection per request, which the transaction pooler is built for. `postgres://` and `postgresql://` URLs are both accepted.

For SMTP, Brevo's free plan (`smtp-relay.brevo.com`, port 587, 300 emails a day) only needs a verified sender address, not a domain.

### 3. Hourly reminders (GitHub Actions)

Vercel stops the app between requests, so the in-process timer is switched off there automatically. Instead, `.github/workflows/reminders.yml` calls `POST /cron/reminders` every hour.

1. Generate a secret: `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Set it as `CRON_SECRET` on Vercel.
2. In the GitHub repo, open **Settings → Secrets and variables → Actions**. Add the same value as the **secret** `CRON_SECRET`, and add a **variable** `APP_URL` with the production address.
3. Run it once from the **Actions** tab (**Send reminders → Run workflow**). A green run that prints `{"email_enabled":true,...}` means it works.

GitHub may start scheduled runs a few minutes late, and pauses them after 60 days without any repository activity. If that happens, re-enable the workflow from the Actions tab.

### Running elsewhere

On a host that keeps one process running, start it with the `Procfile` command. The in-process scheduler then sends reminders itself; run a single worker, or set `SCHEDULER_ENABLED=false` on all but one process, to avoid duplicate emails.

## Installing on an iPhone

Open the deployed `APP_URL` in **Safari**, tap **Share → Add to Home Screen**, then open Tasktion from the home screen and sign in once. The home-screen app keeps its own sign-in, separate from Safari.

## Project Structure

```
Tasktion_App/
├── backend/                         # All Python server-side code
│   ├── app/
│   │   ├── api/                     # FastAPI route modules (auth, invites, tasks, users)
│   │   ├── core/                    # Config, security, database setup
│   │   ├── models/                  # SQLAlchemy models
│   │   ├── schemas/                 # Pydantic schemas
│   │   ├── services/                # Task logic, email, scheduler services
│   │   └── main.py                  # FastAPI app entrypoint
│   ├── alembic/                     # Database migration history
│   ├── .env                         # Local secrets (never commit)
│   └── .env.example                 # Environment template
├── public/                          # Client-side app (served by Vercel's CDN)
│   ├── pages/                       # HTML pages (login, onboarding, dashboard)
│   ├── css/                         # Stylesheets
│   └── js/                          # Frontend scripts (session, api, auth, tasks)
├── requirements.txt                 # Python dependencies
├── Procfile                         # PaaS process commands
├── index.py                         # Vercel entrypoint (loads backend/app/main.py)
├── .github/workflows/reminders.yml  # Hourly reminder trigger
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
| `SUPABASE_URL`        | Supabase project URL (verifies sign-in tokens) |
| `SUPABASE_PUBLISHABLE_KEY` | Public anon key the browser uses for sign-in |
| `SUPABASE_JWT_SECRET` | Only for projects on the legacy HS256 JWT secret |
| `FIRST_MEMBER_EMAIL`  | Your email; joins without an invite          |
| `APP_URL`             | Public app address for invite links and emails |
| `INVITE_EXPIRE_DAYS`  | How long an invite link works (default: 7)   |
| `SMTP_HOST`           | Optional SMTP server for email sending       |
| `SMTP_PORT`           | Optional SMTP port (default: 587)            |
| `SMTP_USER`           | Optional SMTP username                       |
| `SMTP_PASSWORD`       | Optional SMTP password                       |
| `EMAIL_FROM`          | Sender address for reminder emails           |
| `ALLOWED_ORIGINS`     | Comma-separated origins for separate frontend hosting |
| `SCHEDULER_ENABLED`   | In-process reminder timer (always off on Vercel) |
| `CRON_SECRET`         | Bearer token for `POST /cron/reminders`      |

## License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
