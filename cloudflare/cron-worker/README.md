# Cloudflare Cron Triggers (Workers) for F-Shop

This repo already exposes job endpoints:

- `POST /api/admin/jobs/auto-cancel?horizonHours=48`
- `POST /api/admin/jobs/reminders`

This Cloudflare Worker triggers those endpoints on schedules (UTC).

## 1) Prereqs

- Install Wrangler: `npm i -g wrangler` (or use `npx wrangler ...`)
- Login: `wrangler login`

## 2) Envs: where to put what

There are **two places** you must configure values:

- **Vercel (your Next.js app envs)**: the API endpoints validate `x-job-secret`.
  - `AUTO_CANCEL_JOB_SECRET`

- **Cloudflare Worker secrets**: the Worker needs these to call Vercel.
  - `TARGET_BASE_URL` (your Vercel URL)
  - `AUTO_CANCEL_JOB_SECRET`

## 2) Configure secrets (recommended)

Set secrets for the Worker (not in git):

```bash
cd cloudflare/cron-worker

wrangler secret put TARGET_BASE_URL
# e.g. https://yourdomain.com

wrangler secret put AUTO_CANCEL_JOB_SECRET
```

Notes:
- `TARGET_BASE_URL` must point at your deployed Next.js app.
- In the app, set matching env vars:
  - `AUTO_CANCEL_JOB_SECRET`
  so the API endpoints accept `x-job-secret` from the Worker.

## 3) Deploy

```bash
npm run deploy:worker
```

## 3.1) Local dev (optional)

```bash
cp cloudflare/cron-worker/.dev.vars.example cloudflare/cron-worker/.dev.vars
npm run dev:worker
```

## 4) Schedules (UTC)

Configured in `wrangler.toml`:

- Auto-cancel: every 10 minutes (`*/10 * * * *`)
- Reminders: 01:00 UTC daily (`0 1 * * *`) → **09:00 KL (UTC+8)**

