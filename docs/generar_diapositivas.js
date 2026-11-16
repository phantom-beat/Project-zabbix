// Genera docs/Presentacion_Proyecto7.pptx (16:9). Uso: node docs/generar_diapositivas.js
const fs = require("fs");
const path = require("path");
const pptxgen = require(process.env.PPTX_MODULE || "pptxgenjs");

const FIG = path.join(__dirname, "figuras");
const REP = path.join(__dirname, "..", "pruebas_carga", "reportes");
const OUT = path.join(__dirname, "Presentacion_Proyecto7.pptx");

// Paleta "sala de monitoreo": azul noche dominante, verde señal (OK), rojo alerta, ámbar advertencia
const K = { noche: "0F1C2E", tinta: "1B2B44", gris: "5B6B82", claro: "EEF2F7", blanco: "FFFFFF",
  verde: "1FA67A", rojo: "D64545", ambar: "E0A526", azul: "2E6FD8" };
const HEAD = "Cambria", BODY = "Calibri";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.author = "José David Aguirre Salinas";
pres.title = "Proyecto 7 - Monitoreo de infraestructura con Zabbix";
pres.theme = { headFontFace: HEAD, bodyFontFace: BODY };

pres.defineSlideMaster({
  title: "OSCURA", background: { color: K.noche },
  objects: [{ text: { text: "Servicios Telemáticos · Proyecto 7", options: { x: 0.6, y: 6.95, w: 8, h: 0.3, fontFace: BODY, fontSize: 11, color: "8FA3BF" } } }],
});
pres.defineSlideMaster({
  title: "CONTENIDO", background: { color: K.blanco },
  objects: [{ text: { text: "Servicios Telemáticos · Proyecto 7 · Monitoreo con Zabbix", options: { x: 0.6, y: 7.0, w: 9, h: 0.3, fontFace: BODY, fontSize: 10, color: K.gris } } }],
  slideNumber: { x: 12.3, y: 7.0, w: 0.5, h: 0.3, fontFace: BODY, fontSize: 10, color: K.gris },
});

const titulo = (s, t, sub) => {
  s.addText(t, { x: 0.6, y: 0.35, w: 12.1, h: 0.75, fontFace: HEAD, fontSize: 32, bold: true, color: K.noche, margin: 0, isTextBox: true });
  if (sub) s.addText(sub, { x: 0.6, y: 1.1, w: 12.1, h: 0.4, fontFace: BODY, fontSize: 16, italic: true, color: K.gris, margin: 0, isTextBox: true });
};
// Motivo: punto de estado (como el indicador ZBX de Zabbix) junto a cada encabezado de tarjeta
const tarjeta = (s, x, y, w, h, cab, cuerpo, color = K.verde, fondo = K.claro) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fondo }, line: { color: fondo }, rectRadius: 0.08 });
  s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.28, w: 0.22, h: 0.22, fill: { color }, line: { color } });
  s.addText(cab, { x: x + 0.6, y: y + 0.15, w: w - 0.8, h: 0.48, fontFace: HEAD, fontSize: 18, bold: true, color: K.noche, margin: 0, valign: "middle", isTextBox: true });
  s.addText(cuerpo, { x: x + 0.25, y: y + 0.7, w: w - 0.5, h: h - 0.85, fontFace: BODY, fontSize: 14, color: K.tinta, margin: 0, valign: "top", isTextBox: true, paraSpaceAfter: 4 });
};
const img = (s, archivo, x, y, w, hMax) => {
  const ruta = path.join(FIG, archivo);
  if (!fs.existsSync(ruta)) {
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: hMax, fill: { color: K.claro }, line: { color: K.gris, dashType: "dash" } });
    s.addText(`[captura pendiente: ${archivo}]`, { x, y, w, h: hMax, align: "center", fontSize: 14, color: K.gris, isTextBox: true });
    return;
  }
  const b = fs.readFileSync(ruta), iw = b.readUInt32BE(16), ih = b.readUInt32BE(20);
  let ww = w, hh = w * ih / iw;
  if (hh > hMax) { hh = hMax; ww = hMax * iw / ih; }
  s.addImage({ path: ruta, x: x + (w - ww) / 2, y, w: ww, h: hh });
};
const lista = items => items.map((t, i) => ({ text: t, options: { bullet: { indent: 18 }, breakLine: i < items.length - 1 } }));

