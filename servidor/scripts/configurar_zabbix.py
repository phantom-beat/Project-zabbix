#!/usr/bin/env python3
"""
Configuracion automatica de Zabbix 6.4 para el Proyecto 7 (Servicios Telematicos).

Crea (de forma idempotente, se puede ejecutar varias veces):
  * Grupos de hosts y grupo de templates
  * Proxy "proxy-servicios" (activo) que vive en la VM zbx-servicios
  * Templates propios:
      ST_Linux_Basico   -> CPU, memoria, disco, procesos, agente y ping ICMP
      ST_Servicio_Web   -> HTTP (puerto 80), proceso nginx, tiempo de respuesta
      ST_Servicio_DB    -> MySQL (puerto 3306), proceso mysqld
      ST_Servicio_DNS   -> DNS (puerto 53), proceso named, resolucion de nombres
      ST_Servicio_FTP   -> FTP (puerto 21), proceso vsftpd
    + template oficial "MySQL by Zabbix agent 2" para la base de datos
  * Triggers (alertas) y graficas en los templates
  * Hosts web, db, dns y ftp monitoreados a traves del proxy
  * Escenario web (HTTP) sobre el host web
  * Media type Email -> MailHog, media del usuario Admin y accion de notificacion
  * Media type de script propio "ST Registro local"
  * Dashboard personalizado "ST - Monitoreo de infraestructura"
"""
import os
import sys

from zbxapi import ZabbixAPI, ZabbixError

api = ZabbixAPI()

PROXY_NAME = os.environ.get("ZBX_PROXY_NAME", "proxy-servicios")
ALERT_EMAIL = os.environ.get("ALERT_EMAIL", "admin@st.local")
MYSQL_USER = os.environ.get("MYSQL_MONITOR_USER", "zbx_monitor")
MYSQL_PASS = os.environ.get("MYSQL_MONITOR_PASSWORD", "Monitor_2026")

# Inventario de hosts monitoreados (IPs fijas de la red Docker st-servicios en la VM 2)
HOSTS = [
    {"host": "web", "name": "Servidor Web (nginx)", "ip": "172.30.0.11",
     "grupo": "ST - Servidores Web", "templates": ["ST_Linux_Basico", "ST_Servicio_Web"],
     "rol": "web", "software": "nginx 1.27"},
    {"host": "db", "name": "Base de Datos (MySQL)", "ip": "172.30.0.12",
     "grupo": "ST - Bases de Datos",
     "templates": ["ST_Linux_Basico", "ST_Servicio_DB", "MySQL by Zabbix agent 2"],
     "rol": "db", "software": "MySQL 8.0",
     "macros": [
         {"macro": "{$MYSQL.DSN}", "value": "tcp://localhost:3306"},
         {"macro": "{$MYSQL.USER}", "value": MYSQL_USER},
         {"macro": "{$MYSQL.PASSWORD}", "value": MYSQL_PASS, "type": "1"},
     ]},
    {"host": "dns", "name": "Servidor DNS (BIND9)", "ip": "172.30.0.13",
     "grupo": "ST - DNS", "templates": ["ST_Linux_Basico", "ST_Servicio_DNS"],
     "rol": "dns", "software": "BIND 9"},
    {"host": "ftp", "name": "Servidor FTP (vsftpd)", "ip": "172.30.0.14",
     "grupo": "ST - FTP", "templates": ["ST_Linux_Basico", "ST_Servicio_FTP"],
     "rol": "ftp", "software": "vsftpd 3"},
]
GRUPO_PRINCIPAL = "Servicios Telematicos"
GRUPO_TEMPLATES = "Templates/Servicios Telematicos"

# Constantes de la API
AGENT, SIMPLE, CALCULATED = 0, 3, 15
FLOAT, CHAR, UINT = 0, 1, 3
INFO, WARNING, AVERAGE, HIGH, DISASTER = 1, 2, 3, 4, 5


