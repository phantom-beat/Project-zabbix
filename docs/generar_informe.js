// Genera docs/Informe_IEEE_Proyecto7.docx (formato IEEE, dos columnas, carta).
// Requiere el paquete npm "docx". Uso: node docs/generar_informe.js
const fs = require("fs");
const path = require("path");
const d = require(process.env.DOCX_MODULE || "docx");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, AlignmentType,
  WidthType, BorderStyle, SectionType, ShadingType, VerticalAlign, LevelFormat, Footer, PageNumber,
} = d;

const FIG = path.join(__dirname, "figuras");
const OUT = path.join(__dirname, "Informe_IEEE_Proyecto7.docx");
const F = "Times New Roman";
const PT = n => n * 2; // half-points

// ------------------------------------------------------------------ helpers
function dimsImg(buf) { // PNG o JPEG -> [ancho, alto, tipo]
  if (buf[0] === 0x89) return [buf.readUInt32BE(16), buf.readUInt32BE(20), "png"];
  let i = 2;
  while (i < buf.length) {
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5), "jpg"];
    i += 2 + len;
  }
  throw new Error("formato de imagen no soportado");
}
function rutaFig(archivo) { // acepta .png o .jpg con el mismo nombre
  const base = path.join(FIG, archivo);
  for (const r of [base, base.replace(/.png$/, ".jpg")]) if (fs.existsSync(r)) return r;
  return null;
}
function runs(texto, base = {}) {
  // **negrita**, *cursiva*, `codigo`
  const out = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(texto))) {
    if (m.index > last) out.push(new TextRun({ text: texto.slice(last, m.index), font: F, ...base }));
    const t = m[0];
    if (t.startsWith("**")) out.push(new TextRun({ text: t.slice(2, -2), bold: true, font: F, ...base }));
    else if (t.startsWith("`")) out.push(new TextRun({ text: t.slice(1, -1), font: "Courier New", ...base, size: (base.size || PT(10)) - 2 }));
    else out.push(new TextRun({ text: t.slice(1, -1), italics: true, font: F, ...base }));
    last = m.index + t.length;
  }
  if (last < texto.length) out.push(new TextRun({ text: texto.slice(last), font: F, ...base }));
  return out;
}
const P = (texto, o = {}) => new Paragraph({
  children: runs(texto, { size: PT(10) }), alignment: AlignmentType.JUSTIFIED,
  indent: o.noIndent ? undefined : { firstLine: 202 }, spacing: { after: 0, line: 228 }, ...o.p,
});
const romanos = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
let nSec = 0, nSub = 0;
const H1 = texto => {
  nSub = 0;
  return new Paragraph({
    children: [new TextRun({ text: `${romanos[nSec++]}. ${texto}`, font: F, size: PT(10), smallCaps: true })],
    alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 }, keepNext: true,
  });
};
const H2 = texto => new Paragraph({
  children: [new TextRun({ text: `${String.fromCharCode(65 + nSub++)}. ${texto}`, font: F, size: PT(10), italics: true })],
  spacing: { before: 80, after: 40 }, keepNext: true,
});
const bullet = texto => new Paragraph({
  children: runs(texto, { size: PT(10) }), numbering: { reference: "vinetas", level: 0 },
  alignment: AlignmentType.JUSTIFIED, spacing: { after: 0, line: 228 },
});

let nFig = 0, nTab = 0;
function figura(archivo, anchoIn, pie, num) {
  const ruta = rutaFig(archivo);
  const out = [];
  if (ruta) {
    const buf = fs.readFileSync(ruta);
    const [w, h, tipo] = dimsImg(buf);
    const ancho = anchoIn * 96, alto = ancho * h / w;
    out.push(new Paragraph({
      children: [new ImageRun({ type: tipo, data: buf, transformation: { width: ancho, height: alto } })],
      alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 }, keepNext: true,
    }));
  } else {
    out.push(new Paragraph({
      children: [new TextRun({ text: `[Insertar captura: ${archivo}]`, font: F, size: PT(9), color: "C00000" })],
      alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 }, keepNext: true,
    }));
  }
  out.push(new Paragraph({
    children: [new TextRun({ text: `Fig. ${num}. `, font: F, size: PT(8) }), ...runs(pie, { size: PT(8) })],
    alignment: AlignmentType.CENTER, spacing: { after: 120 },
  }));
  return out;
}

