# hc_system — hcprajwal.in

Terminal-based personal portfolio. Simulates a shell with an AI agent and contact form.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla JS, Three.js, Vite |
| Backend | Node.js, Hono |
| AI | OpenRouter (llama-3.1-8b, free tier) |
| Email | Resend |
| Infra | Docker, Caddy |

## Local dev

```bash
cp .env.example .env   # fill in values
npm install
npm run dev            # starts Vite + Hono concurrently
```

Frontend: `http://localhost:5173` — API: `http://localhost:3001`

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | yes | from openrouter.ai |
| `RESEND_API_KEY` | yes | from resend.com — verify your domain first |
| `DOMAIN` | prod only | e.g. `hcprajwal.in`, sets CORS origin |
| `OPENROUTER_MODEL` | no | defaults to `meta-llama/llama-3.1-8b-instruct:free` |

## Deploy

Works with any SSH-accessible Linux host (Lightsail, Raspberry Pi, VPS):

```bash
export SERVER="ubuntu@your-server-ip"   # or pi@raspberrypi.local
./deploy.sh
```

## Architecture

```
Browser
  └── Caddy (TLS + static files)
        └── /api/*  →  Hono server (:3001, internal only)
                          ├── /api/agent    → OpenRouter SSE stream
                          ├── /api/contact  → Resend email
                          └── /api/health   → health check
```

Two containers: `app` (Hono) and `caddy`. No database, no volumes other than Caddy TLS certs.

## Terminal commands

| Command | Description |
|---|---|
| `help` | Show all commands |
| `whoami` | About Prajwal HC |
| `skills` | Tech skills matrix |
| `projects` | Portfolio projects |
| `contact` | Interactive contact form |
| `agent <question>` | Ask the AI agent |
| `resume` | View resume (opens GitHub releases) |
| `reset` | Clear agent memory |
| `clear` | Clear terminal |