// 1 Portada -------------------------------------------------------------------
let s = pres.addSlide({ masterName: "OSCURA" });
s.addShape(pres.shapes.OVAL, { x: 0.6, y: 1.55, w: 0.32, h: 0.32, fill: { color: K.verde }, line: { color: K.verde } });
s.addText("PROYECTO 7", { x: 1.05, y: 1.5, w: 6, h: 0.42, fontFace: BODY, fontSize: 16, bold: true, color: "8FA3BF", charSpacing: 4, margin: 0, isTextBox: true });
s.addText("Monitoreo de infraestructura con Zabbix", { x: 0.6, y: 2.1, w: 11.5, h: 1.6, fontFace: HEAD, fontSize: 48, bold: true, color: K.blanco, margin: 0, isTextBox: true });
s.addText("4 servicios en contenedores · 2 máquinas virtuales · alertas por correo · pruebas de carga", { x: 0.6, y: 3.75, w: 11.5, h: 0.5, fontFace: BODY, fontSize: 20, color: "CADCFC", margin: 0, isTextBox: true });
s.addText([{ text: "José David Aguirre Salinas", options: { bold: true, breakLine: true } }, { text: "Servicios Telemáticos · Universidad Autónoma de Occidente · Noviembre 2026" }],
  { x: 0.6, y: 5.2, w: 11, h: 0.9, fontFace: BODY, fontSize: 16, color: K.blanco, margin: 0, isTextBox: true });
s.addNotes("Presentar el proyecto: monitoreo de 4 servicios con Zabbix, desplegado en 2 VMs con Vagrant y Docker.");

// 2 Problema ------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENIDO" });
titulo(s, "El problema: enterarse antes que el usuario", "Requisitos del enunciado y decisión adicional del grupo");
tarjeta(s, 0.6, 1.8, 3.9, 3.35, "¿Qué hay que vigilar?", lista(["Disponibilidad de 4 hosts: web, DB, DNS, FTP", "Estado de cada servicio (HTTP, MySQL, ping)", "CPU, memoria y disco", "Histórico de métricas"]), K.azul);
tarjeta(s, 4.72, 1.8, 3.9, 3.35, "Restricciones", lista(["Todo en contenedores Docker", "Zabbix 6.x + PostgreSQL/MySQL", "Imagen Zabbix propia (Dockerfile)", "Configuración montada como volumen", "Alertas por correo a MailHog"]), K.ambar);
tarjeta(s, 8.84, 1.8, 3.9, 3.35, "Decisión del grupo", lista(["El monitor NO comparte máquina con lo monitoreado", "Si cae la VM de servicios, el servidor sigue vivo para avisar", "Red nueva 192.168.60.0/24, distinta a las prácticas"]), K.verde);
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.45, w: 12.14, h: 1.1, fill: { color: K.noche }, line: { color: K.noche }, rectRadius: 0.08 });
s.addText([{ text: "Pruebas mínimas: ", options: { bold: true, color: K.blanco } }, { text: "dashboard en tiempo real · caída de host · alerta en MailHog · métricas históricas", options: { color: "CADCFC" } }],
  { x: 0.95, y: 5.45, w: 11.5, h: 1.1, fontFace: BODY, fontSize: 18, valign: "middle", margin: 0, isTextBox: true });
s.addNotes("Pruebas mínimas pedidas: dashboard en tiempo real, caída de host, alerta en MailHog e históricos.");

