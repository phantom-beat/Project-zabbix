# Guía de presentación y sustentación — Proyecto 7 (máx. 20 min)

## Antes de la presentación (30 min antes)
```bash
cd proyecto_servicios_telematicos
vagrant up                    # si ya estaban creadas, solo arranca
```
- Abrir pestañas: Zabbix http://192.168.60.10:8080 (Admin/zabbix), MailHog http://192.168.60.10:8025.
- Comprobar en **Monitoring → Hosts** que los 4 hosts tienen ZBX en verde y que **no hay problemas** activos.
- Vaciar MailHog (botón *Delete all messages*) para que solo aparezcan los correos de la demo.
- Tener una terminal con `vagrant ssh zbx-servicios` y `cd /opt/st/servicios`.

## Diapositivas sugeridas (≈ 10 min)

| # | Diapositiva | Contenido | Tiempo |
|---|---|---|---|
| 1 | Portada | Proyecto 7, integrantes | 0:30 |
| 2 | Problema | Por qué monitorear; requisitos del enunciado | 1:00 |
| 3 | Alternativas | Tabla Zabbix vs Prometheus vs Nagios (matriz ponderada) + decisión sidecar/proxy | 1:30 |
| 4 | Arquitectura | Diagrama de 2 VMs, redes, puertos, flujo agente → proxy → servidor → MailHog | 1:30 |
| 5 | Docker | Compose de cada VM, imagen Zabbix personalizada, volúmenes de configuración | 1:00 |
| 6 | Configuración Zabbix | Grupos, 5 templates, triggers y severidades, escenario web (configurado por API) | 1:30 |
| 7 | Alertas | Media type Email → MailHog, acción, script propio | 0:45 |
| 8 | Dashboard | Captura de las 4 páginas | 0:45 |
| 9 | Resultados de pruebas | Tabla con tiempos de detección medidos | 1:00 |
| 10 | Conclusiones y trabajo futuro | | 0:30 |

## Demo en vivo (≈ 8 min)

1. **Infraestructura (1 min)** — `docker compose ps` en ambas VMs. Mostrar `vagrant status`.
2. **Dashboard en tiempo real (2 min)** — Dashboard *ST - Monitoreo de infraestructura*; luego:
   ```bash
   sudo pruebas/estresar_cpu.sh web 150
   ```
   Ir a la página *CPU / Memoria / Disco* y ver subir la curva; a ~1 min aparece *Uso de CPU alto*.
3. **Caída de host (2 min)**
   ```bash
   sudo pruebas/simular_caida.sh ftp
   ```
   Monitoring → Problems: *no responde a ping* (Desastre) y *Agente sin respuesta* (Alta). Monitoring → Hosts:
   ftp en rojo. Anotar el tiempo de detección.
4. **Alertas (1 min)** — MailHog: abrir el correo "Problema: …". Mostrar también
   `sudo docker exec st-zabbix-server cat /var/log/st/alertas.log` en zbx-server.
5. **Recuperación (1 min)**
   ```bash
   sudo pruebas/restaurar_host.sh ftp
   ```
   El problema pasa a RESOLVED y llega el correo "Resuelto: …".
6. **Históricos (1 min)** — Monitoring → Hosts → web → Graphs → *ST - CPU, memoria y disco* con rango de 1 h:
   señalar el pico de la prueba de estrés y explicar su uso (capacidad, SLA, línea base).

## Preguntas probables
- *¿Por qué un proxy?* La VM del servidor no ve la red Docker interna de la VM de servicios; el proxy hace
  los chequeos localmente y envía los datos con una conexión saliente.
- *¿Dónde está el agente de cada host?* Contenedor sidecar que comparte red y procesos con el servicio
  (`network_mode`/`pid: service:X`).
- *¿Qué tiene de personalizada la imagen de Zabbix?* Dockerfile con herramientas, scripts de alerta/externos,
  zona horaria y arranque con `zabbix_server.conf` montado como volumen.
- *¿Diferencia agente pasivo/activo?* Pasivo: el servidor/proxy pregunta (puerto 10050). Activo: el agente
  pide la lista de chequeos y envía (puerto 10051). Aquí: agentes pasivos y proxy activo.
- *¿Cómo se detecta la caída?* `nodata(agent.ping,1m)` y `max(icmpping,#2)=0`.
