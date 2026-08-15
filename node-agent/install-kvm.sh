#!/usr/bin/env bash
set -euo pipefail

# Anime Cloud KVM Node Agent prerequisites for Ubuntu 24.04/22.04.
# This installer intentionally does NOT expose libvirt or SSH credentials to the internet.

if [[ $EUID -ne 0 ]]; then echo 'Run as root: sudo bash install-kvm.sh'; exit 1; fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  qemu-kvm libvirt-daemon-system libvirt-clients qemu-utils \
  cloud-image-utils bridge-utils curl ca-certificates jq

systemctl enable --now libvirtd

mkdir -p /opt/anime-cloud-agent /var/lib/anime-cloud/images /var/lib/anime-cloud/vms

cat >/etc/anime-cloud-agent.env <<'EOF'
ANIME_CLOUD_API=https://panel.example.com/api/v1
NODE_ID=CHANGE_ME
AGENT_KEY=CHANGE_ME
HEARTBEAT_SECONDS=10
EOF
chmod 600 /etc/anime-cloud-agent.env

cat >/etc/systemd/system/anime-cloud-agent.service <<'EOF'
[Unit]
Description=Anime Cloud KVM Node Agent
After=network-online.target libvirtd.service
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/anime-cloud-agent.env
ExecStart=/opt/anime-cloud-agent/agent.sh
Restart=always
RestartSec=5
User=root
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

cat >/opt/anime-cloud-agent/agent.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
source /etc/anime-cloud-agent.env
while true; do
  mem_total=$(awk '/MemTotal/{print $2}' /proc/meminfo)
  mem_free=$(awk '/MemAvailable/{print $2}' /proc/meminfo)
  cpu=$(nproc)
  disk=$(df -P /var/lib/anime-cloud | awk 'NR==2 {print $4}')
  payload=$(jq -n --arg nodeId "$NODE_ID" --arg hostname "$(hostname)" --argjson cpu "$cpu" --argjson memTotal "$mem_total" --argjson memFree "$mem_free" --arg disk "$disk" '{nodeId:$nodeId,hostname:$hostname,resources:{cpuCores:$cpu,memKB:$memTotal,memAvailableKB:$memFree,diskFreeKB:$disk}}')
  curl -fsS --max-time 10 -X POST "$ANIME_CLOUD_API/agent/heartbeat" -H "x-agent-key: $AGENT_KEY" -H 'content-type: application/json' -d "$payload" >/dev/null || true
  sleep "${HEARTBEAT_SECONDS:-10}"
done
EOF
chmod 700 /opt/anime-cloud-agent/agent.sh
systemctl daemon-reload
systemctl enable --now anime-cloud-agent

echo 'Anime Cloud KVM node prerequisites installed.'
echo 'Edit /etc/anime-cloud-agent.env with ANIME_CLOUD_API, NODE_ID and AGENT_KEY, then: systemctl restart anime-cloud-agent'
EOF
