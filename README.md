# Tasktion

A private task app for you and your friends: hand each other tasks, see who's doing what, and get a reminder before anything is due.

## Features

- ✅ **Task Management** — Create, update, and track tasks with deadlines
- 🔔 **Email Reminders** — Automated notifications before tasks are due
- 👥 **Friends group** — Sign in with Google or email; new people join only through a one-time invite link, and anyone in the group can give a task to anyone else
- 📱 **iPhone home-screen app** — Installable from Safari, no App Store needed
- 📊 **Dashboard** — Overview of your tasks, deadlines, and progress
- ⏰ **Scheduled Jobs** — Background scheduler that sends one reminder per task, about 24 hours before it is due
- 🗓️ **Personal planner** — Plan your study days in Claude Desktop; Tasktion emails you a morning plan and an evening review (see [Plan with Claude Desktop](#plan-with-claude-desktop))

## Tech Stack

### Backend

- **FastAPI** — API framework
- **SQLAlchemy** — ORM (Python ↔ database)
- **Alembic** — Database migrations
- **Pydantic** — Request/response validation
- **Supabase Auth** — Google and email sign-in (the API only verifies its tokens)
- **python-jose** — JWT creation and verification
- **APScheduler** — In-process reminder timer
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
3. **Microsoft (optional, button hidden for now):** in the Microsoft Entra admin center, create an App registration with *Accounts in any organizational directory and personal Microsoft accounts*, add the callback URL as a Web redirect URI, and create a client secret. In Supabase, enable the **Azure** provider with that client ID and secret and the tenant URL `https://login.microsoftonline.com/common`. Then remove `hidden` from the `data-provider="azure"` button in `public/pages/login.html` to show it.
4. **Email:** keep *Confirm email* on. Under Authentication → Emails → SMTP Settings, use the same SMTP account as reminders (Supabase's built-in mailer only sends a handful of emails an hour).
5. **URL configuration:** set the Site URL to `APP_URL`, and add `<APP_URL>/pages/*` and `http://localhost:8000/pages/*` to the redirect URLs.
6. Set `FIRST_MEMBER_EMAIL` to your own address. You join on your first sign-in; after that, use **Invite a friend** on the dashboard to make a single-use link (valid for `INVITE_EXPIRE_DAYS` days) for each friend. Anyone else who signs in sees "You need an invite".

## Deployment (Railway)

The app runs on Railway as one always-on web service. The FastAPI server runs the API, serves the pages in `public/`, and sends reminders from its in-process scheduler. The database and sign-in stay on Supabase. Use the Hobby plan so the service never pauses.

### 1. Create the Railway service

1. At [railway.com/new](https://railway.com/new), choose **Deploy from GitHub repo** and pick this repository. Railway builds it with Railpack, using the Python version in `.python-version`.
2. Under the service's **Settings → Source**, check the branch is `main`. Every push to `main` then deploys automatically.
3. Under the service's **Settings → Deploy**, set:
   - **Pre-deploy command:** `alembic -c backend/alembic.ini upgrade head`, so migrations apply themselves. A failed migration stops the deploy and the old version keeps running.
   - **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT --app-dir backend --workers 1`
   - **Healthcheck path:** `/health` (timeout 120 seconds)
   - **Regions:** one replica in EU West (Amsterdam), close to the Supabase database.

> ⚠️ Migration `c4d2e8f1a9b3` deletes all users and tasks from the old password-based version.

### 2. Environment variables

Under the service's **Variables** tab, add these (copy the secrets from `backend/.env`):

- `ENVIRONMENT=production`
- `DATABASE_URL`: Supabase's **Session pooler** URL (port `5432`), the same as in `.env`.
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `FIRST_MEMBER_EMAIL`
- `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`
- `SCHEDULER_ENABLED=true`
- `CRON_SECRET` (optional): lets you trigger reminders by hand with `POST /cron/reminders`.
- `APP_URL`: the public address from step 3.

The start command runs a single uvicorn worker on one replica, so each reminder is sent once. Keep it that way, or set `SCHEDULER_ENABLED=false` on all but one process.

### 3. Point everything at the live address

1. Under **Settings → Networking**, click **Generate Domain** (for example `https://tasktion-production.up.railway.app`). Set `APP_URL` to it.
2. Check `https://<your-address>/health` shows `{"status":"ok"}`.
3. **Supabase → Authentication → URL Configuration:** set the Site URL to the address and add `https://<your-address>/pages/*` to the redirect URLs (keep the localhost one for local runs).
4. **Google Auth Platform → Clients → your client:** add the address to **Authorized JavaScript origins**. On the **Audience** page, make sure the app is *In production* so friends can sign in.

### Other hosts

Any host that keeps one process running works: run the migrations, then start the `Procfile` web command.

## Plan with Claude Desktop

Tasktion doubles as a personal academic planner. You plan by chatting with Claude Desktop; a small MCP server on your Mac (`tasktion_mcp/`) talks to your deployed Tasktion with a personal access token, and Tasktion emails you what to do.

### 1. Install the MCP server (once)

Needs Python 3.10 or newer (tested with 3.13). From the repository folder:

```bash
python3 -m venv tasktion_mcp/.venv
```

```bash
tasktion_mcp/.venv/bin/pip install -r tasktion_mcp/requirements.txt
```

It uses the official MCP Python SDK, version 2.x (`mcp==2.3.0`), and `httpx`, pinned exactly.

### 2. Make a token and add it to Claude Desktop

1. Sign in to Tasktion and click **Connect Claude Desktop** on the dashboard, then **Make a token**.
2. The dialog shows the token once, inside a ready setup snippet. Click **Copy setup**. Tasktion keeps only a hash of the token, so if you lose it, make a new one.
3. In Claude Desktop open **Settings → Developer → Edit Config**. This opens `~/Library/Application Support/Claude/claude_desktop_config.json`. Paste the snippet, merging `"tasktion"` into any `mcpServers` you already have:

```json
{
  "mcpServers": {
    "tasktion": {
      "command": "/path/to/Tasktion_App/tasktion_mcp/.venv/bin/python",
      "args": ["/path/to/Tasktion_App/tasktion_mcp/server.py"],
      "env": {
        "TASKTION_URL": "https://<your-address>",
        "TASKTION_TOKEN": "tsk_…"
      }
    }
  }
}
```

4. Change both `/path/to/Tasktion_App` parts to the folder you cloned Tasktion into, save, and restart Claude Desktop. Tasktion appears under the tools (hammer/slider) menu in a new chat.

To cut Claude off, click **Revoke** next to the token in the same dialog. Tokens can only be made or revoked from a real sign-in, never with another token.

### 3. Turn on the briefing emails

Briefings are off until you turn them on, so nobody else in the group gets new emails. Ask Claude *"turn on my briefings"*, or call `PATCH /planner/settings` with `{"briefings_enabled": true}`. By default:

- **07:30**: today's plan, tasks that slipped from earlier days, deadlines in the next 48 hours, the top three things to do first with reasons, and exams this week.
- **21:00**: what you finished today, what rolls over, the first task for tomorrow, and a reminder that Claude can replan.

Times are in your own timezone, which the dashboard saves from your browser when you sign in. Each email goes once a day, at most 3 hours after its time. Daily study capacity is 3 hours (180 minutes). Change any of it by asking Claude, e.g. *"move my morning briefing to 06:45"* or *"I can study 4 hours a day"*. SMTP must be set up (see [Environment Variables](#environment-variables)).

### What you can ask

- *"What should I do now?"*: ranked suggestions with reasons (overdue, due soon, planned for today, slipped, in progress, revision before an exam).
- *"Add my biology lab report, due Thursday 5pm, about 90 minutes."* Times without a timezone are read in your timezone; a date alone means the end of that day.
- *"I finished the reading."* / *"Move the essay to Friday."* Single changes happen straight away.
- *"Plan my week."* Claude shows a proposal (each task's day and why, plus any over-capacity days) and changes nothing until you say yes.
- *"Delete the old quiz."* Claude names the exact task and waits for your yes.
- The prompts **morning_briefing**, **evening_review** and **weekly_plan** in Claude Desktop's prompt menu run these routines for you.

Tools: `today`, `week`, `what_now`, `add_task`, `complete_task`, `update_task`, `delete_task`, `plan_week`, `apply_plan`, `get_settings`, `update_settings`.

### Planner API

The same endpoints serve the MCP server and any future frontend. They take either a Supabase sign-in or a personal access token (`Authorization: Bearer tsk_…`). Full schemas are at `/docs`.

| Endpoint | What it does |
| --- | --- |
| `GET /planner/today` | Planned today, slipped, overdue, due within 48 h, exams in 7 days, load vs capacity |
| `GET /planner/week?start=YYYY-MM-DD` | Seven days of planned and due tasks, plus `unplanned` tasks |
| `GET /planner/next?limit=3` | Ranked suggestions with reasons |
| `POST /planner/plan-week` | Proposed planned days; writes nothing |
| `POST /planner/apply-plan` | `{"moves": [{"task_id", "planned_for"}]}`, all or nothing |
| `GET` / `PATCH /planner/settings` | `timezone`, `daily_capacity_minutes`, `briefings_enabled`, `morning_at`, `evening_at` |
| `POST` / `GET` / `DELETE /tokens` | Personal access tokens (sign-in only) |

Tasks gained `course`, `kind` (`task`, `assignment`, `exam`, `reading`, `revision`, `study`), `planned_for` (a day in your timezone), `estimate_minutes` and `completed_at` (set when a task is completed, cleared if it is reopened). The person a task was given to can change its status and planned day; everything else stays with whoever made it.

## Installing on an iPhone

Open the deployed `APP_URL` in **Safari**, tap **Share → Add to Home Screen**, then open Tasktion from the home screen and sign in once. The home-screen app keeps its own sign-in, separate from Safari.

## Project Structure

```
Tasktion_App/
├── backend/                         # All Python server-side code
│   ├── app/
│   │   ├── api/                     # FastAPI route modules (auth, invites, tasks, users, planner, tokens)
│   │   ├── core/                    # Config, security, database setup
│   │   ├── models/                  # SQLAlchemy models
│   │   ├── schemas/                 # Pydantic schemas
│   │   ├── services/                # Planner, briefings, email, scheduler services
│   │   └── main.py                  # FastAPI app entrypoint
│   ├── alembic/                     # Database migration history
│   ├── .env                         # Local secrets (never commit)
│   └── .env.example                 # Environment template
├── public/                          # Client-side app (pages, scripts, icons)
│   ├── pages/                       # HTML pages (login, onboarding, dashboard)
│   ├── css/                         # Stylesheets
│   └── js/                          # Frontend scripts (session, api, auth, tasks)
├── tasktion_mcp/                    # Local MCP server for Claude Desktop (own requirements.txt)
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
| `SCHEDULER_ENABLED`   | In-process timer for reminders and briefings (default: on); keep it on in one process only |
| `CRON_SECRET`         | Optional bearer token to trigger reminders with `POST /cron/reminders` |

Planner settings (timezone, daily capacity, briefings and their times) are stored per member, not in the environment. The MCP server on your Mac reads two variables of its own from `claude_desktop_config.json`: `TASKTION_URL` (your Tasktion address) and `TASKTION_TOKEN` (a `tsk_…` token from the dashboard).

## License

This project is licensed under the terms specified in the [LICENSE](LICENSE) file.