const borde = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const sinBorde = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
function tabla(titulo, cabecera, filas, anchos, colsIzq = 1) {
  nTab++;
  const total = anchos.reduce((a, b) => a + b, 0);
  const celda = (t, cab, i, ultima) => new TableCell({
    width: { size: anchos[i], type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: cab ? { type: ShadingType.CLEAR, color: "auto", fill: "E7E6E6" } : undefined,
    margins: { top: 20, bottom: 20, left: 50, right: 50 },
    borders: { top: borde, bottom: borde, left: sinBorde, right: sinBorde },
    children: [new Paragraph({
      children: runs(t, { size: PT(7.5), bold: cab }),
      alignment: i < colsIzq ? AlignmentType.LEFT : AlignmentType.CENTER, spacing: { after: 0 }, keepNext: !ultima, keepLines: true,
    })],
  });
  return [
    new Paragraph({
      children: [new TextRun({ text: `TABLA ${romanos[nTab - 1]}`, font: F, size: PT(8) })],
      alignment: AlignmentType.CENTER, spacing: { before: 100, after: 0 }, keepNext: true,
    }),
    new Paragraph({
      children: [new TextRun({ text: titulo.toUpperCase(), font: F, size: PT(8), smallCaps: true })],
      alignment: AlignmentType.CENTER, spacing: { after: 60 }, keepNext: true,
    }),
    new Table({
      width: { size: total, type: WidthType.DXA }, columnWidths: anchos, alignment: AlignmentType.CENTER,
      rows: [new TableRow({ tableHeader: true, children: cabecera.map((t, i) => celda(t, true, i)) }),
        ...filas.map((f, k) => new TableRow({ cantSplit: true, children: f.map((t, i) => celda(t, false, i, k === filas.length - 1)) }))],
    }),
    new Paragraph({ children: [], spacing: { after: 100 } }),
  ];
}

// ------------------------------------------------------------------ contenido
const COL = 4867; // ancho de columna en DXA (carta, margenes IEEE)

const titulo = [
  new Paragraph({
    children: [new TextRun({ text: "Monitoreo de infraestructura de servicios telemáticos con Zabbix sobre contenedores Docker distribuidos en dos máquinas virtuales", font: F, size: PT(22) })],
    alignment: AlignmentType.CENTER, spacing: { after: 160 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "José David Aguirre Salinas y Gabriel Armando Gil Grueso", font: F, size: PT(11) })],
    alignment: AlignmentType.CENTER, spacing: { after: 0 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "Servicios Telemáticos — Proyecto 7 · Universidad Autónoma de Occidente, Cali, Colombia", font: F, size: PT(9), italics: true })],
    alignment: AlignmentType.CENTER, spacing: { after: 0 },
  }),
  new Paragraph({
    children: [new TextRun({ text: "jose.aguirre@uao.edu.co · gabriel.gil@uao.edu.co", font: F, size: PT(9) })],
    alignment: AlignmentType.CENTER, spacing: { after: 240 },
  }),
];

