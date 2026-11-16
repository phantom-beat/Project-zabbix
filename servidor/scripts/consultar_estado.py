#!/usr/bin/env python3
"""
Muestra por consola el estado del monitoreo (evidencia para las pruebas):
  - Disponibilidad de cada host (agente)
  - Problemas activos
  - Ultimas alertas enviadas (correo / script)

Uso (en la VM zbx-server):
  cd /opt/st/servidor
  docker compose run --rm zabbix-config python /scripts/consultar_estado.py
"""
import time

from zbxapi import ZabbixAPI

SEVERIDAD = ["No clasificada", "Informacion", "Advertencia", "Media", "Alta", "Desastre"]
DISPONIBLE = {"0": "desconocido", "1": "DISPONIBLE", "2": "NO DISPONIBLE"}


def fecha(ts):
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(int(ts)))


def main():
    api = ZabbixAPI()
    api.login(wait_seconds=60)

    print("\n=== HOSTS ===")
    hosts = api.call("host.get", {"output": ["host", "name", "status"],
                                  "selectInterfaces": ["ip", "dns", "available", "error"],
                                  "sortfield": "host"})
    for h in hosts:
        itf = h["interfaces"][0] if h["interfaces"] else {}
        print(f"{h['host']:<15} {itf.get('ip') or itf.get('dns', ''):<15} "
              f"agente: {DISPONIBLE.get(str(itf.get('available')), '?'):<14} {itf.get('error', '')}")

    print("\n=== PROBLEMAS ACTIVOS ===")
    trig = api.call("trigger.get", {"output": ["description", "priority", "lastchange"],
                                    "filter": {"value": 1}, "monitored": True,
                                    "expandDescription": True, "selectHosts": ["host"],
                                    "sortfield": "lastchange", "sortorder": "DESC"})
    if not trig:
        print("(ninguno)")
    for t in trig:
        print(f"{fecha(t['lastchange'])}  [{SEVERIDAD[int(t['priority'])]:<12}] "
              f"{t['hosts'][0]['host']:<8} {t['description']}")

    print("\n=== ULTIMAS ALERTAS ENVIADAS ===")
    alertas = api.call("alert.get", {"output": ["clock", "sendto", "subject", "status"],
                                     "sortfield": "clock", "sortorder": "DESC", "limit": 10})
    estado = {"0": "pendiente", "1": "enviada", "2": "fallida", "3": "nueva"}
    if not alertas:
        print("(ninguna)")
    for a in alertas:
        print(f"{fecha(a['clock'])}  {estado.get(a['status'], a['status']):<9} "
              f"{a['sendto']:<16} {a['subject']}")


if __name__ == "__main__":
    main()