// 3 Alternativas --------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENIDO" });
titulo(s, "Alternativas evaluadas", "Matriz ponderada (1–5) y decisiones de diseño");
const cab = t => ({ text: t, options: { bold: true, color: K.blanco, fill: { color: K.noche } } });
s.addTable([
  [cab("Criterio (peso)"), cab("Zabbix"), cab("Prometheus + Grafana"), cab("Nagios")],
  ["Exigido por el enunciado (30 %)", "5", "1", "1"],
  ["Agente SO + servicios (20 %)", "5", "4", "3"],
  ["Alertas por correo (15 %)", "5", "4", "4"],
  ["Dashboards e históricos (15 %)", "4", "5", "2"],
  ["Configuración por API (10 %)", "5", "4", "2"],
  ["Monitoreo distribuido (10 %)", "5", "3", "2"],
  [{ text: "Total", options: { bold: true } }, { text: "4,85", options: { bold: true, color: K.verde } }, "3,05", "2,15"],
], { x: 0.6, y: 1.8, w: 6.9, colW: [3.0, 1.1, 1.7, 1.1], fontFace: BODY, fontSize: 14, color: K.tinta, align: "center", valign: "middle", rowH: 0.52, border: { type: "solid", pt: 0.5, color: "C9D3E0" } });
tarjeta(s, 7.85, 1.8, 4.9, 2.25, "Agente sidecar", "Un Zabbix Agent 2 por servicio que comparte red y procesos (network_mode / pid: service:X). Sin tocar las imágenes oficiales.", K.verde);
tarjeta(s, 7.85, 4.3, 4.9, 2.25, "Zabbix Proxy", "Hace los chequeos dentro de la red de servicios y envía todo al servidor por una sola conexión saliente (TCP 10051).", K.verde);
s.addNotes("Explicar por qué se descartó publicar el puerto 10050 de cada agente: no permitía ICMP ni HTTP hacia las IP internas.");

// 4 Arquitectura --------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENIDO" });
titulo(s, "Arquitectura: dos VM, una conexión");
img(s, "fig1_arquitectura.png", 0.6, 1.3, 12.1, 5.55);
s.addNotes("Flujo: agente sidecar → proxy (VM servicios) → servidor (VM servidor) → PostgreSQL; alertas → MailHog.");

// 5 Docker e imagen propia ----------------------------------------------------
s = pres.addSlide({ masterName: "CONTENIDO" });
titulo(s, "Docker, Vagrant y configuración como código", "vagrant up deja todo listo, sin clics en el frontend");
const pasos = [
  ["1", "Vagrant", "2 VM Ubuntu 22.04; memoria y vCPU configurables por variables de entorno"],
  ["2", "Docker Compose", "Un compose por VM: 6 contenedores en el servidor, 10 en servicios"],
  ["3", "Imagen Zabbix propia", "Dockerfile: curl, jq, tzdata, scripts de alerta; arranca con zabbix_server.conf montado"],
  ["4", "API JSON-RPC", "configurar_zabbix.py crea grupos, 5 templates, ~20 triggers, hosts, alertas y dashboard"],
];
pasos.forEach((p, i) => {
  const y = 1.85 + i * 1.22;
  s.addShape(pres.shapes.OVAL, { x: 0.6, y, w: 0.8, h: 0.8, fill: { color: K.noche }, line: { color: K.noche } });
  s.addText(p[0], { x: 0.6, y, w: 0.8, h: 0.8, align: "center", valign: "middle", fontFace: HEAD, fontSize: 24, bold: true, color: K.blanco, margin: 0, isTextBox: true });
  s.addText(p[1], { x: 1.65, y: y - 0.02, w: 4.5, h: 0.42, fontFace: HEAD, fontSize: 19, bold: true, color: K.noche, margin: 0, isTextBox: true });
  s.addText(p[2], { x: 1.65, y: y + 0.4, w: 5.3, h: 0.5, fontFace: BODY, fontSize: 14, color: K.tinta, margin: 0, isTextBox: true });
});
s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 7.35, y: 1.85, w: 5.4, h: 4.75, fill: { color: K.noche }, line: { color: K.noche }, rectRadius: 0.08 });
s.addText([
  { text: "# servidor/zabbix-server/Dockerfile", options: { color: "8FA3BF", breakLine: true } },
  { text: "FROM zabbix/zabbix-server-pgsql:${ZABBIX_TAG}", options: { breakLine: true } },
  { text: "USER root", options: { breakLine: true } },
  { text: "RUN apk add --no-cache curl jq tzdata", options: { breakLine: true } },
  { text: "COPY alertscripts/    .../alertscripts/", options: { breakLine: true } },
  { text: "COPY externalscripts/ .../externalscripts/", options: { breakLine: true } },
  { text: "ENV TZ=America/Bogota", options: { breakLine: true } },
  { text: "USER 1997", options: { breakLine: true } },
  { text: "# entrypoint oficial: crea el esquema en la BD", options: { color: "8FA3BF", breakLine: true } },
  { text: "CMD [\"/usr/sbin/zabbix_server\",", options: { breakLine: true } },
  { text: "  \"--foreground\", \"-c\",", options: { breakLine: true } },
  { text: "  \"/etc/zabbix/custom/zabbix_server.conf\"]" },
], { x: 7.6, y: 2.05, w: 5.0, h: 4.35, fontFace: "Courier New", fontSize: 13, color: "D6E4F5", valign: "top", margin: 0, isTextBox: true });
s.addNotes("Recalcar que la configuración de Zabbix es reproducible: si se borra algo, se vuelve a ejecutar zabbix-config.");

