# Monitoreo de infraestructura de servicios telemáticos con Zabbix sobre contenedores Docker

**Proyecto 7 — Servicios Telemáticos 2026**
*Integrantes: ______________________ (4 a 5 estudiantes)*

> Borrador en estructura IEEE (máx. 7 páginas). Para la entrega pasar a la plantilla IEEE de dos columnas
> (Word/LaTeX) e insertar las capturas marcadas como **[Figura X]**.

---

**Resumen** — Se diseñó e implementó una plataforma de monitoreo de infraestructura basada en Zabbix 6.4 que
supervisa cuatro servicios de red (web, base de datos, DNS y FTP) desplegados en contenedores Docker. La
solución se distribuye en dos máquinas virtuales aprovisionadas con Vagrant: una aloja el servidor Zabbix, su
base de datos PostgreSQL, el frontend web y un servidor de correo de pruebas (MailHog); la otra aloja los
servicios monitoreados, sus agentes Zabbix y un Zabbix Proxy. Se definieron templates propios, triggers,
escenarios web, un dashboard personalizado y notificaciones por correo. Las pruebas demuestran la detección
de caídas de host y de servicio en menos de 90 segundos, alertas por umbral de CPU y la recepción de
notificaciones de problema y recuperación.

**Palabras clave** — Zabbix, monitoreo, Docker Compose, Vagrant, proxy, alertas, MailHog.

## I. Introducción

La disponibilidad de los servicios telemáticos (web, DNS, correo, bases de datos, transferencia de archivos)
es un requisito de cualquier organización. Detectar a tiempo una caída o una degradación —antes de que la
reporte un usuario— exige un sistema de monitoreo que recoja métricas de forma periódica, conserve su
historia, evalúe condiciones de falla y notifique a los responsables. Este proyecto implementa dicho sistema
con Zabbix, una herramienta de código abierto ampliamente usada en la industria, empaquetando todos los
componentes en contenedores Docker orquestados con Docker Compose.

## II. Contexto (Problema)

Se requiere monitorear una red de al menos cuatro hosts (web, DB, DNS, FTP) para conocer: (a) disponibilidad
de cada host, (b) estado de cada servicio, (c) uso de CPU, memoria y disco, y (d) generar alertas por correo
cuando algo falle o supere un umbral. Restricciones del enunciado: todo en contenedores (nada instalado en el
SO del host), Zabbix 6.x con PostgreSQL o MySQL, imagen Zabbix personalizada con Dockerfile, archivos de
configuración montados como volúmenes, MailHog para notificaciones y documentación de despliegue.
Adicionalmente el grupo decidió desplegar el proyecto en **máquinas virtuales separadas** (servidor de
monitoreo y servicios monitoreados) para acercarse a un escenario real en el que el monitor no comparte
máquina con lo que vigila.

## III. Alternativas de solución

**A. Herramienta de monitoreo.** Se compararon Zabbix, Prometheus + Grafana y Nagios Core.

| Criterio (peso) | Zabbix 6.4 | Prometheus + Grafana | Nagios Core |
|---|---|---|---|
| Requisito del enunciado (30 %) | 5 | 1 | 1 |
| Agente con métricas de SO y servicios listo (20 %) | 5 | 4 (exporters) | 3 (plugins) |
| Alertas por correo integradas (15 %) | 5 | 4 (Alertmanager) | 4 |
| Dashboards e históricos integrados (15 %) | 4 | 5 | 2 |
| Configuración automatizable por API (10 %) | 5 | 4 (archivos) | 2 |
| Monitoreo distribuido / proxy (10 %) | 5 | 3 | 2 |
| **Total ponderado** | **4.85** | 3.05 | 2.15 |

**B. Ubicación del agente en cada host.** (1) Instalar el agente dentro de cada imagen de servicio; (2) agente
como contenedor *sidecar* que comparte red y espacio de procesos con el servicio; (3) un único agente por
VM. La opción (1) obliga a reconstruir las imágenes oficiales de nginx/MySQL y a ejecutar dos procesos por
contenedor; la (3) no distingue los hosts. Se eligió **(2)**: con `network_mode: service:X` y `pid: service:X`
el agente ve los puertos y procesos del servicio como si estuviera instalado en él, y cada host tiene su
propia IP e identidad en Zabbix.

