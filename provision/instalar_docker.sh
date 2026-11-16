#!/bin/bash
# Instala Docker Engine + Docker Compose plugin en Ubuntu 22.04 (repositorio oficial).
# Es lo UNICO que se instala en el sistema operativo de las VMs; todo lo demas corre en contenedores.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "[docker] Docker ya esta instalado: $(docker --version)"
  exit 0
fi

echo "[docker] Instalando Docker Engine..."
apt-get update -y
apt-get install -y ca-certificates curl rsync
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

usermod -aG docker vagrant
systemctl enable --now docker

# Zona horaria de la VM (las graficas de Zabbix usan la hora del servidor)
timedatectl set-timezone America/Bogota || true

docker --version
docker compose version
