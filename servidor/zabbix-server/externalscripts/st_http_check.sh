#!/bin/sh
# Check externo: devuelve el codigo HTTP de una URL (000 si no responde).
# Uso en Zabbix (item tipo "External check"): st_http_check.sh["http://192.168.60.20/"]
curl -s -o /dev/null -m 5 -w '%{http_code}' "$1" || echo 000