**C. Conectividad entre VMs.** (1) Publicar el puerto 10050 de cada agente en la VM 2; (2) red overlay con
Docker Swarm; (3) **Zabbix Proxy** en la VM 2. La (1) no permite pings ICMP ni escenarios web hacia las IPs
internas; la (2) añade complejidad fuera del alcance. El proxy (3) es el mecanismo nativo de Zabbix para
monitoreo distribuido: vive en la red de los servicios, ejecuta los chequeos y envía los datos al servidor
con una sola conexión saliente (modo activo, TCP 10051).

**D. Base de datos de Zabbix.** PostgreSQL 15 frente a MySQL 8: ambos soportados; se eligió PostgreSQL para
el servidor y así reservar MySQL como *servicio monitoreado*, evitando confundir ambos roles.

## IV. Diseño de la solución

**[Figura 1: diagrama de arquitectura — ver README §1]**

- **VM zbx-server (192.168.60.10)** — Compose `st-servidor`: `postgres-server` (PostgreSQL 15),
  `zabbix-server` (imagen propia basada en `zabbix/zabbix-server-pgsql:alpine-6.4`), `zabbix-web`
  (nginx + PHP, puerto 8080), `zabbix-agent` (monitorea al propio servidor), `mailhog` (SMTP 1025, web 8025) y
  `zabbix-config` (contenedor efímero que configura Zabbix por la API JSON-RPC).
- **VM zbx-servicios (192.168.60.20)** — Compose `st-servicios`, red `st-servicios` 172.30.0.0/24 con IPs
  fijas: `zabbix-proxy` (.2), `web` nginx (.11), `db` MySQL 8 (.12), `dns` BIND9 (.13), `ftp` vsftpd (.14), un
  Zabbix Agent 2 sidecar por servicio y un contenedor `toolbox` para pruebas.

**Modelo de monitoreo.** Template base *ST_Linux_Basico* (CPU, memoria, disco, procesos, ping del agente e
ICMP) enlazado a los cuatro hosts, y un template por tipo de servicio (puerto TCP, proceso y chequeo
funcional: escenario HTTP con validación de contenido, resolución DNS, banner FTP, template oficial
*MySQL by Zabbix agent 2*). Grupos: *Servicios Telematicos* (todos) y uno por rol. Severidades: Desastre para
host inalcanzable, Alta para servicio caído, Media para proceso ausente/memoria, Advertencia para CPU/disco.

**Alertas.** El media type Email apunta a `mailhog:1025`. La acción *ST - Notificar problemas por correo*
notifica al grupo *Zabbix administrators* en el problema y en la recuperación. Un segundo media type de
tipo script (`st_alerta_log.sh`, incluido en la imagen personalizada) deja traza en un volumen.

## V. Implementación

1. **Aprovisionamiento.** El `Vagrantfile` define dos VMs `bento/ubuntu-22.04` en la red privada
   192.168.60.0/24 (distinta a la de prácticas previas). `instalar_docker.sh` instala únicamente Docker
   Engine y el plugin Compose; `desplegar.sh` copia la carpeta del rol a `/opt/st/<rol>` (corrigiendo permisos
   y finales de línea CRLF de Windows) y ejecuta `docker compose up -d --build`.
2. **Imagen Zabbix personalizada** (`servidor/zabbix-server/Dockerfile`): añade curl, jq y tzdata, los scripts
   de alerta y externos propios, la zona horaria y cambia el `CMD` para arrancar con
   `/etc/zabbix/custom/zabbix_server.conf`, montado como volumen; conserva el entrypoint oficial que crea el
   esquema en PostgreSQL en el primer arranque.
3. **Configuración como código.** `configurar_zabbix.py` (solo librería estándar de Python) usa la API para
   crear de forma idempotente grupos, proxy, 5 templates con ~30 ítems, ~20 triggers y 2 gráficas, los 4
   hosts (interfaz agente, macros, inventario, etiquetas), el escenario web, los medios de alerta, la acción
   y un dashboard de 4 páginas. Así el despliegue es reproducible sin pasos manuales en el frontend.