def paso(msg):
    print(f"\n==> {msg}")


# ----------------------------------------------------------------------------
# Helpers idempotentes
# ----------------------------------------------------------------------------
def ensure_hostgroup(name):
    r = api.call("hostgroup.get", {"filter": {"name": [name]}, "output": ["groupid"]})
    if r:
        return r[0]["groupid"]
    gid = api.call("hostgroup.create", {"name": name})["groupids"][0]
    print(f"   + grupo de hosts '{name}'")
    return gid


def ensure_templategroup(name):
    r = api.call("templategroup.get", {"filter": {"name": [name]}, "output": ["groupid"]})
    if r:
        return r[0]["groupid"]
    gid = api.call("templategroup.create", {"name": name})["groupids"][0]
    print(f"   + grupo de templates '{name}'")
    return gid


def ensure_proxy(name):
    r = api.call("proxy.get", {"filter": {"host": [name]}, "output": ["proxyid"]})
    if r:
        return r[0]["proxyid"]
    pid = api.call("proxy.create", {
        "host": name, "status": "5",  # 5 = proxy activo
        "description": "Proxy en la VM zbx-servicios (192.168.60.20)"})["proxyids"][0]
    print(f"   + proxy activo '{name}'")
    return pid


def ensure_template(host, name, tgid, description):
    r = api.call("template.get", {"filter": {"host": [host]}, "output": ["templateid"]})
    if r:
        return r[0]["templateid"]
    tid = api.call("template.create", {
        "host": host, "name": name, "description": description,
        "groups": [{"groupid": tgid}]})["templateids"][0]
    print(f"   + template '{name}'")
    return tid


def template_id_by_name(name):
    r = api.call("template.get", {"filter": {"host": [name]}, "output": ["templateid"]})
    if not r:
        r = api.call("template.get", {"filter": {"name": [name]}, "output": ["templateid"]})
    return r[0]["templateid"] if r else None


def ensure_valuemap(hostid, name, mappings):
    r = api.call("valuemap.get", {"hostids": [hostid], "filter": {"name": name},
                                  "output": ["valuemapid"]})
    if r:
        return r[0]["valuemapid"]
    return api.call("valuemap.create", {
        "hostid": hostid, "name": name,
        "mappings": [{"value": v, "newvalue": t} for v, t in mappings]})["valuemapids"][0]


def ensure_item(hostid, key, name, itype=AGENT, vtype=FLOAT, delay="30s", units="",
                valuemapid=None, params=None, history="7d", description="", tags=None):
    r = api.call("item.get", {"hostids": [hostid], "filter": {"key_": key},
                              "output": ["itemid"]})
    if r:
        return r[0]["itemid"]
    item = {"hostid": hostid, "key_": key, "name": name, "type": itype,
            "value_type": vtype, "delay": delay, "history": history,
            "description": description, "tags": tags or []}
    if units:
        item["units"] = units
    if vtype in (FLOAT, UINT):
        item["trends"] = "90d"
    if valuemapid:
        item["valuemapid"] = valuemapid
    if params:
        item["params"] = params
    return api.call("item.create", item)["itemids"][0]


def ensure_trigger(hostid, description, expression, priority, comments=""):
    r = api.call("trigger.get", {"hostids": [hostid], "filter": {"description": description},
                                 "output": ["triggerid"]})
    if r:
        return r[0]["triggerid"]
    return api.call("trigger.create", {
        "description": description, "expression": expression,
        "priority": priority, "comments": comments, "manual_close": 1})["triggerids"][0]


def ensure_graph(hostid, name, gitems):
    r = api.call("graph.get", {"hostids": [hostid], "filter": {"name": name},
                               "output": ["graphid"]})
    if r:
        return r[0]["graphid"]
    return api.call("graph.create", {
        "name": name, "width": 900, "height": 200,
        "gitems": [{"itemid": i, "color": c, "drawtype": 2 if n == 0 else 0}
                   for n, (i, c) in enumerate(gitems)]})["graphids"][0]


