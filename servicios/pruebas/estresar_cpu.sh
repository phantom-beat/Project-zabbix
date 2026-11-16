#!/bin/bash
# PRUEBA: alerta por umbral. Genera carga de CPU dentro de un contenedor
# para disparar el trigger "Uso de CPU alto en ... (>80%)" (se evalua sobre 1 minuto).
# Nota: sin cgroup-aware /proc, la CPU que reporta el agente es la de la VM completa,
#       por eso se lanza un bucle por cada nucleo.
# Uso:  sudo /opt/st/servicios/pruebas/estresar_cpu.sh web 180
set -e
cd "$(dirname "$0")/.."
H="${1:-web}"
SEG="${2:-180}"
NUCLEOS=$(nproc)
echo "$(date '+%H:%M:%S')  Estresando CPU en '$H' con $NUCLEOS bucles durante ${SEG}s..."
for _ in $(seq "$NUCLEOS"); do
  docker compose exec -d "$H" sh -c "timeout $SEG sh -c 'while :; do :; done'"
done
echo "Observa en Zabbix: grafica 'CPU / memoria / disco' del host '$H' y el problema"
echo "'Uso de CPU alto en ...' (aprox. 1-2 min). Luego llega el correo a MailHog."
