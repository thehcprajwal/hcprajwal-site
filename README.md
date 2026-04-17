# hc_system — hcprajwal.in

Terminal-based personal portfolio. Simulates a shell with an AI agent, contact form, analytics dashboard, and resume downloads.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla JS, Three.js, Vite |
| Backend | Node.js, Hono |
| Database | SQLite (better-sqlite3) |
| AI | Groq (llama-3.3-70b) |
| Infra | Docker, Caddy, AWS Lightsail |
| Automation | n8n (contact delivery) |

## Local dev

```bash
cp .env.example .env   # fill in GROQ_API_KEY and other vars
npm install
npm run dev            # starts Vite + Express concurrently
```

Visit `http://localhost:5173` (frontend) — API runs on `:3001`.

## Environment variables

See `.env.example` for the full list. Required at minimum:

- `GROQ_API_KEY` — from console.groq.com
- `ANALYTICS_PASSWORD` — password for `analytics --pass <pwd>` command
- `N8N_WEBHOOK_URL` — n8n webhook that handles contact form delivery

In production, AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`) are stored in the server `.env` and used to fetch remaining secrets from AWS Parameter Store at startup.

## Deploy

```bash
# Edit SERVER in deploy.sh with your Lightsail IP, then:
./deploy.sh
```

The script validates the placeholder is replaced and `.env` exists before running. It rsyncs everything except `node_modules`, `dist`, `data`, and `.env`, then copies `.env` separately and rebuilds Docker containers on the server.

## Architecture

```
Browser
  └── Caddy (TLS, reverse proxy)
        ├── /          → static dist/ (Vite build)
        └── /api/*     → Hono server (:3001)
                            ├── /api/agent     → Groq streaming SSE
                            ├── /api/contact   → n8n webhook
                            ├── /api/track     → SQLite analytics
                            ├── /api/analytics → analytics dashboard
                            ├── /api/resume/*  → GitHub releases proxy
                            └── /api/health    → health check
```

## Database

SQLite at `data/hcsystem.db`. Single table: `analytics_events` (pageviews, commands, agent queries, contact submissions). Backed up daily to `./backups/` — keeps last 7 copies.

## Terminal commands

| Command | Description |
|---|---|
| `help` | Show all commands |
| `whoami` | About Prajwal HC |
| `skills` | Tech skills matrix |
| `projects` | Portfolio projects |
| `contact` | Interactive contact form |
| `agent <question>` | Ask the AI agent |
| `resume --list` | List resume variants |
| `resume --download` | Download latest resume |
| `analytics --pass <pwd>` | View site analytics |
| `reset` | Clear agent memory |
| `clear` | Clear terminal |
