#!/bin/bash
# Vigilante de agentes sidecar (lo ejecuta cada minuto el timer systemd st-vigilar-agentes).
#
# Problema: cada agente usa network_mode/pid "service:X". Si el contenedor X se reinicia
# (fallo, reinicio de la VM, docker restart), Docker crea un namespace de red nuevo y el
# agente queda pegado al viejo ("cannot join network namespace of container") -> el host
# aparece como "Agente Zabbix sin respuesta" aunque el servicio funcione.
# Solucion: si el agente no corre o apunta a un contenedor que ya no es el actual de X,
# se recrea con docker compose. Los hosts detenidos a proposito (simular_caida.sh) se respetan.
cd "$(dirname "$0")/.." || exit 1
for s in web db dns ftp; do
  srv_id=$(docker inspect -f '{{.Id}}' "st-$s" 2>/dev/null) || continue
  [ "$(docker inspect -f '{{.State.Running}}' "st-$s")" = "true" ] || continue
  red=$(docker inspect -f '{{.HostConfig.NetworkMode}}' "st-agent-$s" 2>/dev/null)
  corre=$(docker inspect -f '{{.State.Running}}' "st-agent-$s" 2>/dev/null)
  if [ "$red" != "container:$srv_id" ] || [ "$corre" != "true" ]; then
    echo "$(date '+%F %T') agente de '$s' desconectado de su servicio: recreando"
    docker compose up -d --force-recreate --no-deps "agent-$s"
  fi
done
