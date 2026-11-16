# Imagen personalizada de Zabbix Server 6.4 con PostgreSQL
# Imagen base: zabbix/zabbix-server-pgsql (oficial, Alpine Linux)
#
# Personalizaciones:
#  - Herramientas extra (curl, jq, tzdata) para scripts
#  - Script de alertas propio (st_alerta_log.sh) -> media type "ST Registro local"
#  - Script externo propio (st_http_check.sh)
#  - Zona horaria America/Bogota
#  - Arranca con el archivo de configuracion montado como volumen
#    (/etc/zabbix/custom/zabbix_server.conf) en lugar del generado por variables
ARG ZABBIX_TAG=alpine-6.4-latest
FROM zabbix/zabbix-server-pgsql:${ZABBIX_TAG}

LABEL maintainer="Grupo Proyecto 7 - Servicios Telematicos" \
      description="Zabbix Server 6.4 personalizado para el Proyecto 7"

USER root

RUN apk add --no-cache curl jq tzdata \
 && mkdir -p /etc/zabbix/custom /var/log/st \
 && chown -R 1997:1995 /var/log/st

COPY alertscripts/    /usr/lib/zabbix/alertscripts/
COPY externalscripts/ /usr/lib/zabbix/externalscripts/
RUN sed -i 's/\r$//' /usr/lib/zabbix/alertscripts/* /usr/lib/zabbix/externalscripts/* \
 && chmod 755 /usr/lib/zabbix/alertscripts/* /usr/lib/zabbix/externalscripts/*

ENV TZ=America/Bogota

USER 1997

# El ENTRYPOINT oficial se conserva (crea el esquema de BD la primera vez);
# solo cambiamos el archivo de configuracion con el que arranca el servidor.
CMD ["/usr/sbin/zabbix_server", "--foreground", "-c", "/etc/zabbix/custom/zabbix_server.conf"]
