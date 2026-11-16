#!/bin/sh
# Script de alerta personalizado (media type "ST Registro local").
# Zabbix lo invoca con: $1 = destinatario, $2 = asunto, $3 = mensaje
# Deja un registro de cada alerta en /var/log/st/alertas.log (volumen "alertas").
LOG=/var/log/st/alertas.log
{
  echo "=================================================="
  echo "Fecha     : $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Para      : $1"
  echo "Asunto    : $2"
  echo "Mensaje   :"
  echo "$3"
} >> "$LOG"
exit 0