const resumen = [
  new Paragraph({
    children: [
      new TextRun({ text: "Resumen", font: F, size: PT(9), bold: true, italics: true }),
      new TextRun({ text: "—Se diseñó e implementó una plataforma de monitoreo basada en Zabbix 6.4 que supervisa cuatro servicios de red (web, base de datos, DNS y FTP) desplegados en contenedores Docker. La solución se distribuye en dos máquinas virtuales aprovisionadas con Vagrant: una aloja el servidor Zabbix (imagen propia), PostgreSQL, el frontend y MailHog; la otra, los servicios con un Zabbix Agent 2 sidecar cada uno y un Zabbix Proxy que reporta al servidor por una única conexión saliente. Toda la configuración (templates, triggers, escenario web, alertas y dashboard) se crea automáticamente por la API JSON-RPC. Las pruebas muestran detección de caída de host en 40–51 s, de falla funcional del servicio web en 28 s, alertas por umbral de CPU y notificaciones de problema y recuperación por correo. Con Artillery se encontró que el frontend de Zabbix es el cuello de botella (saturación de CPU desde ~3 usuarios/s); con 4 vCPU y PHP-FPM ajustado la capacidad se duplicó (de ~15 a ~32 respuestas/s).", font: F, size: PT(9), bold: true }),
    ],
    alignment: AlignmentType.JUSTIFIED, spacing: { after: 80 },
  }),
  new Paragraph({
    children: [
      new TextRun({ text: "Palabras clave", font: F, size: PT(9), bold: true, italics: true }),
      new TextRun({ text: "—Zabbix, monitoreo, Docker Compose, Vagrant, Zabbix Proxy, alertas, MailHog, pruebas de carga, Artillery.", font: F, size: PT(9), bold: true }),
    ],
    alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 },
  }),
];

