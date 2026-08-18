# Railway Deployment Guide

Deploy the ReachInbox Email Scheduler as **5 Railway services** from one GitHub repo.

## Architecture on Railway

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Frontend   │────►│   Backend   │────►│  PostgreSQL  │
│  (Next.js)  │     │  (Express)  │     └──────────────┘
└─────────────┘     └──────┬──────┘
                           │
                    ┌──────▼──────┐     ┌──────────────┐
                    │   Worker    │────►│    Redis     │
                    │  (BullMQ)   │     └──────────────┘
                    └─────────────┘
```

## Step 1 — Create Railway project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select `Megha-TR/Outbox-assignment-`

## Step 2 — Add databases

In your Railway project:

1. Click **+ New** → **Database** → **PostgreSQL**
2. Click **+ New** → **Database** → **Redis**

## Step 3 — Deploy Backend API

1. Click **+ New** → **GitHub Repo** → select the same repo again
2. Rename service to `backend`
3. Go to **Settings**:
   - **Root Directory:** leave empty (repo root)
   - **Dockerfile Path:** `backend/Dockerfile`
4. Go to **Variables** → **Add Reference** / set:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
NEXTAUTH_SECRET=<same-secret-as-frontend>
FRONTEND_URL=https://<your-frontend-domain>.up.railway.app
PORT=4000
```

5. **Settings → Networking → Generate Domain** (e.g. `backend-production-xxxx.up.railway.app`)

## Step 4 — Deploy Worker

1. **+ New** → **GitHub Repo** → same repo
2. Rename to `worker`
3. **Settings:**
   - **Dockerfile Path:** `backend/Dockerfile.worker`
4. **Variables** (same as backend, minus PORT/FRONTEND_URL if not needed):

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
NEXTAUTH_SECRET=<same-secret>
```

## Step 5 — Deploy Frontend

1. **+ New** → **GitHub Repo** → same repo
2. Rename to `frontend`
3. **Settings:**
   - **Dockerfile Path:** `frontend/Dockerfile`
4. **Variables:**

```env
NEXTAUTH_URL=https://<your-frontend-domain>.up.railway.app
NEXTAUTH_SECRET=<same-secret-as-backend>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
NEXT_PUBLIC_API_URL=https://<your-backend-domain>.up.railway.app
```

5. **Settings → Build** → add build arg (if using Dockerfile build args):
   - `NEXT_PUBLIC_API_URL=https://<backend-domain>.up.railway.app`
6. **Generate Domain** for frontend

## Step 6 — Update Google OAuth

In [Google Cloud Console](https://console.cloud.google.com/) → **Clients**:

Add authorized redirect URI:
```
https://<your-frontend-domain>.up.railway.app/api/auth/callback/google
```

## Step 7 — Fix cross-service URLs

After all domains are generated, update:

| Service | Variable | Value |
|---|---|---|
| backend | `FRONTEND_URL` | frontend Railway URL |
| frontend | `NEXTAUTH_URL` | frontend Railway URL |
| frontend | `NEXT_PUBLIC_API_URL` | backend Railway URL |

Redeploy frontend after changing `NEXT_PUBLIC_API_URL` (it's baked in at build time).

## Step 8 — Verify

1. Open frontend URL → Google login
2. Schedule emails with `sample-leads.csv`
3. Check Scheduled → Sent tabs
4. Backend health: `https://<backend-url>/health`

## Cost estimate

- Railway Hobby: ~$5/month credit
- 3 services + Postgres + Redis ≈ may exceed free tier — monitor usage in dashboard

## Troubleshooting

| Issue | Fix |
|---|---|
| Frontend can't reach API | Check `NEXT_PUBLIC_API_URL` matches backend domain; redeploy frontend |
| 401 on API calls | Ensure `NEXTAUTH_SECRET` is identical on frontend + backend |
| Google login fails | Add production redirect URI; add your email as test user |
| Emails not sending | Check worker service logs; confirm Redis is linked |
| DB errors | Check `DATABASE_URL` reference on backend + worker |

## Submission links

Use these in the ClickUp form:

- **GitHub:** https://github.com/Megha-TR/Outbox-assignment-
- **Live demo:** https://`<frontend-domain>`.up.railway.app
- **API health:** https://`<backend-domain>`.up.railway.app/health