# ----------------------------------------------------------------------------
# Templates
# ----------------------------------------------------------------------------
def crear_template_base(tgid):
    T = "ST_Linux_Basico"
    tid = ensure_template(T, "ST - Linux basico (agente + ICMP)", tgid,
                          "Metricas basicas de CPU, memoria, disco y disponibilidad.")
    vm = ensure_valuemap(tid, "ST Estado", [("0", "Caido"), ("1", "Arriba")])
    tag = lambda c: [{"tag": "componente", "value": c}]

    ensure_item(tid, "agent.ping", "Agente Zabbix: ping", vtype=UINT, valuemapid=vm,
                tags=tag("sistema"))
    ensure_item(tid, "agent.version", "Agente Zabbix: version", vtype=CHAR, delay="1h",
                tags=tag("sistema"))
    ensure_item(tid, "st.contenedor.rol", "Rol del host", vtype=CHAR, delay="1h",
                tags=tag("sistema"))
    ensure_item(tid, "system.uptime", "Tiempo encendido", vtype=UINT, delay="5m",
                units="uptime", tags=tag("sistema"))
    ensure_item(tid, "proc.num", "Numero de procesos", vtype=UINT, delay="1m",
                tags=tag("sistema"))
    # CPU
    ensure_item(tid, "system.cpu.util[,idle]", "CPU: tiempo inactivo", units="%",
                tags=tag("cpu"))
    cpu = ensure_item(tid, "cpu.util.total", "CPU: utilizacion", itype=CALCULATED,
                      units="%", params="100-last(//system.cpu.util[,idle])", tags=tag("cpu"))
    ensure_item(tid, "system.cpu.load[all,avg1]", "CPU: carga promedio (1 min)",
                tags=tag("cpu"))
    # Memoria
    ensure_item(tid, "vm.memory.size[total]", "Memoria: total", vtype=UINT, delay="5m",
                units="B", tags=tag("memoria"))
    ensure_item(tid, "vm.memory.size[pavailable]", "Memoria: disponible", units="%",
                tags=tag("memoria"))
    mem = ensure_item(tid, "mem.util.total", "Memoria: utilizacion", itype=CALCULATED,
                      units="%", params="100-last(//vm.memory.size[pavailable])",
                      tags=tag("memoria"))
    # Disco
    ensure_item(tid, "vfs.fs.size[/,total]", "Disco /: total", vtype=UINT, delay="1h",
                units="B", tags=tag("disco"))
    disk = ensure_item(tid, "vfs.fs.size[/,pused]", "Disco /: utilizacion", delay="1m",
                       units="%", tags=tag("disco"))
    # ICMP (lo ejecuta el proxy)
    ensure_item(tid, "icmpping", "ICMP: ping", itype=SIMPLE, vtype=UINT, valuemapid=vm,
                tags=tag("red"))
    lat = ensure_item(tid, "icmppingsec", "ICMP: tiempo de respuesta", itype=SIMPLE,
                      units="s", tags=tag("red"))
    ensure_item(tid, "icmppingloss", "ICMP: perdida de paquetes", itype=SIMPLE, units="%",
                tags=tag("red"))

    ensure_trigger(tid, "Agente Zabbix sin respuesta en {HOST.NAME}",
                   f"nodata(/{T}/agent.ping,1m)=1", HIGH,
                   "El agente no envia datos hace 1 minuto: host o contenedor caido.")
    ensure_trigger(tid, "{HOST.NAME} no responde a ping (ICMP)",
                   f"max(/{T}/icmpping,#2)=0", DISASTER,
                   "Dos pings consecutivos fallidos desde el proxy.")
    ensure_trigger(tid, "Uso de CPU alto en {HOST.NAME} (>80%)",
                   f"min(/{T}/cpu.util.total,1m)>80", WARNING)
    ensure_trigger(tid, "Uso de memoria alto en {HOST.NAME} (>90%)",
                   f"min(/{T}/mem.util.total,2m)>90", AVERAGE)
    ensure_trigger(tid, "Disco / casi lleno en {HOST.NAME} (>85%)",
                   f"last(/{T}/vfs.fs.size[/,pused])>85", WARNING)
    ensure_trigger(tid, "Latencia ICMP alta en {HOST.NAME} (>100 ms)",
                   f"avg(/{T}/icmppingsec,2m)>0.1", INFO)

    ensure_graph(tid, "ST - CPU, memoria y disco (%)",
                 [(cpu, "1A7C11"), (mem, "F63100"), (disk, "2774A4")])
    ensure_graph(tid, "ST - Latencia ICMP", [(lat, "A54F10")])
    return tid


