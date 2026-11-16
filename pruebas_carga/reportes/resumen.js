const f=process.argv[2]; const j=require(require("path").resolve(f)); const r=j.aggregate, c=r.counters, s=r.summaries;
console.log("vusers", c["vusers.created"], "completados", c["vusers.completed"], "fallidos", c["vusers.failed"]||0, "peticiones", c["http.requests"], "200:", c["http.codes.200"]||0);
console.log("errores:", Object.keys(c).filter(k=>k.startsWith("errors.")).map(k=>k+"="+c[k]).join(" ")||"ninguno");
const t=s["http.response_time"]; console.log("resp ms: mediana",t.median,"p95",t.p95,"p99",t.p99,"max",t.max);
console.log("rps pico", Math.max(...j.intermediate.map(i=>i.rates?.["http.request_rate"]||0)));
for (const [k,v] of Object.entries(s).filter(([k])=>k.startsWith("plugins.metrics-by-endpoint.response_time."))) console.log("  ",k.slice(43),"p95="+v.p95,"max="+v.max);