const cuerpo1 = [
  H1("Introducción"),
  P("La disponibilidad de los servicios telemáticos (web, DNS, bases de datos, transferencia de archivos) es un requisito de cualquier organización. Detectar a tiempo una caída o una degradación —antes de que la reporte un usuario— exige un sistema que recoja métricas periódicamente, conserve su historia, evalúe condiciones de falla y notifique a los responsables [1]."),
  P("Este trabajo implementa dicho sistema con Zabbix, herramienta de código abierto ampliamente usada en la industria, empaquetando todos los componentes en contenedores Docker orquestados con Docker Compose [3] y aprovisionados con Vagrant [4]. Además de los requisitos del enunciado, se desplegó el monitor y lo monitoreado en máquinas virtuales separadas y se caracterizó la capacidad de la plataforma con pruebas de carga."),

  H1("Contexto (Problema)"),
  P("Se requiere monitorear una red de al menos cuatro hosts (web, DB, DNS y FTP) para conocer: (a) la disponibilidad de cada host, (b) el estado de cada servicio, (c) el uso de CPU, memoria y disco, y (d) generar alertas por correo cuando algo falle o supere un umbral."),
  P("Restricciones del enunciado: todo en contenedores; Zabbix Server 6.x con PostgreSQL o MySQL; frontend web; hosts, grupos, templates, triggers y dashboards personalizados; monitoreo HTTP, MySQL y ping; imagen Zabbix personalizada con Dockerfile; archivos de configuración montados como volúmenes; MailHog para las notificaciones; y un README con el inventario de hosts, servicios y URLs. Las pruebas mínimas son: dashboard en tiempo real, simulación de caída de host, alerta en MailHog y métricas históricas."),
  P("Se decidió además que el servidor de monitoreo no comparta máquina con los servicios que vigila, como ocurre en un escenario real: si la máquina de servicios falla, el monitor debe seguir operativo para detectarlo y notificarlo."),

  H1("Alternativas de solución"),
  H2("Proceso de selección"),
  P("Cada decisión abierta se resolvió en cuatro pasos: (1) las **restricciones** del enunciado actúan como filtro eliminatorio, no como criterio puntuable, para no inflar artificialmente a la alternativa exigida; (2) se definen criterios ligados a las necesidades del Contexto, cada uno con su **forma de medición** y una escala 1–5 con anclas explícitas (los valores intermedios 2 y 4 interpolan); (3) se puntúa con evidencia de la documentación oficial [1], [8]–[10] y de la implementación; (4) se analiza la **sensibilidad** del resultado a los pesos."),
  H2("Herramienta de monitoreo"),
  P("El enunciado fija Zabbix, así que la Tabla I no decide por sí sola: verifica si Zabbix sería también la mejor opción técnica frente a Prometheus + Grafana y Nagios Core, puntuadas con los mismos criterios."),
  ...tabla("Criterios, forma de medición y puntaje de la herramienta", ["Criterio (peso)", "Cómo se mide (1 / 3 / 5)", "Zab.", "P+G", "Nag."], [
    ["C1 Componentes a desplegar (25 %)", "Nº de piezas para cubrir los 6 requisitos (disponibilidad, servicios, CPU/RAM/disco, triggers, dashboards, correo): ≤3 → 5; 5 → 3; ≥7 → 1", "4", "2", "4"],
    ["C2 Dashboards e históricos (20 %)", "5 = dashboards editables + historia y tendencias nativas; 3 = gráficas básicas; 1 = sin histórico gráfico", "4", "5", "1"],
    ["C3 Monitoreo distribuido (20 %)", "5 = recolector nativo en la red remota, conexión saliente y *buffer*; 3 = federación o configuración extra; 1 = solo sondeo directo", "5", "3", "2"],
    ["C4 Configuración automatizable (20 %)", "5 = API para hosts, plantillas, alertas y dashboards; 3 = archivos versionables sin API de escritura; 1 = solo GUI", "5", "4", "3"],
    ["C5 Alertas por correo (15 %)", "5 = problema y recuperación con plantillas y escalamiento nativos; 3 = aviso básico; 1 = componente externo", "5", "4", "4"],
    ["**Total ponderado**", "", "**4,55**", "3,50", "2,80"],
  ], [1150, 2367, 450, 450, 450], 2),
  P("Evidencia de C1: Zabbix requiere servidor, frontend, base de datos y agente (4 piezas); Prometheus + Grafana, Prometheus, Grafana, Alertmanager y los *exporters* node, blackbox y mysqld (6); Nagios, núcleo con CGI, *plugins*, NRPE y PNP4Nagios para gráficas (4), aunque sin dashboards (C2 = 1)."),
  H2("Conectividad entre máquinas virtuales"),
  P("Era la decisión de diseño realmente abierta: el servidor no ve la red Docker interna de la VM de servicios. Alternativas: A1, publicar en la IP de la VM el puerto 10050 de cada agente y los puertos de servicio; A2, red *overlay* con Docker Swarm; A3, Zabbix Proxy activo dentro de la red de servicios (Tabla II)."),
  ...tabla("Criterios, forma de medición y puntaje de la conectividad", ["Criterio (peso)", "Cómo se mide (1 / 3 / 5)", "A1", "A2", "A3"], [
    ["K1 Cobertura de chequeos (35 %)", "Tipos de chequeo exigidos (agente, ICMP, TCP, escenario HTTP) ejecutables contra la IP de cada host: 4 → 5; 2 → 3; 0 → 1", "4", "5", "5"],
    ["K2 Superficie expuesta (25 %)", "Puertos abiertos entre VM: 1 → 5; 2–4 → 3; ≥5 → 1", "1", "3", "5"],
    ["K3 Complejidad (20 %)", "Componentes nuevos a operar: 0 → 5; 2 → 3; ≥4 → 1", "5", "2", "4"],
    ["K4 Tolerancia a cortes (20 %)", "5 = guarda los datos y los reenvía al volver el enlace; 1 = se pierden durante el corte", "1", "1", "5"],
    ["**Total ponderado**", "", "2,85", "3,10", "**4,80**"],
  ], [1150, 2367, 450, 450, 450], 2),
  P("A1 hace ping a la VM y no al contenedor (3 de 4 chequeos) y abre 8 puertos; A2 exige `swarm init/join`, una red *overlay* y desplegar como *stack* (3 componentes, 4 puertos: 2377, 7946 TCP/UDP y 4789); A3 añade solo el contenedor del proxy, usa una conexión saliente (TCP 10051) y conserva los datos si el enlace cae [1]."),
  H2("Ubicación del agente y base de datos"),
  P("Para el agente se exigió: identidad e IP propias por host, no modificar las imágenes oficiales y un proceso por contenedor. Instalarlo dentro de cada imagen viola las dos últimas y un agente por VM viola la primera; solo el agente **sidecar** (`network_mode` y `pid: service:X`) cumple las tres. Para la base de datos, PostgreSQL y MySQL están soportados; se eligió PostgreSQL y se reservó MySQL como *servicio monitoreado* para no mezclar roles."),
  H2("Reflexión sobre la selección"),
  P("Tratar la restricción del enunciado como filtro permitió comprobar que Zabbix es también la mejor opción técnica (4,55 frente a 3,50), en lugar de forzar el resultado. El orden es estable: con pesos iguales queda 4,60 / 3,60 / 2,80, y Prometheus + Grafana solo ganaría si los dashboards pesaran más del 61 %, lo que no refleja la necesidad principal (detectar y avisar). En conectividad, el proxy sigue ganando aunque la simplicidad pese el 50 % (4,50 frente a 3,66 de A1)."),
  P("La matriz no anticipó un riesgo del sidecar: al reiniciarse un servicio el agente pierde la red (Sec. VII). En una próxima evaluación se añadiría un criterio de **comportamiento ante reinicios**, medible forzando el reinicio de cada servicio y observando si el monitoreo se recupera solo."),
];