SERVICIOS = {
    "ST_Servicio_Web": {
        "nombre": "ST - Servicio Web (HTTP)", "proceso": "nginx",
        "items": [("net.tcp.service[http,,80]", "Servicio HTTP (puerto 80)")],
        "extra": [("web.page.perf[localhost,/,80]", "HTTP: tiempo de carga de la pagina", "s")],
    },
    "ST_Servicio_DB": {
        "nombre": "ST - Servicio Base de Datos (MySQL)", "proceso": "mysqld",
        "items": [("net.tcp.service[tcp,,3306]", "Servicio MySQL (puerto 3306)")],
        "extra": [],
    },
    "ST_Servicio_DNS": {
        "nombre": "ST - Servicio DNS (BIND9)", "proceso": "named",
        "items": [("net.tcp.service[tcp,,53]", "Servicio DNS (puerto 53/tcp)"),
                  ("net.dns[127.0.0.1,web.servicios.local,A,2,1]",
                   "DNS: resuelve web.servicios.local")],
        "extra": [],
    },
    "ST_Servicio_FTP": {
        "nombre": "ST - Servicio FTP (vsftpd)", "proceso": "vsftpd",
        "items": [("net.tcp.service[ftp,,21]", "Servicio FTP (puerto 21)")],
        "extra": [],
    },
}


def crear_templates_servicio(tgid):
    ids = {}
    for T, cfg in SERVICIOS.items():
        tid = ensure_template(T, cfg["nombre"], tgid, f"Monitoreo del servicio {cfg['proceso']}.")
        vm = ensure_valuemap(tid, "ST Estado servicio", [("0", "Caido"), ("1", "Arriba")])
        tag = [{"tag": "componente", "value": "servicio"}]
        for key, name in cfg["items"]:
            ensure_item(tid, key, name, vtype=UINT, valuemapid=vm, tags=tag)
            ensure_trigger(tid, f"{name} CAIDO en {{HOST.NAME}}",
                           f"last(/{T}/{key})=0", HIGH)
        pkey = f"proc.num[{cfg['proceso']}]"
        ensure_item(tid, pkey, f"Procesos {cfg['proceso']} en ejecucion", vtype=UINT, tags=tag)
        ensure_trigger(tid, f"Proceso {cfg['proceso']} no esta corriendo en {{HOST.NAME}}",
                       f"last(/{T}/{pkey})=0", AVERAGE)
        for key, name, units in cfg["extra"]:
            ensure_item(tid, key, name, units=units, delay="1m", tags=tag)
        ids[T] = tid
    return ids


