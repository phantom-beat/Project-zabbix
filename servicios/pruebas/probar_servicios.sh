#!/bin/bash
# Prueba funcional de los 4 servicios monitoreados.
# Se ejecuta DENTRO del contenedor toolbox (en la VM zbx-servicios):
#   cd /opt/st/servicios
#   docker compose run --rm toolbox /pruebas/probar_servicios.sh
ok()   { echo "  [OK]    $*"; }
fail() { echo "  [FALLA] $*"; }

echo "== WEB (nginx) =="
if curl -fs http://web/ | grep -q "Servicios Telematicos"; then ok "HTTP 200 en http://web/"; else fail "web no responde"; fi

echo "== DNS (BIND9) =="
R=$(dig @dns web.servicios.local +short)
if [ -n "$R" ]; then ok "web.servicios.local -> $R"; else fail "dns no resuelve"; fi
dig @dns servicios.local SOA +short | sed 's/^/          /'

echo "== DB (MySQL) =="
if mysql -h db -u"$MYSQL_APP_USER" -p"$MYSQL_APP_PASSWORD" "$MYSQL_DATABASE" \
     -e "SELECT host, servicio, ip, puerto FROM inventario;" 2>/dev/null; then
  ok "consulta a la tabla inventario"
else fail "db no responde"; fi

echo "== FTP (vsftpd) =="
if lftp -u "$FTP_USER,$FTP_PASS" -e "set ftp:ignore-pasv-address yes; set net:max-retries 1; ls; bye" ftp; then
  ok "login y listado FTP"
else fail "ftp no responde"; fi

echo "== Ping a cada host =="
for h in web db dns ftp; do
  if ping -c1 -W2 "$h" >/dev/null 2>&1; then ok "ping $h"; else fail "ping $h"; fi
done