const cuerpo2 = [
  H1("Diseño de la solución"),
  P("La Fig. 1 resume la arquitectura. La VM **zbx-server** (192.168.60.10, 4 vCPU) ejecuta el Compose `st-servidor`: `postgres-server`, `zabbix-server` (imagen propia basada en `zabbix-server-pgsql:alpine-6.4`), `zabbix-web` (nginx + PHP-FPM, puerto 8080), `zabbix-agent` (monitorea al propio servidor), `mailhog` (SMTP 1025, web 8025) y `zabbix-config`, contenedor efímero que configura Zabbix por la API."),
  P("La VM **zbx-servicios** (192.168.60.20) ejecuta `st-servicios` con la red 172.30.0.0/24 e IP fijas: `zabbix-proxy` (.2), `web` nginx (.11), `db` MySQL 8 (.12), `dns` BIND9 (.13) y `ftp` vsftpd (.14), un Zabbix Agent 2 *sidecar* por servicio (modo pasivo, puerto 10050) y un contenedor `toolbox` para pruebas. Ambas VM usan una red privada nueva, 192.168.60.0/24, distinta de la de prácticas anteriores."),
  P("**Modelo de monitoreo.** Un template base, *ST - Linux básico*, enlazado a los cuatro hosts (CPU, memoria, disco, procesos, ping del agente, ICMP y latencia), y un template por tipo de servicio: puerto TCP, proceso y chequeo funcional (escenario HTTP con validación de contenido, resolución DNS, servicio FTP y el template oficial *MySQL by Zabbix agent 2*). Grupos: *Servicios Telemáticos* y uno por rol. Severidades: Desastre para host inalcanzable, Alta para agente o servicio caído, Media para proceso ausente o memoria, y Advertencia para CPU, disco o latencia."),
  P("**Alertas.** El media type Email apunta a MailHog [5] (`mailhog:1025`); la acción *ST - Notificar problemas por correo* avisa al grupo de administradores en el problema y en la recuperación. Un media type de tipo script (`st_alerta_log.sh`, incluido en la imagen personalizada) deja traza en un volumen, y uno opcional reenvía las alertas a un buzón real por SMTP con STARTTLS."),
];

const cuerpo3 = [
  H1("Implementación"),
  P("**Aprovisionamiento.** El `Vagrantfile` define dos VM `bento/ubuntu-22.04` con memoria y vCPU ajustables por variables de entorno. `instalar_docker.sh` instala solo Docker Engine y el plugin Compose; `desplegar.sh` copia la carpeta del rol a `/opt/st/<rol>` (corrigiendo los permisos 777 de la carpeta compartida, que MySQL y vsftpd rechazan, y los finales de línea CRLF) y ejecuta `docker compose up -d --build`."),
  P("**Imagen Zabbix personalizada.** El Dockerfile añade curl, jq y tzdata, los scripts de alerta y externos propios y la zona horaria, y cambia el `CMD` para arrancar con `zabbix_server.conf` montado como volumen. Conserva el *entrypoint* oficial, que crea el esquema en PostgreSQL en el primer arranque [2]."),
  P("**Configuración como código.** `configurar_zabbix.py` (solo librería estándar de Python) crea de forma idempotente grupos, el proxy, 5 templates con unos 30 ítems, unos 20 triggers y 2 gráficas, los 4 hosts (interfaz, macros, inventario y etiquetas), el escenario web, los medios de alerta, la acción y un dashboard de 4 páginas (Fig. 2). Un `vagrant up` deja la plataforma lista sin pasos manuales en el frontend."),
  P("**Servicios.** nginx con `default.conf` y el sitio montados; MySQL con scripts de inicialización que crean el usuario de la aplicación y `zbx_monitor`; BIND9 (imagen Alpine propia) autoritativo para `servicios.local` [6]; vsftpd (imagen Alpine propia) con usuario local, *chroot* y modo pasivo."),
  P("**Detección rápida.** Ítems cada 30 s, `nodata(agent.ping,1m)`, `max(icmpping,#2)=0`, y `UnreachablePeriod=45` y `UnavailableDelay=30` en el servidor y el proxy. Los secretos (cuenta SMTP real y clave de Artillery) se guardan en archivos excluidos del repositorio."),
  P("**Vigilante de agentes.** Si un servicio se reinicia, Docker le crea un *namespace* de red nuevo y su agente *sidecar* queda pegado al anterior. Un *timer* de systemd ejecuta cada minuto `vigilar_agentes.sh`, que compara el contenedor al que apunta cada agente con el actual de su servicio y lo recrea si difieren."),
];