# ----------------------------------------------------------------------------
# Hosts
# ----------------------------------------------------------------------------
def ensure_host(spec, gid_principal, proxyid):
    gid = ensure_hostgroup(spec["grupo"])
    templates = []
    for t in spec["templates"]:
        tid = template_id_by_name(t)
        if tid:
            templates.append({"templateid": tid})
        else:
            print(f"   ! template '{t}' no encontrado, se omite")
    params = {
        "host": spec["host"], "name": spec["name"],
        "groups": [{"groupid": gid_principal}, {"groupid": gid}],
        "templates": templates, "proxy_hostid": proxyid,
        "macros": spec.get("macros", []),
        "tags": [{"tag": "rol", "value": spec["rol"]}, {"tag": "proyecto", "value": "P7"}],
        "description": f"Contenedor '{spec['host']}' en la VM zbx-servicios (192.168.60.20)",
        "inventory_mode": 0,
        "inventory": {"type": "Contenedor Docker", "os": "Linux (Alpine/Oracle)",
                      "software": spec["software"], "location": "VM zbx-servicios",
                      "host_networks": spec["ip"]},
    }
    r = api.call("host.get", {"filter": {"host": [spec["host"]]}, "output": ["hostid"]})
    if r:
        params["hostid"] = r[0]["hostid"]
        api.call("host.update", params)
        print(f"   = host '{spec['host']}' actualizado")
        return r[0]["hostid"]
    params["interfaces"] = [{"type": 1, "main": 1, "useip": 1, "ip": spec["ip"],
                             "dns": "", "port": "10050"}]
    hid = api.call("host.create", params)["hostids"][0]
    print(f"   + host '{spec['host']}' ({spec['ip']}) via {PROXY_NAME}")
    return hid


def configurar_host_zabbix_server():
    """El host por defecto 'Zabbix server' apunta a 127.0.0.1; en Docker el agente
    vive en el contenedor 'zabbix-agent'."""
    r = api.call("host.get", {"filter": {"host": ["Zabbix server"]}, "output": ["hostid"],
                              "selectInterfaces": ["interfaceid", "type"]})
    if not r:
        return
    for itf in r[0]["interfaces"]:
        if str(itf["type"]) == "1":
            api.call("hostinterface.update", {"interfaceid": itf["interfaceid"],
                                              "useip": 0, "dns": "zabbix-agent"})
    print("   = host 'Zabbix server' -> agente en contenedor zabbix-agent")


def crear_escenario_web(hostid, ip):
    nombre = "Pagina principal"
    r = api.call("httptest.get", {"hostids": [hostid], "filter": {"name": nombre},
                                  "output": ["httptestid"]})
    if not r:
        api.call("httptest.create", {
            "name": nombre, "hostid": hostid, "delay": "30s", "retries": 1,
            "steps": [{"name": "Inicio", "url": f"http://{ip}/", "status_codes": "200",
                       "required": "Servicios Telematicos", "no": 1, "timeout": "10s"}]})
        print("   + escenario web 'Pagina principal' en host web")
    ensure_trigger(hostid, "Escenario web 'Pagina principal' fallando en {HOST.NAME}",
                   f"last(/web/web.test.fail[{nombre}])<>0", HIGH)
    ensure_trigger(hostid, "Pagina principal lenta en {HOST.NAME} (>2 s)",
                   f"avg(/web/web.test.time[{nombre},Inicio,resp],2m)>2", WARNING)


# ----------------------------------------------------------------------------
# Alertas por correo (MailHog)
# ----------------------------------------------------------------------------
MENSAJE_PROBLEMA = (
    "Problema iniciado a las {EVENT.TIME} del {EVENT.DATE}\n"
    "Problema: {EVENT.NAME}\nHost: {HOST.NAME} ({HOST.IP})\n"
    "Severidad: {EVENT.SEVERITY}\nDato: {EVENT.OPDATA}\nID evento: {EVENT.ID}")
MENSAJE_RECUPERACION = (
    "Problema resuelto a las {EVENT.RECOVERY.TIME} del {EVENT.RECOVERY.DATE}\n"
    "Problema: {EVENT.NAME}\nDuracion: {EVENT.DURATION}\nHost: {HOST.NAME}\n"
    "Severidad: {EVENT.SEVERITY}")