// 6 Configuración Zabbix ------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENIDO" });
titulo(s, "Qué monitorea Zabbix y cuándo avisa");
const sev = [["Desastre", "Host no responde a ping: max(icmpping,#2)=0", K.rojo], ["Alta", "Agente sin datos 1 min · servicio caído · escenario web falla", "E8743B"],
  ["Media", "Proceso ausente · memoria > 90 %", K.ambar], ["Advertencia", "CPU > 80 % · disco > 85 % · latencia > 100 ms", "8FA3BF"]];
sev.forEach((v, i) => {
  const y = 1.45 + i * 1.12;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y, w: 6.3, h: 0.8, fill: { color: K.claro }, line: { color: K.claro }, rectRadius: 0.06 });
  s.addShape(pres.shapes.OVAL, { x: 0.82, y: y + 0.27, w: 0.26, h: 0.26, fill: { color: v[2] }, line: { color: v[2] } });
  s.addText(v[0], { x: 1.25, y: y + 0.05, w: 1.7, h: 0.7, fontFace: HEAD, fontSize: 17, bold: true, color: K.noche, valign: "middle", margin: 0, isTextBox: true });
  s.addText(v[1], { x: 2.95, y: y + 0.05, w: 3.85, h: 0.7, fontFace: BODY, fontSize: 13.5, color: K.tinta, valign: "middle", margin: 0, isTextBox: true });
});
tarjeta(s, 7.25, 1.45, 5.5, 2.3, "5 templates propios", lista(["ST - Linux básico: CPU, memoria, disco, ICMP", "ST - Web · DB · DNS · FTP: puerto, proceso y chequeo funcional", "+ oficial «MySQL by Zabbix agent 2»"]), K.azul);
tarjeta(s, 7.25, 4.1, 5.5, 1.75, "Escenario web", "GET / cada 30 s y validación del texto «Servicios Telematicos»", K.azul);
s.addText("Ítems cada 30 s; UnreachablePeriod = 45 s → detección en menos de 1 minuto", { x: 0.6, y: 6.15, w: 12.1, h: 0.5, fontFace: BODY, fontSize: 15, italic: true, color: K.gris, margin: 0, isTextBox: true });
s.addNotes("Grupos: Servicios Telemáticos y uno por rol (Servidores Web, Bases de Datos, DNS, FTP).");

