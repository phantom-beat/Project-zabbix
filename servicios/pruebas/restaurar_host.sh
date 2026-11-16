#!/bin/bash
# Vuelve a levantar un host detenido y recrea su agente (sidecar).
# Uso:  sudo /opt/st/servicios/pruebas/restaurar_host.sh ftp
set -e
cd "$(dirname "$0")/.."
H="${1:-ftp}"
echo "$(date '+%H:%M:%S')  Levantando '$H' y su agente..."
docker compose up -d "$H"
docker compose up -d --force-recreate "agent-$H"
docker compose ps
echo
echo "En ~1 minuto Zabbix marcara los problemas como RESUELTOS y MailHog recibira el correo 'Resuelto: ...'."