def configurar_smtp_real():
    """Media type 'Email (SMTP real)': solo se activa si hay credenciales en .env."""
    nombre = "Email (SMTP real)"
    servidor = os.environ.get("SMTP_REAL_SERVER", "")
    puerto = int(os.environ.get("SMTP_REAL_PORT") or 587)
    usuario = os.environ.get("SMTP_REAL_USER", "")
    clave = os.environ.get("SMTP_REAL_PASSWORD", "")
    r = api.call("mediatype.get", {"filter": {"name": [nombre]}, "output": ["mediatypeid"]})
    if not (servidor and usuario and clave):
        if r:
            api.call("mediatype.update", {"mediatypeid": r[0]["mediatypeid"], "status": 1})
        print(f"   - '{nombre}' desactivado (SMTP_REAL_USER/SMTP_REAL_PASSWORD vacios en .env):"
              f" los correos a {ALERT_EMAIL} solo se ven en MailHog")
        return None
    params = {"name": nombre, "type": 0, "status": 0,
              "smtp_server": servidor, "smtp_port": puerto, "smtp_helo": "st.local",
              "smtp_email": usuario, "smtp_security": 1,  # STARTTLS
              "smtp_verify_peer": 0, "smtp_verify_host": 0,
              "smtp_authentication": 1, "username": usuario, "passwd": clave,
              "content_type": 0}
    if r:
        params["mediatypeid"] = r[0]["mediatypeid"]
        api.call("mediatype.update", params)
        mid = r[0]["mediatypeid"]
    else:
        params["message_templates"] = [
            {"eventsource": 0, "recovery": 0, "subject": "Problema: {EVENT.NAME}",
             "message": MENSAJE_PROBLEMA},
            {"eventsource": 0, "recovery": 1, "subject": "Resuelto: {EVENT.NAME}",
             "message": MENSAJE_RECUPERACION}]
        mid = api.call("mediatype.create", params)["mediatypeids"][0]
    print(f"   + media type '{nombre}' -> {servidor}:{puerto} como {usuario}"
          f" (envio real a {ALERT_EMAIL})")
    return mid