4. **Servicios.** nginx con `default.conf` y sitio montados; MySQL con scripts de `docker-entrypoint-initdb.d`
   que crean el usuario de aplicación y `zbx_monitor`; BIND9 (imagen Alpine propia) autoritativo para
   `servicios.local`; vsftpd (imagen Alpine propia) con usuario local, chroot y modo pasivo.
5. **Ajustes para detección rápida:** ítems cada 30 s, `nodata(agent.ping,1m)`, `max(icmpping,#2)=0`,
   y `UnreachablePeriod=45`, `UnavailableDelay=30` en servidor y proxy.

## VI. Pruebas

| # | Prueba | Procedimiento | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|
| P1 | Dashboard en tiempo real | Abrir dashboard; ejecutar `estresar_cpu.sh web 180` | Gráfica de CPU sube; problema "Uso de CPU alto" | ___ **[Figura 2]** |
| P2 | Caída de host | `simular_caida.sh ftp` | Host ftp no disponible, problemas ICMP (Desastre) y agente (Alta) en < 90 s | ___ s **[Figura 3]** |
| P3 | Caída de servicio | `docker exec st-web nginx -s stop` | "Servicio HTTP CAIDO", "Escenario web fallando" | ___ **[Figura 4]** |
| P4 | Alertas en MailHog | Tras P1-P3 abrir :8025 | Correos "Problema:" y "Resuelto:" | ___ correos **[Figura 5]** |
| P5 | Métricas históricas | Graphs del host db, rango 1 h / 1 d | Serie temporal con los picos de P1 | **[Figura 6]** |
| P6 | Servicios funcionales | `probar_servicios.sh` en toolbox | HTTP 200, DNS resuelve, consulta SQL, listado FTP | ___ |

## VII. Discusión de las pruebas

*(Completar con los tiempos medidos.)* Puntos a discutir:
- **Tiempo de detección:** depende del intervalo de los ítems (30 s), de la función del trigger (#2 pings ⇒
  ≥ 60 s) y del envío proxy→servidor (casi inmediato en modo activo). Reducir los intervalos acelera la
  detección pero aumenta la carga y el volumen de la base de datos (*trade-off*).
- **Correlación de síntomas:** una caída de host dispara varios triggers (ICMP, agente, servicio). En
  producción se configurarían **dependencias de triggers** para notificar solo la causa raíz.
- **Métricas de contenedor:** sin *lxcfs*, `/proc` dentro del contenedor muestra CPU y memoria de la VM
  completa; por eso la prueba de estrés satura todos los núcleos. Para métricas por contenedor se puede
  usar el plugin Docker del Agent 2 o cAdvisor.
- **Históricos:** 7 días de historia y 90 de tendencias permiten análisis de capacidad y SLA.

## VIII. Conclusiones

- Zabbix permitió cubrir en una sola herramienta recolección, almacenamiento, evaluación, visualización y
  notificación, cumpliendo todos los requisitos del enunciado.
- El patrón **agente sidecar** y el **Zabbix Proxy** resolvieron el monitoreo de contenedores ubicados en otra
  máquina sin modificar imágenes oficiales y con una única conexión entre VMs.
- Automatizar la configuración por API hace el despliegue reproducible: `vagrant up` deja la plataforma
  lista, incluidos templates, alertas y dashboard.
- Trabajo futuro: dependencias entre triggers, Zabbix Agent 2 plugin Docker, TLS/PSK entre proxy y servidor,
  y notificación por canales adicionales (Telegram/Slack).

## Referencias

[1] Zabbix SIA, "Zabbix 6.4 Manual," 2023. [Online]. Available: https://www.zabbix.com/documentation/6.4/
[2] Zabbix SIA, "Zabbix Docker images," GitHub. [Online]. Available: https://github.com/zabbix/zabbix-docker
[3] Docker Inc., "Docker Compose file reference." [Online]. Available: https://docs.docker.com/compose/
[4] HashiCorp, "Vagrant Documentation." [Online]. Available: https://developer.hashicorp.com/vagrant/docs
[5] MailHog, "MailHog — Web and API based SMTP testing." [Online]. Available: https://github.com/mailhog/MailHog
[6] ISC, "BIND 9 Administrator Reference Manual." [Online]. Available: https://bind9.readthedocs.io/