const filasPruebas = [
  ["P1 Dashboard en tiempo real", "`estresar_cpu.sh web 150`", "Curva de CPU sube; «Uso de CPU alto» en ~1,8 min (Fig. 2)"],
  ["P2 Caída de host", "`simular_caida.sh ftp`", "3 repeticiones: agente sin respuesta (Alta) en 40–42 s; sin ping (Desastre) en 49–51 s (Fig. 4)"],
  ["P3 Falla funcional del servicio", "Se cambia el contenido de `index.html`", "«Escenario web fallando» (Alta) a los 28 s"],
  ["P4 Alertas por correo", "MailHog :8025 tras P1–P3", "Correos «Problem» y «Resolved» (Fig. 3); en P2, aviso a los 44 s y correo «Resuelto» al restaurar el host"],
  ["P5 Métricas históricas", "Graphs de cada host, 1 h", "Series de CPU con los picos de P1 y de las pruebas de carga"],
  ["P6 Servicios funcionales", "`probar_servicios.sh` en toolbox", "HTTP 200, DNS resuelve, consulta SQL, listado FTP y ping: 9/9 OK"],
];

const cuerpo4 = [
  H1("Pruebas"),
  P("Se ejecutaron las pruebas mínimas del enunciado más una prueba funcional y pruebas de carga. Los tiempos se midieron entre la acción y el evento registrado por Zabbix (Tabla III)."),
  ...tabla("Pruebas funcionales y de detección", ["Prueba", "Procedimiento", "Resultado obtenido"], filasPruebas, [1350, 1500, 2017]),
  ...figura("fig4_mailhog.png", 3.38, "Correos de problema y recuperación recibidos en MailHog (destinatario omitido).", 3),
  P("**Pruebas de carga.** Con Artillery 2 [7] se generó tráfico desde el anfitrión y los resultados se grabaron en Artillery Cloud. Hay dos escenarios: `web.yml` (GET `/` y `/salud` en nginx) y `zabbix.yml` (login del frontend y consultas `host.get`, `problem.get` e `item.get` a la API con un único token). Los umbrales de aprobación son p95 < 500 ms (web) o < 1,5 s (Zabbix) y una tasa de errores menor al 1 % (Tabla IV)."),
  ...tabla("Resultados de las pruebas de carga", ["Prueba", "VU", "Errores", "p95", "Máx. req/s", "OK"], [
    ["Web: rampa 5→50 VU/s, 120 s a 50", "7 800", "0", "2 ms", "100", "✔"],
    ["Web: pico de 200 VU/s durante 30 s", "6 450", "0", "10 ms", "411", "✔"],
    ["Zabbix inicial (2 vCPU), 1→10 VU/s", "1 560", "81 %", "14 s", "30", "✘"],
    ["Zabbix uso real (4 vCPU), 1→3 VU/s", "510", "0", "136 ms", "15", "✔"],
    ["Zabbix capacidad (4 vCPU), 1→12 VU/s", "1 560", "12 %", "14 s", "42", "—"],
  ], [1767, 600, 650, 650, 650, 550]),
];