def configurar_correo(gids_accion):
    mt = api.call("mediatype.get", {"filter": {"name": ["Email"]}, "output": ["mediatypeid"]})
    if mt:
        email_id = mt[0]["mediatypeid"]
        api.call("mediatype.update", {
            "mediatypeid": email_id, "status": 0,
            "smtp_server": "mailhog", "smtp_port": 1025, "smtp_helo": "st.local",
            "smtp_email": "zabbix@st.local", "smtp_security": 0,
            "smtp_authentication": 0, "content_type": 0})
    else:
        email_id = api.call("mediatype.create", {
            "name": "Email", "type": 0, "smtp_server": "mailhog", "smtp_port": 1025,
            "smtp_helo": "st.local", "smtp_email": "zabbix@st.local", "content_type": 0,
            "message_templates": [
                {"eventsource": 0, "recovery": 0, "subject": "Problema: {EVENT.NAME}",
                 "message": MENSAJE_PROBLEMA},
                {"eventsource": 0, "recovery": 1, "subject": "Resuelto: {EVENT.NAME}",
                 "message": MENSAJE_RECUPERACION}]})["mediatypeids"][0]
    print("   = media type 'Email' -> SMTP mailhog:1025")

    medias = [{"mediatypeid": email_id, "sendto": [ALERT_EMAIL], "active": 0,
               "severity": 63, "period": "1-7,00:00-24:00"}]

    # Envio real (opcional): mismo correo, pero por un SMTP con autenticacion (Gmail, 365...)
    real_id = configurar_smtp_real()
    if real_id:
        medias.append({"mediatypeid": real_id, "sendto": [ALERT_EMAIL], "active": 0,
                       "severity": 63, "period": "1-7,00:00-24:00"})

    # Media type de script propio (incluido en la imagen personalizada)
    try:
        r = api.call("mediatype.get", {"filter": {"name": ["ST Registro local"]},
                                       "output": ["mediatypeid"]})
        if r:
            script_id = r[0]["mediatypeid"]
            api.call("mediatype.update", {"mediatypeid": script_id, "status": 0})
        else:
            script_id = api.call("mediatype.create", {
                "name": "ST Registro local", "type": 1, "exec_path": "st_alerta_log.sh",
                "status": 0,
                "parameters": [{"sortorder": 0, "value": "{ALERT.SENDTO}"},
                               {"sortorder": 1, "value": "{ALERT.SUBJECT}"},
                               {"sortorder": 2, "value": "{ALERT.MESSAGE}"}],
                "message_templates": [
                    {"eventsource": 0, "recovery": 0, "subject": "PROBLEMA: {EVENT.NAME}",
                     "message": MENSAJE_PROBLEMA},
                    {"eventsource": 0, "recovery": 1, "subject": "RESUELTO: {EVENT.NAME}",
                     "message": MENSAJE_RECUPERACION}]})["mediatypeids"][0]
            print("   + media type 'ST Registro local' (script st_alerta_log.sh)")
        medias.append({"mediatypeid": script_id, "sendto": ["registro"], "active": 0,
                       "severity": 63, "period": "1-7,00:00-24:00"})
    except ZabbixError as exc:
        print(f"   ! no se pudo crear el media type de script: {exc}")

    admin = api.call("user.get", {"filter": {"username": ["Admin"]}, "output": ["userid"]})
    api.call("user.update", {"userid": admin[0]["userid"], "medias": medias})
    print(f"   = usuario Admin recibe alertas en {ALERT_EMAIL}")

    grp = api.call("usergroup.get", {"filter": {"name": ["Zabbix administrators"]},
                                     "output": ["usrgrpid"]})
    usrgrpid = grp[0]["usrgrpid"]
    nombre = "ST - Notificar problemas por correo"
    r = api.call("action.get", {"filter": {"name": [nombre]}, "output": ["actionid"]})
    if r:
        api.call("action.update", {"actionid": r[0]["actionid"], "status": 0})
    else:
        api.call("action.create", {
            "name": nombre, "eventsource": 0, "status": 0, "esc_period": "1h",
            "filter": {"evaltype": 0, "conditions": [
                {"conditiontype": 0, "operator": 0, "value": g} for g in gids_accion]},
            "operations": [{"operationtype": 0, "esc_step_from": 1, "esc_step_to": 1,
                            "opmessage_grp": [{"usrgrpid": usrgrpid}],
                            "opmessage": {"default_msg": 1, "mediatypeid": 0}}],
            "recovery_operations": [{"operationtype": 11,
                                     "opmessage": {"default_msg": 1}}],
        })
        print(f"   + accion '{nombre}'")


# ----------------------------------------------------------------------------
# Dashboard
# ----------------------------------------------------------------------------
def item_id(hostid, key):
    r = api.call("item.get", {"hostids": [hostid], "filter": {"key_": key},
                              "output": ["itemid"]})
    return r[0]["itemid"] if r else None


def graph_id(hostid, name):
    r = api.call("graph.get", {"hostids": [hostid], "filter": {"name": name},
                               "output": ["graphid"]})
    return r[0]["graphid"] if r else None


