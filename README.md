# ☁️ Anime Cloud VPS Panel

Professional multi-node VPS panel using **KVM/QEMU + libvirt**. **Proxmox is not required.**

> The repository contains the Anime Cloud panel and KVM node-agent foundation. Before production use, complete and test authentication, billing, IP allocation, provisioning, console, backups and security controls for your environment.

## Architecture

```text
Customer/Admin
      ↓
Anime Cloud Web
      ↓
Anime Cloud API
      ↓
Queue / Worker
      ↓
KVM Node Agent
      ↓
libvirt + QEMU/KVM
      ↓
VPS
```

## Stack

- Next.js frontend
- Node.js + Express API
- Prisma + PostgreSQL
- Redis/worker-ready architecture
- KVM/QEMU + libvirt
- Cloud-init-ready node infrastructure
- Browser SSH/WebSocket foundation
- Docker Compose

# 🚀 Installation

## 1. Panel server requirements

Recommended:

- Ubuntu 22.04/24.04 LTS
- 2+ vCPU
- 4 GB+ RAM
- 40 GB+ SSD
- Public IP
- Domain name recommended
- Docker + Docker Compose

## 2. Install the Anime Cloud panel

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin
sudo systemctl enable --now docker

git clone https://github.com/sureshkumak26-art/Anime-vm.git
cd Anime-vm

cp .env.example .env
nano .env
```

Set strong, unique values for database credentials, JWT secrets and other secrets in `.env`.

Start the application:

```bash
docker compose up -d --build
```

Check the containers:

```bash
docker compose ps
docker compose logs -f
```

If Prisma migrations are included in your deployment, run the project's migration command. For the current starter schema:

```bash
docker compose exec api npx prisma generate
docker compose exec api npx prisma db push
```

The default development endpoints are:

```text
Web: http://SERVER-IP:3000
API: http://SERVER-IP:4000
```

For production, put the web/API behind HTTPS and a reverse proxy such as Nginx or Caddy.

# 🖥️ 3. Install a KVM node

Run this on **each physical KVM server**. Hardware virtualization must be available.

Check first:

```bash
ls -l /dev/kvm
```

Install the node agent:

```bash
git clone https://github.com/sureshkumak26-art/Anime-vm.git
cd Anime-vm
sudo bash node-agent/install-kvm.sh
```

The installer installs the KVM/libvirt prerequisites and creates the Anime Cloud node-agent service.

Configure the agent:

```bash
sudo nano /etc/anime-cloud-agent.env
```

Example:

```env
ANIME_CLOUD_API=https://panel.example.com/api/v1
NODE_ID=YOUR_NODE_ID
AGENT_KEY=YOUR_AGENT_KEY
HEARTBEAT_SECONDS=10
```

Protect the file:

```bash
sudo chmod 600 /etc/anime-cloud-agent.env
```

Restart and verify:

```bash
sudo systemctl restart anime-cloud-agent
sudo systemctl status anime-cloud-agent
```

Live logs:

```bash
sudo journalctl -u anime-cloud-agent -f
```

## 4. Verify KVM/libvirt

```bash
ls -l /dev/kvm
lsmod | grep kvm
sudo systemctl status libvirtd
sudo virsh list --all
sudo virsh uri
```

If `/dev/kvm` is missing, check that the physical server has hardware virtualization enabled. If this is itself a VPS, your provider must support nested virtualization for KVM guests.

# 🌍 5. Multiple KVM nodes

Install the node agent separately on every node. Give each node a unique ID and agent key.

Example:

```text
India-01
India-02
Dubai-01
USA-01
```

Recommended node properties:

- Unique node ID
- Friendly name
- CPU capacity
- RAM capacity
- Disk capacity
- Node status
- Last heartbeat
- Maintenance state

The panel can then select a suitable node based on available resources.

# 🌐 6. Networking

KVM guests need a working network design before VPS provisioning. Configure a Linux bridge or another supported virtual network on each host, plus routing/NAT as appropriate for your provider.

Do **not** expose libvirt directly to the public internet. Keep management traffic private or protected with authenticated TLS/network controls.

# 🔐 7. Security

Never commit these values to GitHub:

```text
.env
Database passwords
JWT secrets
AGENT_KEY
SSH private keys
API tokens
Payment secrets
```

Use:

- HTTPS
- Strong random secrets
- Least-privilege service accounts
- Firewall rules
- Authenticated node-agent communication
- Short-lived SSH sessions
- RBAC for admin/customer operations
- Audit logging
- Regular database backups

# 🖥️ 8. VPS operations

The target Anime Cloud architecture supports:

```text
Create VPS
Start
Stop
Restart
Delete
Reinstall
Snapshots
Backups
Browser SSH
Browser VNC/Console
Live CPU/RAM/Disk/Network
```

Only expose operations that are implemented and tested in the deployed version.

# 🧰 9. Troubleshooting

Panel:

```bash
docker compose ps
docker compose logs -f
```

Node agent:

```bash
sudo systemctl status anime-cloud-agent
sudo journalctl -u anime-cloud-agent -f
```

KVM:

```bash
ls -l /dev/kvm
lsmod | grep kvm
```

libvirt:

```bash
sudo systemctl status libvirtd
sudo virsh list --all
```

# 🔄 Update

From the panel server:

```bash
cd Anime-vm
git pull
docker compose up -d --build
```

On each KVM node:

```bash
cd Anime-vm
git pull
sudo systemctl restart anime-cloud-agent
```

# ⚠️ Production note

This is an extensible VPS-panel project, not a guarantee of a production-ready hosting service by itself. Test VM lifecycle, networking, storage, authentication, authorization, SSH/console access, backups, quotas, billing and failure recovery on your infrastructure before selling VPS services.

## Repository

https://github.com/sureshkumak26-art/Anime-vm
