#!/bin/sh
# Crea el usuario FTP (variables FTP_USER / FTP_PASS) y arranca vsftpd en primer plano.
set -e
FTP_USER="${FTP_USER:-ftpuser}"
FTP_PASS="${FTP_PASS:-ftpuser}"

if ! id "$FTP_USER" >/dev/null 2>&1; then
  adduser -D -h "/home/$FTP_USER" -s /bin/sh "$FTP_USER"
fi
echo "$FTP_USER:$FTP_PASS" | chpasswd
mkdir -p "/home/$FTP_USER"
[ -f "/home/$FTP_USER/bienvenida.txt" ] || \
  echo "Servidor FTP del Proyecto 7 - Servicios Telematicos" > "/home/$FTP_USER/bienvenida.txt"
chown -R "$FTP_USER:$FTP_USER" "/home/$FTP_USER"

echo "[ftp] usuario $FTP_USER listo, modo pasivo en ${PASV_ADDRESS:-auto}"
if [ -n "$PASV_ADDRESS" ]; then
  exec vsftpd /etc/vsftpd/vsftpd.conf -opasv_address="$PASV_ADDRESS"
else
  exec vsftpd /etc/vsftpd/vsftpd.conf
fi
