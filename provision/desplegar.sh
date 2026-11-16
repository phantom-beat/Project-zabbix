#!/bin/bash
# Copia la carpeta del rol (servidor | servicios) desde /vagrant a /opt/st/<rol>
# y levanta el docker-compose correspondiente.
#
# Se copia (en vez de usar /vagrant directamente) porque la carpeta compartida de
# VirtualBox monta todo con permisos 777 y dueño vagrant: MySQL y vsftpd rechazan
# archivos de configuracion con esos permisos. Ademas se eliminan los CRLF de Windows.
set -euo pipefail

ROL="${1:?Uso: desplegar.sh servidor|servicios}"
SRC="/vagrant/${ROL}"
DST="/opt/st/${ROL}"

echo "[desplegar] Rol: ${ROL}  (${SRC} -> ${DST})"
mkdir -p "${DST}"
rsync -a --delete "${SRC}/" "${DST}/"

# Normalizar finales de linea y permisos
find "${DST}" -type f -exec sed -i 's/\r$//' {} +
chown -R root:root "${DST}"
find "${DST}" -type d -exec chmod 755 {} +
find "${DST}" -type f -exec chmod 644 {} +
find "${DST}" -type f -name '*.sh' -exec chmod 755 {} +

cd "${DST}"
docker compose up -d --build

if [ "${ROL}" = "servidor" ]; then
  echo "[desplegar] Esperando a que termine la configuracion automatica de Zabbix (API)..."
  timeout 1200 docker compose logs -f --no-log-prefix zabbix-config || true
  echo
  echo "=============================================================="
  echo " Zabbix Web : http://192.168.60.10:8080   (Admin / zabbix)"
  echo " MailHog    : http://192.168.60.10:8025"
  echo "=============================================================="
else
  # Vigilante de agentes sidecar: cada minuto reengancha un agente si su servicio se reinicio
  cat > /etc/systemd/system/st-vigilar-agentes.service <<EOF
[Unit]
Description=Reengancha los agentes Zabbix sidecar a su servicio (Proyecto 7)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=${DST}/pruebas/vigilar_agentes.sh
EOF
  cat > /etc/systemd/system/st-vigilar-agentes.timer <<EOF
[Unit]
Description=Ejecuta st-vigilar-agentes cada minuto

[Timer]
OnBootSec=90
OnUnitActiveSec=60

[Install]
WantedBy=timers.target
EOF
  systemctl daemon-reload
  systemctl enable --now st-vigilar-agentes.timer

  echo "=============================================================="
  echo " Web  : http://192.168.60.20"
  echo " DNS  : nslookup web.servicios.local 192.168.60.20"
  echo " FTP  : ftp 192.168.60.20 (usuario/clave en servicios/.env)"
  echo "=============================================================="
fi

docker compose ps
