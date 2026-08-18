# ReachInbox Email Job Scheduler

Production-style email scheduling service built for the Outbox Labs / ReachInbox internship assignment.

## Stack

- **Backend:** TypeScript, Express, BullMQ, Redis, PostgreSQL, Prisma, Nodemailer (Ethereal SMTP)
- **Frontend:** Next.js, Tailwind CSS, NextAuth (Google OAuth)
- **Infra:** Docker Compose for PostgreSQL + Redis

## Architecture

```
Frontend (Next.js) ──► Express API ──► PostgreSQL (source of truth)
                           │
                           └──► BullMQ Queue ──► Redis
                                      │
                               Worker process ──► Ethereal SMTP
```

### Scheduling

1. User uploads leads CSV and scheduling settings via the dashboard.
2. API creates one `EmailJob` row per recipient with a computed `scheduledAt`.
3. Each job is enqueued in BullMQ as a **delayed job** (`delay = scheduledAt - now`).
4. Worker picks up jobs, applies rate limits, and sends via Ethereal.

### Persistence on restart

- BullMQ stores jobs in Redis.
- PostgreSQL stores job status (`scheduled`, `processing`, `sent`, `failed`, `delayed`).
- On API/worker startup, pending DB jobs missing from the queue are re-enqueued.
- Idempotency: worker skips jobs already marked `sent`; claims jobs with a conditional DB update.

### Rate limiting & concurrency

| Setting | Default | Description |
|---|---|---|
| `WORKER_CONCURRENCY` | 5 | Parallel jobs per worker |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | 2000 | BullMQ limiter: min gap between sends |
| `MAX_EMAILS_PER_HOUR` | 200 | Global Redis counter per hour window |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | 50 | Per-sender Redis counter per hour window |

When hourly limits are hit, jobs are **rescheduled** to the next hour (not dropped).

## Quick start

### 1. Start Postgres + Redis (Docker)

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Edit both files:

- Set the **same** `NEXTAUTH_SECRET` in backend and frontend
- Add your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI in Google Cloud Console

### 4. Set up Ethereal Email

Ethereal is a **fake SMTP service** for testing — no real emails are delivered.

**Option A — Auto (recommended):** Leave `ETHEREAL_USER` and `ETHEREAL_PASS` unset in `backend/.env`. The worker creates a test account automatically on first send and caches credentials in the database.

**Option B — Manual:** Create an account at [ethereal.email](https://ethereal.email/), then add to `backend/.env`:

```env
ETHEREAL_USER=your-ethereal-user
ETHEREAL_PASS=your-ethereal-pass
```

Sent emails show an Ethereal **preview URL** in the Sent tab Details column.

### 5. Run database setup

```bash
npm run db:generate
npm run db:push
```

Or with migrations:

```bash
npm run db:migrate
```

### 6. Start services (3 terminals)

```bash
# Terminal 1 — API
npm run dev:backend

# Terminal 2 — BullMQ worker
npm run dev:worker

# Terminal 3 — Frontend
npm run dev:frontend
```

Open http://localhost:3000

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `NEXTAUTH_SECRET` | Yes | Must match frontend — used to verify JWT |
| `PORT` | No | API port (default: 4000) |
| `FRONTEND_URL` | No | CORS origin (default: http://localhost:3000) |
| `WORKER_CONCURRENCY` | No | Parallel worker jobs (default: 5) |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | No | Min gap between sends (default: 2000) |
| `MAX_EMAILS_PER_HOUR` | No | Global hourly cap (default: 200) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | No | Per-sender hourly cap (default: 50) |
| `ETHEREAL_USER` | No | Ethereal SMTP user (auto-created if omitted) |
| `ETHEREAL_PASS` | No | Ethereal SMTP pass (auto-created if omitted) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_URL` | Yes | App URL (http://localhost:3000) |
| `NEXTAUTH_SECRET` | Yes | Must match backend |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL (http://localhost:4000) |

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/me` | Current user |
| GET | `/api/scheduled` | Scheduled/delayed emails |
| GET | `/api/sent` | Sent/failed emails |
| POST | `/api/parse-leads` | Parse CSV and return lead count |
| POST | `/api/schedule` | Schedule a campaign |

All `/api/*` routes require `Authorization: Bearer <NextAuth JWT>`.

## Demo checklist (for video)

1. Sign in with Google
2. Compose email, upload `sample-leads.csv`, schedule
3. Show Scheduled tab, then Sent tab after worker runs
4. Stop API + worker, restart both — future emails still send
5. (Bonus) Schedule many emails with low hourly limit to show delay/reschedule

## Features implemented

### Backend
- [x] BullMQ delayed jobs (no cron)
- [x] PostgreSQL persistence
- [x] Restart recovery
- [x] Idempotent sends
- [x] Worker concurrency
- [x] Inter-email delay (BullMQ limiter)
- [x] Global + per-sender hourly rate limits (Redis)
- [x] Ethereal Email SMTP
- [x] Multi-sender support

### Frontend
- [x] Google OAuth login
- [x] Dashboard with user header + logout
- [x] Scheduled / Sent tabs
- [x] Compose modal with CSV upload + lead count
- [x] Loading and empty states
- [x] TypeScript types for API responses

## Demo video script (max 5 min)

1. **Login** — Google OAuth, show header with name/avatar
2. **Schedule** — Compose modal, upload `sample-leads.csv`, set future start time, confirm preview text
3. **Scheduled tab** — Show emails waiting before send time
4. **Sent tab** — Show emails after worker sends; open Ethereal preview link
5. **Restart test** — Stop backend + worker (`Ctrl+C`), restart both, show future jobs still send
6. **(Bonus)** — Schedule 10+ emails with `hourly limit = 2` to show rate-limit delay

## Assumptions & trade-offs

- Ethereal accounts are auto-created per sender on first use; credentials are cached in DB.
- Rate limit counters use Redis `INCR` per hour window — good enough for this scope; not a token-bucket.
- Campaign-level `hourlyLimit` caps per-sender throughput alongside the global env limit.
- UI follows a clean dashboard layout inspired by the Figma; pixel-perfect match can be refined further.

## Submission

- **Repo:** https://github.com/Megha-TR/Outbox-assignment-
- **Live demo:** Deploy to Railway — see [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Collaborators:** `Mitrajit`, `Yadav036`
- **Form:** [Assignment Submission](https://forms.clickup.com/9005062261/f/8cbwp3n-8876/6NNNJ92DV93PQTAYST)
