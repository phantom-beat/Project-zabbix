#!/bin/bash
# Se ejecuta UNA vez al inicializar el volumen de datos de MySQL.
# Crea el usuario de la aplicacion y el usuario de monitoreo de Zabbix.
# Se usa mysql_native_password para compatibilidad con todos los clientes.
set -e
mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE USER IF NOT EXISTS '${MYSQL_APP_USER}'@'%'
  IDENTIFIED WITH mysql_native_password BY '${MYSQL_APP_PASSWORD}';
GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_APP_USER}'@'%';

-- Usuario de solo lectura para el template "MySQL by Zabbix agent 2"
CREATE USER IF NOT EXISTS '${MYSQL_MONITOR_USER}'@'%'
  IDENTIFIED WITH mysql_native_password BY '${MYSQL_MONITOR_PASSWORD}';
GRANT REPLICATION CLIENT, PROCESS, SHOW DATABASES, SHOW VIEW ON *.* TO '${MYSQL_MONITOR_USER}'@'%';
FLUSH PRIVILEGES;
SQL
echo "[init] usuarios ${MYSQL_APP_USER} y ${MYSQL_MONITOR_USER} creados"