const cuerpo5 = [
  H1("Discusión de las pruebas"),
  P("**Tiempo de detección.** La caída de host se detectó en 40–51 s, dentro de lo esperado por el diseño: ítems cada 30 s, `nodata` de 1 min y dos pings fallidos consecutivos. La falla funcional se detectó en 28 s porque el escenario web corre cada 30 s y basta un fallo. Reducir los intervalos acelera la detección, pero aumenta la carga y el volumen de la base de datos."),
  P("**Robustez del sidecar.** Tras reiniciar las VM, el contenedor ftp se reinició solo y su agente quedó desconectado durante 2 h: Zabbix mostraba «Agente sin respuesta» aunque el servicio funcionaba (sí respondía al ping). Es una debilidad del patrón `network_mode: service:X`, que se resolvió con el vigilante descrito en la sección V: al forzar un reinicio del servicio, el agente se reengancha en menos de 1 min."),
  P("**Correlación de síntomas.** Una caída de host dispara varios triggers (agente, ICMP y servicio) y, por tanto, varios correos. En producción se configurarían dependencias entre triggers para notificar solo la causa raíz."),
  P("**Métricas de contenedor.** Los cuatro contenedores comparten el kernel de la VM y el agente lee su `/proc`. Por eso la prueba de estrés en `web` elevó la CPU de los cuatro hosts y disparó el trigger en todos (en menos de 15 s entre ellos). Para métricas por contenedor se puede usar el plugin Docker del Agent 2 o cAdvisor."),
  P("**Capacidad.** nginx sirvió 411 req/s sin errores; solo creció la cola (p99 de 7 a 111 ms). El frontend y la API de Zabbix resultaron ser el cuello de botella: con 2 vCPU el p95 pasó de 150 ms a 1 s con ~3,6 VU/s y luego hubo *timeouts* masivos, con la CPU de zbx-server al 100 % según el propio Zabbix. Cada petición ejecuta PHP-FPM y consultas a PostgreSQL. Al pasar a 4 vCPU y limitar PHP-FPM a 16 procesos (para no agotar la RAM), la carga estable subió a ~6 VU/s y el rendimiento máximo de ~15 a ~32 respuestas/s (Fig. 5): duplicar la CPU duplicó la capacidad, lo que confirma que el límite es la CPU. Esta capacidad sobra para el uso real (unos pocos operadores), que pasó todos los umbrales con un p95 de 136 ms. El trigger de CPU de la plantilla oficial (5 min > 90 %) no se disparó porque la saturación duró ~4 min; conviene un trigger más sensible para el servidor de monitoreo."),
  P("**Históricos.** Con 7 días de historia y 90 de tendencias, las gráficas permiten correlacionar los picos con las pruebas y sirven para planificar la capacidad y calcular el SLA."),

  H1("Conclusiones"),
  bullet("Zabbix cubrió en una sola herramienta la recolección, el almacenamiento, la evaluación, la visualización y la notificación, y cumplió todos los requisitos del enunciado."),
  bullet("El agente *sidecar* y el Zabbix Proxy resolvieron el monitoreo de contenedores ubicados en otra máquina sin modificar las imágenes oficiales y con una única conexión entre las VM."),
  bullet("Automatizar la configuración por la API hace el despliegue reproducible: `vagrant up` deja la plataforma lista, incluidos los templates, las alertas y el dashboard."),
  bullet("Las pruebas de carga identificaron un cuello de botella que el monitoreo funcional no revela, y permitieron validar una optimización con datos (×2 en capacidad)."),
  bullet("Trabajo futuro: dependencias entre triggers, plugin Docker del Agent 2, TLS/PSK entre proxy y servidor, réplicas del frontend detrás de un balanceador y notificaciones por otros canales."),

  H1("Referencias"),
  ...[
    "[1] Zabbix SIA, «Zabbix 6.4 Manual», 2023. [En línea]. Disponible: https://www.zabbix.com/documentation/6.4/",
    "[2] Zabbix SIA, «Zabbix Docker images», GitHub. [En línea]. Disponible: https://github.com/zabbix/zabbix-docker",
    "[3] Docker Inc., «Docker Compose file reference». [En línea]. Disponible: https://docs.docker.com/compose/",
    "[4] HashiCorp, «Vagrant Documentation». [En línea]. Disponible: https://developer.hashicorp.com/vagrant/docs",
    "[5] MailHog, «Web and API based SMTP testing», GitHub. [En línea]. Disponible: https://github.com/mailhog/MailHog",
    "[6] ISC, «BIND 9 Administrator Reference Manual». [En línea]. Disponible: https://bind9.readthedocs.io/",
    "[7] Artillery Software, «Artillery documentation». [En línea]. Disponible: https://www.artillery.io/docs",
    "[8] Prometheus Authors, «Prometheus documentation». [En línea]. Disponible: https://prometheus.io/docs/",
    "[9] Grafana Labs, «Grafana documentation». [En línea]. Disponible: https://grafana.com/docs/grafana/",
    "[10] Nagios Enterprises, «Nagios Core documentation». [En línea]. Disponible: https://www.nagios.org/documentation/",
  ].map(r => new Paragraph({ children: [new TextRun({ text: r, font: F, size: PT(8) })], spacing: { after: 40 }, indent: { left: 300, hanging: 300 } })),
];