// 7 Alertas -------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENIDO" });
titulo(s, "Alertas: problema y recuperación", "Acción «ST - Notificar problemas por correo»");
const flujo = [["Trigger", "se dispara"], ["Acción", "grupo admins"], ["Email", "→ MailHog :1025"], ["Script", "st_alerta_log.sh"], ["SMTP real", "Gmail (opcional)"]];
flujo.forEach((f, i) => {
  const x = 0.6 + i * 2.5;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.85, w: 2.1, h: 1.15, fill: { color: i === 0 ? K.rojo : K.noche }, line: { color: i === 0 ? K.rojo : K.noche }, rectRadius: 0.08 });
  s.addText([{ text: f[0], options: { bold: true, fontSize: 17, breakLine: true } }, { text: f[1], options: { fontSize: 12.5 } }],
    { x, y: 1.85, w: 2.1, h: 1.15, align: "center", valign: "middle", fontFace: BODY, color: K.blanco, margin: 0, isTextBox: true });
  if (i < flujo.length - 1) s.addShape(pres.shapes.RIGHT_TRIANGLE, { x: x + 2.18, y: 2.27, w: 0.25, h: 0.32, rotate: 90, fill: { color: K.gris }, line: { color: K.gris } });
});
img(s, "fig4_mailhog.png", 0.6, 3.3, 7.4, 3.45);
tarjeta(s, 8.35, 3.3, 4.4, 3.45, "Medido en la prueba", lista(["Caída de ftp → correo a los 44 s", "Restaurar → correo «Resolved»", "También llegó a Gmail por SMTP con STARTTLS"]), K.verde);
s.addNotes("La contraseña de la cuenta SMTP real vive en .env.smtp, fuera del repositorio.");

// 8 Dashboard -----------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENIDO" });
titulo(s, "Dashboard en tiempo real", "«ST - Monitoreo de infraestructura»: 4 páginas creadas por API");
img(s, "fig2_dashboard.png", 0.6, 1.65, 8.4, 5.15);
tarjeta(s, 9.3, 1.65, 3.45, 5.15, "Páginas", lista(["Resumen: disponibilidad y problemas por severidad", "Servicios: estado de HTTP, MySQL, DNS y FTP", "CPU / Memoria / Disco por host", "Latencia ICMP"]), K.azul);
s.addNotes("Demo en vivo: estresar_cpu.sh web 150 y ver subir la curva.");

// 9 Pruebas -------------------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENIDO" });
titulo(s, "Resultados de las pruebas", "Tiempo desde la acción hasta el evento en Zabbix");
const stat = (x, num, lab, color) => {
  s.addText(num, { x, y: 1.75, w: 2.9, h: 1.1, fontFace: HEAD, fontSize: 54, bold: true, color, margin: 0, isTextBox: true });
  s.addText(lab, { x, y: 2.85, w: 2.9, h: 0.75, fontFace: BODY, fontSize: 14, color: K.tinta, margin: 0, isTextBox: true });
};
stat(0.6, "40 s", "Caída de host: agente sin respuesta (49 s sin ping)", K.rojo);
stat(3.7, "28 s", "Falla funcional: escenario web fallando", "E8743B");
stat(6.8, "44 s", "Correo de alerta en MailHog y Gmail", K.azul);
stat(9.9, "9/9", "Pruebas funcionales de servicios OK", K.verde);
img(s, "fig3_problemas.png", 0.6, 3.85, 12.1, 2.95);
s.addNotes("Mencionar también la prueba de CPU: el trigger 'Uso de CPU alto' apareció en ~1,8 min, y en los 4 hosts porque comparten la CPU de la VM.");

