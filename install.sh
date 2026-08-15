#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then echo 'Run as root: sudo ./install.sh'; exit 1; fi

apt-get update
apt-get install -y ca-certificates curl git
if ! command -v docker >/dev/null 2>&1; then curl -fsSL https://get.docker.com | sh; fi
systemctl enable --now docker

if [[ ! -f .env ]]; then cp .env.example .env; echo 'Created .env. Edit Proxmox credentials and secrets, then run: docker compose up -d --build'; exit 0; fi

docker compose up -d --build

echo 'Anime Cloud VPS Panel started.'
echo 'Web: http://SERVER-IP:3000'
echo 'API: http://SERVER-IP:4000/api/v1/health'
