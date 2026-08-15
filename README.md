# Anime Cloud VPS Panel

Production-oriented starter for a Proxmox-backed VPS control panel.

## Stack
- Next.js frontend
- Node.js + Express API
- Prisma + PostgreSQL
- Redis-ready worker architecture
- Proxmox API integration
- Docker Compose

## Quick start

```bash
cp .env.example .env
nano .env
sudo ./install.sh
```

The API is exposed on port 4000 and the web UI on port 3000 by default.

## Multiple Proxmox nodes

Nodes are stored in PostgreSQL, so Anime Cloud can manage multiple independent Proxmox servers. Each node has:

- Friendly name
- Proxmox node name
- Host/IP
- API port
- Dedicated API token
- Priority
- Optional maximum VPS count
- Online/offline/maintenance state
- Last health-check timestamp

The panel does not expose Proxmox secrets to customers.

Set a strong `ADMIN_API_KEY` in `.env` for node-management endpoints.

### Add a node

```bash
curl -X POST http://SERVER-IP:4000/api/v1/admin/nodes \
  -H 'Content-Type: application/json' \
  -H 'x-admin-key: YOUR_ADMIN_API_KEY' \
  -d '{
    "name":"India-01",
    "proxmoxNodeName":"pve01",
    "host":"10.0.0.11",
    "port":8006,
    "tokenId":"panel@pve!anime-cloud",
    "tokenSecret":"CHANGE_ME",
    "priority":10,
    "maxVPS":100
  }'
```

Add another node using the same endpoint:

```bash
curl -X POST http://SERVER-IP:4000/api/v1/admin/nodes \
  -H 'Content-Type: application/json' \
  -H 'x-admin-key: YOUR_ADMIN_API_KEY' \
  -d '{
    "name":"India-02",
    "proxmoxNodeName":"pve02",
    "host":"10.0.0.12",
    "port":8006,
    "tokenId":"panel@pve!anime-cloud",
    "tokenSecret":"CHANGE_ME",
    "priority":20,
    "maxVPS":100
  }'
```

### Node APIs

- `GET /api/v1/nodes` — public active-node summary
- `GET /api/v1/admin/nodes` — all nodes
- `POST /api/v1/admin/nodes` — add node
- `PATCH /api/v1/admin/nodes/:id` — update node
- `DELETE /api/v1/admin/nodes/:id` — remove empty node
- `POST /api/v1/admin/nodes/:id/test` — test node
- `GET /api/v1/admin/nodes/health` — check all active nodes

### VPS APIs

- `GET /api/v1/vps` — aggregate VPS list from all active nodes
- `GET /api/v1/vps?nodeId=NODE_ID` — VPS list for one node
- `POST /api/v1/vps/:vmid/start?nodeId=NODE_ID`
- `POST /api/v1/vps/:vmid/stop?nodeId=NODE_ID`
- `POST /api/v1/vps/:vmid/reboot?nodeId=NODE_ID`
- `GET /api/v1/vps/:vmid/status?nodeId=NODE_ID`

If a VPS record exists in the database, its `nodeId` can be used automatically for actions.

## Database update

After pulling the new version, regenerate Prisma and apply the schema:

```bash
docker compose up -d --build
docker compose exec api npx prisma generate
docker compose exec api npx prisma db push
```

For production, use versioned Prisma migrations rather than `db push`.

## Proxmox security

Create a dedicated Proxmox API token with only the permissions required by the panel. Never expose token secrets to the browser. Prefer TLS verification in production (`PROXMOX_TLS_REJECT_UNAUTHORIZED=true`) and use valid certificates.

This repository remains an extensible MVP. Add full authentication, billing, IP allocation, RBAC, provisioning jobs, audit logging, console/VNC, monitoring and a production reverse proxy before exposing it to customers.
