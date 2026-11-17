# Proyecto 7 — Monitoreo de infraestructura con Zabbix

**Servicios Telemáticos 2026 · Lista 3 — Monitoreo de infraestructura**

**Integrantes:** José David Aguirre Salinas (2230633) · Gabriel Armando Gil Grueso (2230206)

Plataforma de monitoreo con **Zabbix 6.4** (Server, Proxy, Agent 2, frontend web) sobre **PostgreSQL**, que vigila
una red de 4 servicios (web, base de datos, DNS y FTP) en contenedores Docker. Mide disponibilidad, estado
de servicios, CPU/RAM/disco, genera alertas y las envía por correo a **MailHog**.

Todo corre en contenedores orquestados con **Docker Compose**, repartido en **dos máquinas virtuales nuevas**
creadas con **Vagrant** (distintas de las VMs `servidor`/`cliente` de las prácticas anteriores).

### Entregables (17-nov-2026)

| Entregable | Archivo |
|---|---|
| Informe IEEE (máx. 7 páginas) | [`docs/Informe_IEEE_Proyecto7.pdf`](docs/Informe_IEEE_Proyecto7.pdf) · editable: [`.docx`](docs/Informe_IEEE_Proyecto7.docx) |
| Diapositivas | [`docs/Presentacion_Proyecto7.pptx`](docs/Presentacion_Proyecto7.pptx) · [`PDF`](docs/Presentacion_Proyecto7.pdf) |
| Guion de la sustentación (20 min) | [`GUIA_PRESENTACION.md`](GUIA_PRESENTACION.md) |
| Configuración y aprovisionamiento | `Vagrantfile`, `provision/`, `servidor/`, `servicios/`, `pruebas_carga/` |
| Paso a paso | este README, sección [5](#5-despliegue-paso-a-paso) |

Los documentos se regeneran con `node docs/generar_figuras.js`, `node docs/generar_informe.js` y
`node docs/generar_diapositivas.js` (requieren los paquetes npm `docx` y `pptxgenjs`).

---

## 1. Arquitectura

```
                           Red privada Vagrant 192.168.60.0/24
 ┌──────────────────────────────────────────┐        ┌───────────────────────────────────────────────────┐
 │ VM zbx-server  192.168.60.10             │        │ VM zbx-servicios  192.168.60.20                   │
 │ docker compose "st-servidor"             │        │ docker compose "st-servicios"                     │
 │ red st-zabbix-net                        │        │ red st-servicios 172.30.0.0/24                    │
 │                                          │        │                                                   │
 │  ┌────────────┐     ┌─────────────────┐  │ 10051  │  ┌──────────────────┐                             │
 │  │ PostgreSQL │◄────┤ Zabbix Server   │◄─┼────────┼──┤ Zabbix Proxy     │ 172.30.0.2 (activo)          │
 │  │    15      │     │ (imagen propia) │  │  TCP   │  │ sqlite3          │                             │
 │  └─────▲──────┘     └───┬─────────▲───┘  │        │  └──┬───┬───┬───┬───┘ pasivo :10050 + ICMP + HTTP │
 │        │                │ SMTP    │      │        │     │   │   │   │                                 │
 │  ┌─────┴──────┐   ┌─────▼────┐ ┌──┴────┐ │        │  ┌──▼┐ ┌▼──┐┌▼──┐┌▼──┐  cada host = servicio +    │
 │  │ Zabbix Web │   │ MailHog  │ │Agent 2│ │        │  │web│ │db ││dns││ftp│  Zabbix Agent 2 (sidecar)   │
 │  │  :8080     │   │1025/8025 │ │(local)│ │        │  │.11│ │.12││.13││.14│                             │
 │  └────────────┘   └──────────┘ └───────┘ │        │  └───┘ └───┘└───┘└───┘                             │
 │  ┌──────────────────────────────┐        │        │  nginx  MySQL BIND9 vsftpd                         │
 │  │ zabbix-config (API, 1 vez)   │        │        │                                                   │
 │  └──────────────────────────────┘        │        │  toolbox (perfil "pruebas")                        │
 └──────────────────────────────────────────┘        └───────────────────────────────────────────────────┘
           ▲ navegador (Windows): :8080 Zabbix · :8025 MailHog         ▲ :80 web · :53 dns · :21 ftp
```

**Flujo de datos:** cada agente (pasivo) responde al **proxy** en su red local; el proxy además hace los
pings ICMP y el escenario web, y **envía todo al servidor** por el puerto 10051 (proxy activo). El servidor
guarda en PostgreSQL, evalúa los triggers y, ante un problema, la **acción** envía correo a MailHog y deja
un registro con el script propio `st_alerta_log.sh`.

**¿Por qué un proxy?** Los contenedores de la VM 2 están en una red Docker privada (172.30.0.0/24) que la
VM 1 no ve. El Zabbix Proxy es la solución estándar de Zabbix para monitoreo distribuido: vive junto a los
hosts, alcanza sus IPs internas (agente, ICMP, HTTP) y solo necesita una conexión saliente hacia el servidor.

**¿Por qué agente "sidecar"?** Cada agente usa `network_mode: service:<host>` y `pid: service:<host>`:
comparte la IP y los procesos del contenedor del servicio, así que `proc.num[nginx]`,
`net.tcp.service[http,,80]` o el plugin MySQL ven el servicio en `localhost`. Para Zabbix el agente **es**
ese host, sin modificar las imágenes oficiales de nginx/MySQL.

## 2. Inventario de hosts monitoreados

| Host Zabbix | Nombre visible | Contenedor | IP (red st-servicios) | Servicio | Grupos | Templates |
|---|---|---|---|---|---|---|
| `web` | Servidor Web (nginx) | st-web + st-agent-web | 172.30.0.11 | nginx 1.27 — HTTP 80 | Servicios Telematicos, ST - Servidores Web | ST_Linux_Basico, ST_Servicio_Web + escenario web |
| `db` | Base de Datos (MySQL) | st-db + st-agent-db | 172.30.0.12 | MySQL 8.0 — 3306 | Servicios Telematicos, ST - Bases de Datos | ST_Linux_Basico, ST_Servicio_DB, **MySQL by Zabbix agent 2** (oficial) |
| `dns` | Servidor DNS (BIND9) | st-dns + st-agent-dns | 172.30.0.13 | BIND 9 — 53 (zona `servicios.local`) | Servicios Telematicos, ST - DNS | ST_Linux_Basico, ST_Servicio_DNS |
| `ftp` | Servidor FTP (vsftpd) | st-ftp + st-agent-ftp | 172.30.0.14 | vsftpd — 21 (+ pasivo 21100-21110) | Servicios Telematicos, ST - FTP | ST_Linux_Basico, ST_Servicio_FTP |
| `Zabbix server` | Zabbix server | st-zabbix-agent | (DNS `zabbix-agent`) | Servidor de monitoreo | Zabbix servers | Linux by Zabbix agent, Zabbix server health (por defecto) |

Todos los hosts del grupo *Servicios Telematicos* se monitorean **a través del proxy `proxy-servicios`**.

### Servicios y métricas configurados

| Template | Ítems (intervalo 30 s salvo indicación) | Triggers |
|---|---|---|
| **ST_Linux_Basico** | `agent.ping`, `system.cpu.util[,idle]`, **CPU utilización** (calculado), carga 1 min, memoria total / disponible, **Memoria utilización** (calculado), **Disco / %** (1 min), nº procesos, uptime, `icmpping`, `icmppingsec`, `icmppingloss`, rol del host (UserParameter) | Agente sin respuesta 1 min (**Alta**) · No responde a ping 2 intentos (**Desastre**) · CPU > 80 % durante 1 min (Advertencia) · Memoria > 90 % 2 min (Media) · Disco > 85 % (Advertencia) · Latencia ICMP > 100 ms (Info) |
| **ST_Servicio_Web** | `net.tcp.service[http,,80]`, `proc.num[nginx]`, `web.page.perf` | HTTP caído (Alta) · nginx no corre (Media) |
| Escenario web (host web) | "Pagina principal": GET `http://172.30.0.11/`, código 200 y texto *Servicios Telematicos* | Escenario fallando (Alta) · Página lenta > 2 s (Advertencia) |
| **ST_Servicio_DB** | `net.tcp.service[tcp,,3306]`, `proc.num[mysqld]` + template oficial MySQL (conexiones, consultas, buffer pool, uptime…) | MySQL caído (Alta) · mysqld no corre (Media) · triggers del template oficial |
| **ST_Servicio_DNS** | `net.tcp.service[tcp,,53]`, `net.dns[127.0.0.1,web.servicios.local,A]`, `proc.num[named]` | DNS caído / no resuelve (Alta) · named no corre (Media) |
| **ST_Servicio_FTP** | `net.tcp.service[ftp,,21]` (verifica banner 220), `proc.num[vsftpd]` | FTP caído (Alta) · vsftpd no corre (Media) |

Gráficas en los templates: **"ST - CPU, memoria y disco (%)"** y **"ST - Latencia ICMP"** (una por host).

### Dashboard personalizado — "ST - Monitoreo de infraestructura"
Rota automáticamente cada 30 s entre 4 páginas:
1. **Resumen**: reloj, disponibilidad de hosts, problemas por severidad, lista de problemas activos.
2. **Servicios**: estado (Arriba/Caído) del servicio, ping y CPU de cada host.
3. **CPU / Memoria / Disco**: gráfica histórica de cada host.
4. **Latencia**: latencia ICMP de cada host.

### Alertas
- Media type **Email** → SMTP `mailhog:1025`, remitente `zabbix@st.local`.
- Usuario **Admin** con media `ALERT_EMAIL` (por defecto `admin@st.local`, todas las severidades) +
  media **ST Registro local** (script).
- **Envío real (opcional)**: MailHog atrapa los correos y no los reenvía. Para que además lleguen al buzón real,
  completa `SMTP_REAL_USER` y `SMTP_REAL_PASSWORD` en `servidor/.env.smtp` (copiar de `.env.smtp.example`; no se sube a git) (Gmail: `smtp.gmail.com:587` con una
  [contraseña de aplicación](https://myaccount.google.com/apppasswords); Outlook/365: `smtp.office365.com:587`)
  y ejecuta `vagrant provision zbx-server`. Se crea el media type **Email (SMTP real)** (STARTTLS) y cada alerta
  sale por los dos caminos: MailHog para la demo y el buzón real. Con las variables vacías queda desactivado.
- Acción **"ST - Notificar problemas por correo"**: para los grupos *Servicios Telematicos* y *Zabbix servers*
  envía mensaje al problema y a la recuperación.

## 3. URLs de acceso

| Qué | URL / comando | Credenciales |
|---|---|---|
| **Zabbix (frontend)** | http://192.168.60.10:8080 | `Admin` / `zabbix` |
| **MailHog** (correos de alerta) | http://192.168.60.10:8025 | — |
| Zabbix Server (trapper) | 192.168.60.10:10051 | — |
| Web monitoreada | http://192.168.60.20 | — |
| DNS | `nslookup web.servicios.local 192.168.60.20` | — |
| FTP | `ftp 192.168.60.20` (modo pasivo) | `ftpuser` / `Ftp_2026` |
| MySQL (interno) | `db:3306` desde la red st-servicios | `app` / `App_2026` |

> Las contraseñas son de laboratorio y están en `servidor/.env` y `servicios/.env`.

## 4. Estructura del repositorio

```
proyecto_servicios_telematicos/
├── Vagrantfile                      # 2 VMs: zbx-server y zbx-servicios
├── provision/
│   ├── instalar_docker.sh           # Docker Engine + Compose (único software en la VM)
│   └── desplegar.sh                 # copia el rol a /opt/st/<rol> y hace docker compose up
├── servidor/                        # ---- VM 1 (192.168.60.10)
│   ├── docker-compose.yml           # postgres, zabbix-server, zabbix-web, zabbix-agent, mailhog, zabbix-config
│   ├── .env                         # parámetros de laboratorio
│   ├── .env.smtp.example            # plantilla: correo de alertas y SMTP real (.env.smtp no se sube)
│   ├── zabbix-server/Dockerfile     # IMAGEN ZABBIX PERSONALIZADA
│   ├── zabbix-server/alertscripts/st_alerta_log.sh
│   ├── zabbix-server/externalscripts/st_http_check.sh
│   ├── config/zabbix_server.conf    # montado como volumen
│   ├── config/zabbix_agent2_server.conf
│   └── scripts/
│       ├── zbxapi.py                # cliente JSON-RPC
│       ├── configurar_zabbix.py     # crea grupos, templates, triggers, hosts, alertas, dashboard
│       └── consultar_estado.py      # evidencia: hosts, problemas y alertas enviadas
├── servicios/                       # ---- VM 2 (192.168.60.20)
│   ├── docker-compose.yml           # proxy + web/db/dns/ftp + 4 agentes + toolbox
│   ├── .env
│   ├── web/  (default.conf, html/)  # nginx (config montada)
│   ├── db/init/                     # usuarios app y zbx_monitor + datos
│   ├── dns/  (Dockerfile, named.conf, zones/)
│   ├── ftp/  (Dockerfile, vsftpd.conf, entrypoint.sh)
│   ├── zabbix-agent/*.conf          # UserParameters de cada agente (montados)
│   ├── toolbox/Dockerfile           # curl, dig, lftp, mysql
│   └── pruebas/                     # scripts de las pruebas mínimas
├── pruebas_carga/                   # Artillery: web.yml, zabbix.yml, reportes/ (JSON de cada prueba)
├── docs/                            # informe IEEE y diapositivas (+ scripts que los generan, figuras/)
├── INFORME.md                       # enlace al informe final (docs/)
└── GUIA_PRESENTACION.md             # guion de diapositivas y demo (20 min)
```

## 5. Despliegue paso a paso

### Requisitos (en el PC anfitrión)
- VirtualBox 7.x y Vagrant 2.4+ (box `bento/ubuntu-22.04`, se descarga sola si no está).
- ~6 GB de RAM libres (3 GB + 2.5 GB para las VMs) y conexión a Internet (imágenes Docker).

### Paso 1 — Levantar las dos máquinas
```bash
cd proyecto_servicios_telematicos
vagrant up
```
Vagrant crea **zbx-server** y luego **zbx-servicios**; en cada una instala Docker y ejecuta
`docker compose up -d --build`. En la VM del servidor, el contenedor `zabbix-config` espera a que la API
esté lista y configura todo automáticamente (la salida se ve en la consola de `vagrant up`; termina con
`[OK] Zabbix configurado`). Tarda ~10-15 min la primera vez (descarga de imágenes).

> Se puede levantar una sola VM: `vagrant up zbx-server` / `vagrant up zbx-servicios`. El orden no importa:
> el proxy reintenta hasta que el servidor responda.

> **Poca RAM libre en el anfitrión** (por defecto se usan 3072 + 2560 MB): se puede reducir sin editar el
> Vagrantfile. Probado y funcionando con 2048 + 1792 MB:
> ```powershell
> $env:ST_MEM_SERVER=2048; $env:ST_MEM_SERVICIOS=1792; vagrant up
> ```

### Paso 2 — Verificar los contenedores
```bash
vagrant ssh zbx-server -c "cd /opt/st/servidor && docker compose ps"
vagrant ssh zbx-servicios -c "cd /opt/st/servicios && docker compose ps"
```
Todos deben estar `Up` (los que tienen healthcheck, `healthy`). `zabbix-config` aparece como `Exited (0)`: es normal.

### Paso 3 — Entrar a Zabbix
1. Abrir http://192.168.60.10:8080 → `Admin` / `zabbix`.
2. **Administration → Proxies**: `proxy-servicios` con *Last seen* de pocos segundos.
3. **Monitoring → Hosts**: web, db, dns, ftp con el icono **ZBX en verde** (1-2 min tras arrancar).
4. **Dashboards → ST - Monitoreo de infraestructura**.

### Paso 4 — Probar los servicios
```bash
vagrant ssh zbx-servicios
cd /opt/st/servicios
sudo docker compose run --rm toolbox /pruebas/probar_servicios.sh
```

### Reconfigurar Zabbix (si se borró algo a mano)
```bash
vagrant ssh zbx-server -c "cd /opt/st/servidor && sudo docker compose run --rm zabbix-config"
```
El script es idempotente: solo crea lo que falta (el dashboard se recrea).

### Aplicar cambios de configuración
Editar los archivos en Windows y luego `vagrant provision zbx-server` (o `zbx-servicios`): vuelve a copiar la
carpeta a `/opt/st/<rol>` y recrea los contenedores que cambiaron.

### Apagar / destruir
```bash
vagrant halt
vagrant destroy -f
```

## 6. Pruebas mínimas esperadas

### 6.1 Dashboard en tiempo real
Abrir el dashboard *ST - Monitoreo de infraestructura*. Las páginas *Servicios* y *CPU / Memoria / Disco* se
actualizan cada 30 s. Para ver la actualización dinámica, generar carga:
```bash
# en zbx-servicios
sudo /opt/st/servicios/pruebas/estresar_cpu.sh web 180
```
La gráfica de CPU del host web sube a ~100 % y en ~1 min aparece el problema *Uso de CPU alto en Servidor Web*.
Como los 4 contenedores comparten el kernel y la CPU de la VM, el agente lee el `/proc/stat` de la VM y
**los 4 hosts** muestran el pico y disparan el trigger a la vez (en la prueba: los 4 en menos de 15 s). Es una
limitación propia de monitorear contenedores con agente, y conviene explicarla en la sustentación.

### 6.2 Simulación de caída de host
```bash
sudo /opt/st/servicios/pruebas/simular_caida.sh ftp
```
En 30-90 s: *Servidor FTP no responde a ping (ICMP)* (Desastre) y *Agente Zabbix sin respuesta* (Alta); en
**Monitoring → Hosts** el host `ftp` pasa a ZBX rojo / no disponible. Recuperar con:
```bash
sudo /opt/st/servicios/pruebas/restaurar_host.sh ftp
```
También se puede tumbar **solo el servicio** dejando el host vivo, p. ej. `sudo docker exec st-web nginx -s stop`
→ dispara *Servicio HTTP CAIDO* y *Escenario web fallando* (luego `restaurar_host.sh web`).

### 6.3 Envío de alertas a MailHog
Cualquiera de las pruebas anteriores genera un correo **"Problema: …"** y, al recuperarse, **"Resuelto: …"** en
http://192.168.60.10:8025. Evidencia por consola:
```bash
vagrant ssh zbx-server -c "cd /opt/st/servidor && sudo docker compose run --rm zabbix-config python /scripts/consultar_estado.py"
vagrant ssh zbx-server -c "sudo docker exec st-zabbix-server cat /var/log/st/alertas.log"
```

### 6.4 Métricas históricas
**Monitoring → Hosts → (host) → Graphs** → *ST - CPU, memoria y disco (%)* y elegir rango (última hora,
día…). En **Monitoring → Latest data** cada ítem tiene su gráfico/historial. Uso para análisis: identificar
picos (correlacionar con la prueba de estrés), tendencias de crecimiento del disco (planificación de
capacidad), línea base de latencia y tiempos de indisponibilidad (SLA). Historial 7 días, tendencias 90 días.

### 6.5 Pruebas de carga con Artillery (extra)
Carpeta `pruebas_carga/`. [Artillery](https://www.artillery.io) genera tráfico HTTP desde el PC anfitrión y
**Zabbix registra el efecto** (CPU, tiempo del escenario web, `web.page.perf`). Los resultados se graban en
**Artillery Cloud** (app.artillery.io) con `--record`. Se ejecutan desde el PC porque los runners en la nube de
Artillery no llegan a las IPs privadas 192.168.60.x.

| Archivo | Objetivo | Entornos (`-e`) |
|---|---|---|
| `web.yml` | nginx `http://192.168.60.20` (`/` y `/salud`) | `humo` 2 rps·30 s · `carga` 5→50 rps + 120 s a 50 rps · `pico` 200 rps·30 s |
| `zabbix.yml` | Frontend + API JSON-RPC de Zabbix (login único, `host.get`, `problem.get`, `item.get`) | `humo` · `carga` (uso realista) 1→3 VU/s + 120 s a 3 VU/s · `capacidad` (estrés) rampa lenta 1→12 VU/s en 240 s, **sin umbrales** |

Umbrales (plugin `ensure`): p95 < 500 ms (web) / 1500 ms (Zabbix) y errores < 1 %; si no se cumplen el
comando termina con error. El perfil `capacidad` no tiene umbrales: su objetivo es encontrar el punto de quiebre.

```powershell
cd pruebas_carga
npm install                       # instala Artillery 2 localmente
Copy-Item .env.example .env       # y pegar ARTILLERY_CLOUD_API_KEY (Settings -> API Keys)
npm run humo:web                  # prueba rápida, sin grabar
npm run carga:web                 # rampa + carga sostenida, grabada en Artillery Cloud
npm run pico:web                  # pico brusco (spike)
npm run carga:zabbix              # uso realista del frontend/API de Zabbix
npm run capacidad:zabbix          # estrés: busca el límite de Zabbix
```

**Resultados (16-nov-2026).** Web: zbx-servicios 1536 MB / 2 vCPU.

| Prueba | Usuarios (VU) | Peticiones | Errores | p95 | p99 | Pico req/s | Umbrales |
|---|---|---|---|---|---|---|---|
| `carga:web` | 7.800 | 15.600 (100 % 200) | 0 | 2 ms | 7 ms | 100 | ✔ |
| `pico:web` (200 VU/s) | 6.450 | 12.900 (100 % 200) | 0 | 10 ms | 111 ms | 411 | ✔ |

nginx aguanta 400 req/s sin errores (solo sube la cola: p99 de 7 a 111 ms durante el pico).

**Zabbix: antes y después de la optimización**

1. **Prueba inicial** (zbx-server con 2 vCPU, PHP-FPM por defecto, carga 1→10 VU/s sostenida): **falló**
   — 1.259 timeouts (81 % de VU fallidos), p95 14 s. El p95 pasó de 150 ms a 1 s con **~3,6 VU/s** y la CPU de
   zbx-server llegó al **100 %** (ítem `system.cpu.util` del host *Zabbix server*): cada petición ejecuta
   PHP-FPM + PostgreSQL. Es el **cuello de botella** del sistema.
2. **Cambios aplicados:**
   - zbx-server pasa a **4 vCPU** (`ST_CPU_SERVER` en el Vagrantfile; no consume RAM adicional).
   - PHP-FPM dimensionado (`PHP_FPM_PM_*` en `servidor/docker-compose.yml`): `dynamic`, 8 procesos al arrancar,
     máx. 16 (~4 por vCPU, ~560 MB como tope para no agotar la RAM de la VM).
   - Perfil de prueba separado en **uso realista** (`carga`) y **estrés** (`capacidad`).
3. **Resultados después:**

| Prueba | VU | Peticiones | Errores | p95 | Pico req/s | Umbrales |
|---|---|---|---|---|---|---|
| `carga:zabbix` inicial (2 vCPU, 1→10 VU/s) | 1.560 | 3.729 | 1.259 timeouts | 14,0 s | 30 | ✘ |
| `carga:zabbix` realista (4 vCPU, 1→3 VU/s) | 510 | 2.550 (100 % 200) | 0 | 136 ms | 15 | ✔ |
| `capacidad:zabbix` (4 vCPU, 1→12 VU/s) | 1.560 | 7.417 (7.237 × 200) | 180 timeouts (12 %) | 14,0 s | 42 | — |

| | 2 vCPU (antes) | 4 vCPU + PHP-FPM (después) |
|---|---|---|
| Carga estable (p95 < 250 ms) | hasta ~3 VU/s | hasta **~6 VU/s** |
| Rendimiento máximo sostenido | ~15 req/s | **~32 req/s** (≈ ×2) |
| VU fallidos con 1→10/12 VU/s | 81 % | 12 % |

La capacidad se **duplica** al duplicar las vCPU: confirma que el límite es CPU. Pasado ~6-7 VU/s la latencia
vuelve a crecer (cola en PHP-FPM) y la CPU vuelve al 100 %. Para más usuarios: más vCPU, separar el frontend
en otra VM/réplicas detrás de un balanceador, o cachear consultas.
Zabbix **no** disparó la alerta de CPU del servidor porque el trigger de la plantilla oficial exige 5 min
sobre el 90 % y la saturación duró ~4 min.

Durante `carga:web` o `pico:web`, abrir en Zabbix la página *CPU / Memoria / Disco* del dashboard y **Latest
data → web → escenario "Pagina principal"** para mostrar en la sustentación cómo el monitoreo detecta la carga.

## 7. Solución de problemas

| Síntoma | Causa / solución |
|---|---|
| Hosts con ZBX gris/rojo y proxy "never seen" | Revisar `docker compose logs zabbix-proxy` en zbx-servicios; desde esa VM `nc -zv 192.168.60.10 10051`. |
| `zabbix-config` sale con error | `docker compose logs zabbix-config`; volver a ejecutar `docker compose run --rm zabbix-config`. |
| No llegan correos | Administration → Media types → Email → *Test*; Reports → Action log. |
| Agente caído tras reiniciar un servicio | Los sidecars dependen de la red del servicio. El timer `st-vigilar-agentes` (cada minuto, `pruebas/vigilar_agentes.sh`) los reengancha solo; a mano: `pruebas/restaurar_host.sh <host>`. Ver `journalctl -u st-vigilar-agentes`. |
| El template MySQL marca error de conexión | Verificar usuario `zbx_monitor` (`servicios/db/init/01_usuarios.sh`); si el volumen ya existía, `docker compose down -v` y subir de nuevo. |