// 10 Pruebas de carga ---------------------------------------------------------
s = pres.addSlide({ masterName: "CONTENIDO" });
titulo(s, "Pruebas de carga con Artillery", "El frontend de Zabbix era el cuello de botella; con 4 vCPU la capacidad se duplicó");
function serie(arch) {
  const j = JSON.parse(fs.readFileSync(path.join(REP, arch), "utf8"));
  return j.intermediate.slice(0, 26).map(i => i.summaries["http.response_time"] ? Math.round(i.summaries["http.response_time"].p95) : 15000);
}
const antes = serie("carga-zabbix.json"), despues = serie("capacidad-zabbix.json");
const etiquetas = antes.map((_, i) => String(i * 10));
s.addChart(pres.charts.LINE, [
  { name: "Antes: 2 vCPU", labels: etiquetas, values: antes },
  { name: "Después: 4 vCPU + PHP-FPM", labels: etiquetas, values: despues },
], {
  x: 0.6, y: 1.65, w: 7.6, h: 5.15, chartColors: [K.rojo, K.azul], lineSize: 3, lineDataSymbol: "none",
  showTitle: true, title: "Latencia p95 (ms, escala log.) vs tiempo de prueba (s)", titleFontSize: 14, titleColor: K.noche, titleFontFace: "+mn-lt",
  valAxisLogScaleBase: 10, valAxisMinVal: 50, valAxisMaxVal: 20000, valAxisLabelFontSize: 11, catAxisLabelFontSize: 11,
  valAxisLabelColor: K.gris, catAxisLabelColor: K.gris, valAxisLabelFontFace: "+mn-lt", catAxisLabelFontFace: "+mn-lt",
  catAxisLabelFrequency: 6, valGridLine: { color: "DDE3EA", size: 0.75 }, catGridLine: { style: "none" },
  showLegend: true, legendPos: "b", legendFontSize: 12, legendFontFace: "+mn-lt",
});
const cmp = [["Estable hasta", "~3 VU/s", "~6 VU/s"], ["Máximo sostenido", "15 req/s", "32 req/s"], ["VU fallidos al saturar", "81 %", "12 %"], ["Uso real (1→3 VU/s)", "—", "0 errores · p95 136 ms"]];
s.addTable([[cab(""), cab("Antes"), cab("Después")], ...cmp], { x: 8.5, y: 1.65, w: 4.25, colW: [1.75, 0.95, 1.55], fontFace: BODY, fontSize: 13, color: K.tinta, valign: "middle", rowH: 0.62, border: { type: "solid", pt: 0.5, color: "C9D3E0" } });
s.addText("Web nginx: 411 req/s en el pico, 0 errores, p95 10 ms", { x: 8.5, y: 5.2, w: 4.25, h: 0.9, fontFace: BODY, fontSize: 15, bold: true, color: K.verde, margin: 0, isTextBox: true });
s.addText("Resultados grabados en Artillery Cloud (Compare)", { x: 8.5, y: 6.1, w: 4.25, h: 0.5, fontFace: BODY, fontSize: 12, italic: true, color: K.gris, margin: 0, isTextBox: true });
s.addNotes("Cada consulta al frontend ejecuta PHP-FPM y PostgreSQL; la CPU de zbx-server llegó al 100 %. Duplicar vCPU duplicó la capacidad: el límite es CPU.");

// 11 Conclusiones -------------------------------------------------------------
s = pres.addSlide({ masterName: "OSCURA" });
s.addText("Conclusiones", { x: 0.6, y: 0.6, w: 12, h: 0.9, fontFace: HEAD, fontSize: 40, bold: true, color: K.blanco, margin: 0, isTextBox: true });
const concl = [
  ["Cumple el enunciado", "Recolección, históricos, triggers, dashboard y correo en una sola herramienta"],
  ["Sidecar + proxy", "Monitoreo entre VMs sin modificar imágenes y con una sola conexión"],
  ["Reproducible", "vagrant up configura Zabbix completo por API"],
  ["Carga medida", "Cuello de botella encontrado y optimización validada (×2)"],
];
concl.forEach((c, i) => {
  const x = 0.6 + (i % 2) * 6.15, y = 1.85 + Math.floor(i / 2) * 1.75;
  s.addShape(pres.shapes.OVAL, { x, y: y + 0.08, w: 0.28, h: 0.28, fill: { color: K.verde }, line: { color: K.verde } });
  s.addText(c[0], { x: x + 0.5, y, w: 5.4, h: 0.45, fontFace: HEAD, fontSize: 21, bold: true, color: K.blanco, margin: 0, isTextBox: true });
  s.addText(c[1], { x: x + 0.5, y: y + 0.5, w: 5.4, h: 0.85, fontFace: BODY, fontSize: 15, color: "CADCFC", margin: 0, isTextBox: true });
});
s.addText("Trabajo futuro: dependencias entre triggers · plugin Docker del Agent 2 · TLS/PSK proxy↔servidor · réplicas del frontend", { x: 0.6, y: 5.6, w: 12.1, h: 0.6, fontFace: BODY, fontSize: 15, italic: true, color: "8FA3BF", margin: 0, isTextBox: true });
s.addNotes("Cerrar con la demo en vivo si queda tiempo.");

pres.writeFile({ fileName: OUT }).then(f => console.log("diapositivas:", f));