// ------------------------------------------------------------------ secciones
const pagina = { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1440, left: 1080, right: 1080 } };
const dosCol = { count: 2, space: 266, equalWidth: true };
const ANCHO_TOTAL_IN = 6.9, ANCHO_COL_IN = 3.38;

const pie = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: F, size: PT(8) })] })] });

const secciones = [
  { properties: { page: pagina }, footers: { default: pie }, children: [...titulo] },
  { properties: { type: SectionType.CONTINUOUS, page: pagina, column: dosCol }, children: [...resumen, ...cuerpo1] },
  { properties: { type: SectionType.CONTINUOUS, page: pagina }, children: figura("fig1_arquitectura.png", ANCHO_TOTAL_IN, "Arquitectura: dos VM con Docker Compose; los agentes *sidecar* reportan al Zabbix Proxy, que envía los datos al servidor por TCP 10051.", 1) },
  { properties: { type: SectionType.CONTINUOUS, page: pagina, column: dosCol }, children: [...cuerpo2, ...cuerpo3] },
  { properties: { type: SectionType.CONTINUOUS, page: pagina }, children: figura("fig2_dashboard.png", 6.2, "Dashboard «ST - Monitoreo de infraestructura», página CPU / Memoria / Disco (últimas 3 h). Los huecos iniciales corresponden a las VM apagadas.", 2) },
  { properties: { type: SectionType.CONTINUOUS, page: pagina, column: dosCol }, children: cuerpo4 },
  { properties: { type: SectionType.CONTINUOUS, page: pagina }, children: figura("fig3_problemas.png", ANCHO_TOTAL_IN, "Monitoring → Problems durante la caída simulada de ftp (12:24:14): agente sin respuesta a los 42 s y sin ping (Desastre) a los 51 s; debajo, la repetición anterior ya resuelta.", 4) },
  { properties: { type: SectionType.CONTINUOUS, page: pagina }, children: figura("fig5_artillery_zabbix.png", ANCHO_TOTAL_IN, "Carga sobre el frontend/API de Zabbix antes y después de la optimización: (a) latencia p95; (b) respuestas correctas por segundo.", 5) },
  { properties: { type: SectionType.CONTINUOUS, page: pagina, column: dosCol }, children: cuerpo5 },
];

const doc = new Document({
  creator: "José David Aguirre Salinas, Gabriel Armando Gil Grueso",
  title: "Monitoreo de infraestructura con Zabbix - Proyecto 7",
  styles: { default: { document: { run: { font: F, size: PT(10) } } } },
  numbering: { config: [{ reference: "vinetas", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 240, hanging: 180 } } } }] }] },
  sections: secciones,
});

Packer.toBuffer(doc).then(b => { fs.writeFileSync(OUT, b); console.log("informe:", OUT); });
