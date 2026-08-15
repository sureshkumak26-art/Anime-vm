# Anime Cloud VPS Panel

Production-oriented starter for a Proxmox-backed VPS control panel.

## Stack
- Next.js + TypeScript frontend
- Node.js + Express API
- Prisma + PostgreSQL
- Redis-ready worker architecture
- Proxmox API integration
- Docker Compose

## Quick start

```bash
cp .env.example .env
# edit .env and set strong secrets
sudo ./install.sh
```

The API is exposed on port 4000 and the web UI on port 3000 by default.

## Proxmox

Create a dedicated Proxmox API token with only the permissions required by the panel. Never expose the token secret to the browser. Set `PROXMOX_URL`, `PROXMOX_TOKEN_ID`, and `PROXMOX_TOKEN_SECRET` in `.env`.

## API

- `GET /api/v1/health`
- `GET /api/v1/plans`
- `GET /api/v1/nodes`
- `GET /api/v1/vps`
- `POST /api/v1/vps/:vmid/start`
- `POST /api/v1/vps/:vmid/stop`
- `POST /api/v1/vps/:vmid/reboot`
- `GET /api/v1/vps/:vmid/status`

This repository is an extensible MVP. Add authentication, billing, IP allocation, RBAC, jobs, audit logging and a production reverse proxy before exposing it to customers.
