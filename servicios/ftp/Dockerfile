# Servidor FTP vsftpd
# Imagen base: alpine:3.20
FROM alpine:3.20

RUN apk add --no-cache vsftpd tzdata \
 && mkdir -p /var/run/vsftpd/empty

COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod 755 /entrypoint.sh

EXPOSE 21 21100-21110

# vsftpd.conf se monta como volumen (ver docker-compose.yml)
ENTRYPOINT ["/entrypoint.sh"]