def crear_dashboard(gid_principal, hostids):
    nombre = "ST - Monitoreo de infraestructura"
    r = api.call("dashboard.get", {"filter": {"name": [nombre]}, "output": ["dashboardid"]})
    if r:
        api.call("dashboard.delete", [r[0]["dashboardid"]])

    grupo = [{"type": 2, "name": "groupids", "value": gid_principal}]
    resumen = [
        {"type": "clock", "name": "Hora del servidor", "x": 0, "y": 0, "width": 4, "height": 3},
        {"type": "hostavail", "name": "Disponibilidad de hosts", "x": 4, "y": 0,
         "width": 10, "height": 3, "fields": grupo},
        {"type": "problemsbysv", "name": "Problemas por severidad", "x": 14, "y": 0,
         "width": 10, "height": 3, "fields": grupo},
        {"type": "problems", "name": "Problemas activos", "x": 0, "y": 3,
         "width": 24, "height": 6, "fields": grupo},
    ]

    recursos, latencia, servicios = [], [], []
    service_keys = {
        "web": "net.tcp.service[http,,80]", "db": "net.tcp.service[tcp,,3306]",
        "dns": "net.dns[127.0.0.1,web.servicios.local,A,2,1]",
        "ftp": "net.tcp.service[ftp,,21]"}
    for n, (host, hid) in enumerate(hostids.items()):
        x, y = (n % 2) * 12, (n // 2) * 5
        g = graph_id(hid, "ST - CPU, memoria y disco (%)")
        if g:
            recursos.append({"type": "graph", "name": f"{host}: CPU / memoria / disco",
                             "x": x, "y": y, "width": 12, "height": 5,
                             "fields": [{"type": 0, "name": "source_type", "value": 0},
                                        {"type": 6, "name": "graphid", "value": g}]})
        g = graph_id(hid, "ST - Latencia ICMP")
        if g:
            latencia.append({"type": "graph", "name": f"{host}: latencia ICMP",
                             "x": x, "y": y, "width": 12, "height": 5,
                             "fields": [{"type": 0, "name": "source_type", "value": 0},
                                        {"type": 6, "name": "graphid", "value": g}]})
        for col, (key, titulo) in enumerate([(service_keys[host], "servicio"),
                                             ("icmpping", "ping"),
                                             ("cpu.util.total", "CPU")]):
            i = item_id(hid, key)
            if i:
                servicios.append({"type": "item", "name": f"{host}: {titulo}",
                                  "x": col * 8, "y": n * 3, "width": 8, "height": 3,
                                  "fields": [{"type": 4, "name": "itemid", "value": i}]})

    paginas = [{"name": "Resumen", "widgets": resumen},
               {"name": "Servicios", "widgets": servicios},
               {"name": "CPU / Memoria / Disco", "widgets": recursos},
               {"name": "Latencia", "widgets": latencia}]
    try:
        api.call("dashboard.create", {"name": nombre, "display_period": 30,
                                      "auto_start": 1, "pages": paginas})
        print(f"   + dashboard '{nombre}' ({len(paginas)} paginas)")
    except ZabbixError as exc:
        print(f"   ! dashboard completo fallo ({exc}); creando version simple")
        api.call("dashboard.create", {"name": nombre, "display_period": 30,
                                      "auto_start": 1, "pages": [paginas[0]]})


# ----------------------------------------------------------------------------
def main():
    api.login()

    paso("Grupos")
    gid_principal = ensure_hostgroup(GRUPO_PRINCIPAL)
    tgid = ensure_templategroup(GRUPO_TEMPLATES)

    paso("Proxy")
    proxyid = ensure_proxy(PROXY_NAME)

    paso("Templates")
    crear_template_base(tgid)
    crear_templates_servicio(tgid)

    paso("Hosts")
    hostids = {}
    for spec in HOSTS:
        hostids[spec["host"]] = ensure_host(spec, gid_principal, proxyid)
    configurar_host_zabbix_server()
    crear_escenario_web(hostids["web"], HOSTS[0]["ip"])

    paso("Alertas por correo (MailHog)")
    zbx_servers = api.call("hostgroup.get", {"filter": {"name": ["Zabbix servers"]},
                                             "output": ["groupid"]})
    configurar_correo([gid_principal] + [g["groupid"] for g in zbx_servers])

    paso("Dashboard")
    crear_dashboard(gid_principal, hostids)

    print("\n[OK] Zabbix configurado. Frontend: http://192.168.60.10:8080 (Admin/zabbix)")


if __name__ == "__main__":
    try:
        main()
    except ZabbixError as exc:
        print(f"[ERROR] {exc}")
        sys.exit(1)
