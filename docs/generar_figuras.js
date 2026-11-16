// Genera las figuras del informe (SVG -> PNG con Edge headless).
// Uso: node docs/generar_figuras.js   (desde la raiz del proyecto)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const RAIZ = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "figuras");
const REP = path.join(RAIZ, "pruebas_carga", "reportes");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
fs.mkdirSync(OUT, { recursive: true });

function renderPNG(nombre, svg, w, h) {
  const TMP = path.join(require("os").tmpdir(), "st-figs"); fs.mkdirSync(TMP, { recursive: true });
  const html = path.join(TMP, `_${nombre}.html`);
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#fff} svg{display:block}</style></head><body>${svg}</body></html>`);
  const tmpPng = path.join(TMP, `${nombre}.png`);
  if (fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng);
  const png = path.join(OUT, `${nombre}.png`);
  execFileSync(EDGE, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", `--user-data-dir=${path.join(require("os").tmpdir(), "st-edge-fig")}`,
    "--force-device-scale-factor=2", `--window-size=${w},${h}`,
    `--screenshot=${tmpPng}`, "file:///" + html.replace(/\\/g, "/")], { stdio: "pipe", timeout: 60000 });
  // msedge.exe es un lanzador: espera a que el PNG exista y deje de crecer
  const fin = Date.now() + 30000; let prev = -1;
  while (Date.now() < fin) {
    const n = fs.existsSync(tmpPng) ? fs.statSync(tmpPng).size : 0;
    if (n > 0 && n === prev) break; prev = n;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700);
  }
  fs.unlinkSync(html);
  fs.copyFileSync(tmpPng, png); fs.unlinkSync(tmpPng);
  console.log("figura:", png);
}

const FONT = "font-family='Times New Roman, serif'";

