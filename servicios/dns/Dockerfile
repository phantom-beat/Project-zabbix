# Servidor DNS autoritativo BIND9 para la zona servicios.local
# Imagen base: alpine:3.20
FROM alpine:3.20

RUN apk add --no-cache bind bind-tools tzdata \
 && mkdir -p /var/run/named /var/bind /etc/bind/zones \
 && chown -R named:named /var/run/named /var/bind

EXPOSE 53/udp 53/tcp

# named.conf y las zonas se montan como volumenes (ver docker-compose.yml)
CMD ["named", "-g", "-u", "named", "-c", "/etc/bind/named.conf"]
