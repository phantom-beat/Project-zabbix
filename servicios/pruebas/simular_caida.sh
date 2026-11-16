#!/bin/bash
# PRUEBA: simulacion de caida de host.
# Detiene el contenedor de un servicio (y con el su agente, que comparte su red).
# Uso (en la VM zbx-servicios):  sudo /opt/st/servicios/pruebas/simular_caida.sh ftp
set -e
cd "$(dirname "$0")/.."
H="${1:-ftp}"
case "$H" in web|db|dns|ftp) ;; *) echo "Uso: $0 web|db|dns|ftp"; exit 1;; esac

echo "$(date '+%H:%M:%S')  Deteniendo el host '$H'..."
docker compose stop "$H" "agent-$H"
docker compose ps
cat <<EOF

Que observar (1-2 minutos):
  * Zabbix > Monitoring > Problems:
      - "$H no responde a ping (ICMP)"            (Desastre)
      - "Agente Zabbix sin respuesta en ..."       (Alta)
  * Zabbix > Monitoring > Hosts: icono ZBX del host '$H' en rojo
  * Dashboard "ST - Monitoreo de infraestructura": disponibilidad y problemas
  * MailHog http://192.168.60.10:8025 -> correo "Problema: ..."

Para recuperar el host:  sudo $(pwd)/pruebas/restaurar_host.sh $H
EOF