// ---------------------------------------------------------------- Arquitectura
function arquitectura() {
  const W = 900, H = 470;
  const box = (x, y, w, h, t, sub, fill = "#fff", stroke = "#333") =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>
     <text x="${x + w / 2}" y="${y + (sub ? h / 2 - 3 : h / 2 + 5)}" text-anchor="middle" font-size="14" font-weight="bold">${t}</text>
     ${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-size="11.5">${sub}</text>` : ""}`;
  const arrow = (x1, y1, x2, y2, label, dy = -6) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#222" stroke-width="1.5" marker-end="url(#a)"/>
     ${label ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 + dy}" text-anchor="middle" font-size="11.5" font-style="italic">${label}</text>` : ""}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" ${FONT}>
  <defs><marker id="a" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 z" fill="#222"/></marker></defs>
  <text x="${W / 2}" y="22" text-anchor="middle" font-size="15" font-weight="bold">Anfitrión Windows · VirtualBox · red privada 192.168.60.0/24</text>
  <!-- VM 1 -->
  <rect x="15" y="38" width="370" height="415" rx="10" fill="#f3f6fb" stroke="#4a6fa5" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="200" y="60" text-anchor="middle" font-size="15" font-weight="bold">VM zbx-server — 192.168.60.10</text>
  <text x="200" y="77" text-anchor="middle" font-size="11.5">Docker Compose · red st-zabbix-net · 4 vCPU</text>
  ${box(35, 92, 160, 56, "PostgreSQL 15", "BD de Zabbix", "#fff")}
  ${box(205, 92, 160, 56, "Zabbix Server 6.4", "imagen propia (Dockerfile)", "#dbe7f7")}
  ${box(35, 168, 160, 56, "Zabbix Web", "nginx + PHP-FPM :8080", "#fff")}
  ${box(205, 168, 160, 56, "MailHog", "SMTP :1025 · web :8025", "#fff")}
  ${box(35, 244, 160, 56, "zabbix-config", "Python · API JSON-RPC", "#fff")}
  ${box(205, 244, 160, 56, "Zabbix Agent 2", "host «Zabbix server»", "#fff")}
  <text x="200" y="330" text-anchor="middle" font-size="11.5">Volúmenes: zabbix_server.conf, agent2.conf, alertscripts</text>
  ${arrow(205, 120, 195, 120)}
  ${arrow(115, 168, 115, 148)}
  ${arrow(285, 148, 285, 168)}
  <text x="291" y="162" font-size="10.5" font-style="italic">alertas</text>
  ${arrow(115, 244, 115, 224)}
  ${box(35, 350, 330, 44, "Navegador del operador", "Zabbix :8080 · MailHog :8025 · Artillery (pruebas de carga)", "#fff8e6", "#b58a00")}
  <polyline points="35,372 24,372 24,196 33,196" fill="none" stroke="#222" stroke-width="1.5" marker-end="url(#a)"/>
  <!-- VM 2 -->
  <rect x="515" y="38" width="370" height="415" rx="10" fill="#f4faf3" stroke="#4f8a4a" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="700" y="60" text-anchor="middle" font-size="15" font-weight="bold">VM zbx-servicios — 192.168.60.20</text>
  <text x="700" y="77" text-anchor="middle" font-size="11.5">Docker Compose · red st-servicios 172.30.0.0/24</text>
  ${box(535, 92, 330, 50, "Zabbix Proxy (activo, SQLite) — 172.30.0.2", "chequeos de agente, ICMP, TCP, DNS y HTTP", "#dff0dc")}
  ${[["web", "nginx :80", ".11"], ["db", "MySQL 8", ".12"], ["dns", "BIND9 :53", ".13"], ["ftp", "vsftpd :21", ".14"]].map((s, i) => {
    const x = 535 + i * 84;
    return `${box(x, 190, 78, 54, s[0], s[1])}
      ${box(x, 262, 78, 40, "Agent 2", "sidecar " + s[2], "#eef6ec")}
      <line x1="${x + 39}" y1="244" x2="${x + 39}" y2="262" stroke="#4f8a4a" stroke-width="2"/>
      ${arrow(x + 39, 190, x + 39, 142)}`;
  }).join("")}
  <text x="700" y="325" text-anchor="middle" font-size="11.5">Cada agente comparte red y procesos con su servicio</text>
  <text x="700" y="341" text-anchor="middle" font-size="11.5">(network_mode / pid: service:X) — pasivo, puerto 10050</text>
  ${box(535, 365, 330, 44, "Pruebas: simular_caida.sh · estresar_cpu.sh", "toolbox (curl, dig, lftp, mysql)", "#fff")}
  <!-- enlaces entre VMs -->
  ${arrow(535, 112, 365, 112, "")}
  <text x="450" y="104" text-anchor="middle" font-size="12" font-weight="bold">TCP 10051</text>
  <text x="450" y="132" text-anchor="middle" font-size="11">proxy → servidor</text>
  <text x="450" y="146" text-anchor="middle" font-size="11">(conexión saliente)</text>
  </svg>`;
  renderPNG("fig1_arquitectura", svg, W, H);
}

// ------------------------------------------------- Artillery: antes vs despues
function serie(archivo) {
  const j = JSON.parse(fs.readFileSync(path.join(REP, archivo), "utf8"));
  const t0 = Number(j.intermediate[0].period);
  return j.intermediate.map(i => ({
    t: (Number(i.period) - t0) / 1000,
    llegada: (i.counters["vusers.created"] || 0) / 10,
    ok: (i.counters["http.codes.200"] || 0) / 10,
    err: (i.counters["errors.ERR_SOCKET_TIMEOUT"] || 0) / 10,
    p95: i.summaries["http.response_time"] ? i.summaries["http.response_time"].p95 : null,
  }));
}

function grafica({ titulo, series, campo, ymax, ylab, log, x0 = 60, w = 430, h = 260, xmax = 300 }) {
  const ix = t => x0 + (t / xmax) * (w - x0 - 15);
  const ymin = log ? 50 : 0;
  const iy = v => {
    const top = 30, bot = h - 40;
    if (log) return bot - (Math.log10(Math.max(v, ymin)) - Math.log10(ymin)) / (Math.log10(ymax) - Math.log10(ymin)) * (bot - top);
    return bot - (v / ymax) * (bot - top);
  };
  const ticksY = log ? [50, 100, 250, 500, 1000, 2500, 5000, 15000] : Array.from({ length: 6 }, (_, k) => (ymax / 5) * k);
  let g = `<text x="${(x0 + w) / 2}" y="18" text-anchor="middle" font-size="14" font-weight="bold">${titulo}</text>`;
  for (const v of ticksY) {
    g += `<line x1="${x0}" x2="${w - 15}" y1="${iy(v)}" y2="${iy(v)}" stroke="#ddd"/>
      <text x="${x0 - 6}" y="${iy(v) + 4}" text-anchor="end" font-size="11">${v >= 1000 ? v / 1000 + " s" : Math.round(v)}</text>`;
  }
  for (let t = 0; t <= xmax; t += 60)
    g += `<line x1="${ix(t)}" x2="${ix(t)}" y1="30" y2="${h - 40}" stroke="#eee"/>
      <text x="${ix(t)}" y="${h - 24}" text-anchor="middle" font-size="11">${t}</text>`;
  g += `<line x1="${x0}" x2="${w - 15}" y1="${h - 40}" y2="${h - 40}" stroke="#333"/>
    <line x1="${x0}" x2="${x0}" y1="30" y2="${h - 40}" stroke="#333"/>
    <text x="${(x0 + w) / 2}" y="${h - 6}" text-anchor="middle" font-size="12">Tiempo de prueba (s)</text>
    <text transform="translate(14 ${h / 2}) rotate(-90)" text-anchor="middle" font-size="12">${ylab}</text>`;
  for (const s of series) {
    const pts = s.datos.filter(d => d[campo] !== null && d[campo] !== undefined && (!log || d[campo] > 0))
      .map(d => `${ix(d.t).toFixed(1)},${iy(Math.min(d[campo], ymax)).toFixed(1)}`).join(" ");
    g += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.2" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/>`;
  }
  return g;
}

function artillery() {
  const antes = serie("carga-zabbix.json");
  const despues = serie("capacidad-zabbix.json");
  const series = [
    { datos: antes, color: "#c0392b", dash: "6 3", nombre: "Antes: 2 vCPU, PHP-FPM por defecto (1→10 VU/s)" },
    { datos: despues, color: "#1f5fa8", nombre: "Después: 4 vCPU + PHP-FPM ajustado (1→12 VU/s)" },
  ];
  const W = 900, H = 320;
  const a = grafica({ titulo: "(a) Latencia p95 de las respuestas", series, campo: "p95", ymax: 15000, ylab: "p95 (escala log.)", log: true });
  const b = grafica({ titulo: "(b) Respuestas correctas (HTTP 200)", series, campo: "ok", ymax: 40, ylab: "respuestas / s" });
  const leyenda = series.map((s, k) =>
    `<line x1="${110 + k * 380}" x2="${150 + k * 380}" y1="300" y2="300" stroke="${s.color}" stroke-width="2.5" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/>
     <text x="${158 + k * 380}" y="304" font-size="12.5">${s.nombre}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" ${FONT}>
    <g>${a}</g><g transform="translate(450 0)">${b}</g>${leyenda}</svg>`;
  renderPNG("fig5_artillery_zabbix", svg, W, H);
}

arquitectura();
artillery();
