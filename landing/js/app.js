/* Landing · Engenheiro de Corrida Virtual. Lê CSVs do capturar_telemetria.py e resultados.json do notebook. */
"use strict";
const C = window.CONFIG || {};
const $ = id => document.getElementById(id);
const num = v => { if (v === "" || v == null) return NaN; const n = +String(v).replace(",", "."); return isFinite(n) ? n : NaN; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const median = a => { const b = [...a].sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : NaN; };
const fmt = s => { if (!isFinite(s)) return "–"; const m = Math.floor(s / 60); return m + ":" + (s - m * 60).toFixed(3).padStart(6, "0"); };
const sgn = (x, d = 3) => isFinite(x) ? (x > 0 ? "+" : "") + x.toFixed(d) + " s" : "–";
const NOME = { ferrari: "Ferrari", alfaromeo: "Alfa Romeo" };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ---------- setups (telemetria/setups_f123.md) ---------- */
const AJ = [ // chave, rótulo, min, max, passo
  ["asa_dianteira", "Asa dianteira", 1, 50, 1], ["asa_traseira", "Asa traseira", 1, 50, 1],
  ["dif_com_acel", "Diferencial c/ acel. (%)", 10, 100, 1], ["dif_sem_acel", "Diferencial s/ acel. (%)", 10, 100, 1],
  ["cambagem_diant", "Cambagem dianteira (°)", -3.5, -2.5, 0.1], ["cambagem_tras", "Cambagem traseira (°)", -2.0, -1.0, 0.1],
  ["convergencia_diant", "Convergência dianteira (°)", 0, 0.1, 0.01], ["convergencia_tras", "Convergência traseira (°)", 0.1, 0.25, 0.01],
  ["suspensao_diant", "Suspensão dianteira", 1, 41, 1], ["suspensao_tras", "Suspensão traseira", 1, 41, 1],
  ["barra_diant", "Barra anti-rolagem D", 1, 21, 1], ["barra_tras", "Barra anti-rolagem T", 1, 21, 1],
  ["altura_diant", "Altura dianteira", 10, 50, 1], ["altura_tras", "Altura traseira", 20, 60, 1],
  ["freio_pressao", "Pressão de freio (%)", 80, 100, 1], ["freio_balanco", "Balanço de freio (%)", 50, 70, 1],
  ["pneu_diant", "Pneu dianteiro (psi)", 21, 30, 0.1], ["pneu_tras", "Pneu traseiro (psi)", 19.5, 27, 0.1]];
const S0 = { asa_dianteira: 50, asa_traseira: 50, dif_com_acel: 50, dif_sem_acel: 53, cambagem_diant: -2.5, cambagem_tras: -1.0,
  convergencia_diant: 0.05, convergencia_tras: 0.25, suspensao_diant: 41, suspensao_tras: 13, barra_diant: 7, barra_tras: 5,
  altura_diant: 32, altura_tras: 36, freio_pressao: 100, freio_balanco: 53, pneu_diant: 22.5, pneu_tras: 20.0 };
const SETUPS = [
  ["S0", "Base TimeTrialKing", "referência", {}],
  ["S1", "Dif. c/ acel. 50 → 80", "diferencial travado", { dif_com_acel: 80 }],
  ["S2", "Dif. s/ acel. 53 → 30", "menos trava na entrada", { dif_sem_acel: 30 }],
  ["S3", "Cambagem −3,5 / −2,0", "cambagem agressiva", { cambagem_diant: -3.5, cambagem_tras: -2.0 }],
  ["S4", "Conv. traseira 0,25 → 0,10", "traseira solta", { convergencia_tras: 0.10 }],
  ["S5", "Barra D 7 → 15", "barra dianteira dura", { barra_diant: 15 }],
  ["S6", "Barra T 5 → 12", "barra traseira dura", { barra_tras: 12 }],
  ["S7", "Altura 25 / 45", "altura invertida", { altura_diant: 25, altura_tras: 45 }],
  ["S8", "Pneu T 20,0 → 22,0 psi", "pneu traseiro cheio", { pneu_tras: 22.0 }],
  ["S9", "Asa T 50 → 45", "menos asa (controle)", { asa_traseira: 45 }],
  ["S10", "~8 ajustes de uma vez", "setup sugerido por IA", { asa_traseira: 47, dif_sem_acel: 50, convergencia_diant: 0.08, convergencia_tras: 0.20,
    suspensao_diant: 12, suspensao_tras: 7, barra_diant: 5, barra_tras: 2, altura_diant: 36, altura_tras: 42, freio_balanco: 54, pneu_diant: 22.2 }]];
const S10 = { ...S0, ...SETUPS[10][3] };

function montarSetups() {
  $("setups").innerHTML = SETUPS.map(([id, mud, obj]) =>
    `<div class="setup ${id === "S10" ? "ia" : ""}"><b>${id}</b><div class="mud">${mud}</div><div class="obj">${obj}</div></div>`).join("");
  $("tabS10").innerHTML = `<table><tr><th>Ajuste</th><th>S0 (base)</th><th>S10 (IA)</th></tr>` +
    AJ.map(([k, r]) => `<tr><td>${r}</td><td>${S0[k]}</td><td class="${S0[k] !== S10[k] ? "dif" : ""}">${S10[k]}</td></tr>`).join("") + `</table>`;
}

/* ---------- arte própria (SVG gerado por código, sem logos) ---------- */
function carroSVG(cor) {
  return `<svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="g${cor.slice(1)}" x1="0" x2="1"><stop offset="0" stop-color="${cor}" stop-opacity=".1"/><stop offset=".5" stop-color="${cor}"/><stop offset="1" stop-color="${cor}" stop-opacity=".5"/></linearGradient></defs>
  <g transform="translate(20,40)" fill="url(#g${cor.slice(1)})" stroke="#fff3" stroke-width="1">
  <path d="M10 90 L60 82 L120 70 L170 52 L215 50 L240 38 L262 38 L272 52 L320 60 L345 60 L350 40 L362 40 L360 92 Z"/>
  <rect x="0" y="86" width="40" height="8" rx="2"/><rect x="345" y="30" width="18" height="34" rx="2"/></g>
  <g fill="#0b0b0d" stroke="#555" stroke-width="3"><circle cx="95" cy="128" r="26"/><circle cx="330" cy="126" r="30"/></g>
  <g stroke="${cor}" stroke-width="2" opacity=".5"><line x1="0" y1="175" x2="400" y2="175"/><line x1="40" y1="185" x2="300" y2="185"/></g></svg>`;
}

/* ---------- dados ---------- */
const D = { voltas: [], am: new Map(), exemplo: false, carregado: false };
const key = (u, v) => u + "|" + v;
async function existe(u) { try { const r = await fetch(u, { method: "HEAD", cache: "no-store" }); return r.ok; } catch { return false; } }
async function primeiro(lista) { for (const u of lista) if (await existe(u)) return u; return null; }
async function texto(url) {
  const r = await fetch(url, { cache: "no-store" }); if (!r.ok) throw new Error(url + " HTTP " + r.status);
  const buf = await r.arrayBuffer(); const b = new Uint8Array(buf);
  if (url.endsWith(".gz") && b[0] === 0x1f && b[1] === 0x8b) // gzip de verdade (servidor não descompactou)
    return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  return new TextDecoder().decode(buf);
}
const parse = t => Papa.parse(t, { header: true, skipEmptyLines: true, transformHeader: h => h.trim() }).data;

function limpar(rows) {
  const L = rows.map(r => ({ uid: r.session_uid, volta: +r.volta, carro: String(r.carro || "").trim().toLowerCase(), setup: String(r.setup_id || "").trim().toUpperCase(),
    sessao: r.sessao, tempo: num(r.tempo_volta_ms) / 1000, r })).filter(x => x.tempo > 0);
  const ok = (r, c, v) => !(c in r) || r[c] === "" || num(r[c]) === v;
  const base = L.filter(x => ok(x.r, "valida", 1) && ok(x.r, "pista_id", 5) && (x.carro === "ferrari" || x.carro === "alfaromeo"));
  const g = {}; base.forEach(x => (g[x.carro + x.setup] ??= []).push(x.tempo));
  const md = {}; for (const k in g) md[k] = median(g[k]);
  return base.filter(x => x.tempo <= 1.07 * md[x.carro + x.setup]).map(x => (x.k = key(x.uid, x.volta), x));
}
async function carregarDados() {
  let vUrl = await primeiro(["data/voltas.csv", "data/voltas.csv.gz"]), aUrl = null;
  if (vUrl) aUrl = await primeiro(["data/amostras_leve.csv", "data/amostras_leve.csv.gz", "data/amostras.csv.gz", "data/amostras.csv"]);
  else { D.exemplo = true; vUrl = "data/demo/voltas.csv"; aUrl = "data/demo/amostras_leve.csv.gz"; }
  try {
    D.voltas = limpar(parse(await texto(vUrl)));
    let n = 0;
    if (aUrl) {
      const ks = new Set(D.voltas.map(v => v.k)), last = new Map();
      for (const a of parse(await texto(aUrl))) {
        n++; const k = key(a.session_uid, a.volta); if (!ks.has(k)) continue;
        const d = num(a.lap_distance); if (!(d >= 0)) continue;
        const ld = last.get(k); if (ld !== undefined && d - ld < 8 && d > ld) continue; last.set(k, d);
        let arr = D.am.get(k); if (!arr) D.am.set(k, arr = []);
        arr.push({ d, x: num(a.world_x), z: num(a.world_z), v: num(a.velocidade), b: num(a.freio), t: num(a.tempo_volta_atual_ms) / 1000 });
      }
    }
    D.nAm = n; D.carregado = true;
    $("stVoltas").textContent = D.voltas.length.toLocaleString("pt-BR");
    $("stAmostras").textContent = n >= 1000 ? Math.round(n / 1000).toLocaleString("pt-BR") + "k" : n;
    $("fonteDados").innerHTML = D.exemplo ? '<span class="ex">● DADOS DE EXEMPLO (sintéticos)</span> — coloque voltas.csv e amostras em <code>data/</code> para ver os seus.'
      : `● dados reais: ${esc(vUrl)}${aUrl ? " + " + esc(aUrl) : ""}`;
    montarTelemetria(); trilhaHero(); ticker(); if (R.dados) ranking();
  } catch (e) { console.warn(e); $("fonteDados").textContent = "Não foi possível ler os CSVs: " + e.message; }
}

/* ---------- hero: traçado de Mônaco a partir da volta mais rápida ---------- */
function trilhaHero() {
  const best = [...D.voltas].filter(v => D.am.has(v.k)).sort((a, b) => a.tempo - b.tempo)[0]; if (!best) return;
  const p = D.am.get(best.k).filter(q => isFinite(q.x) && isFinite(q.z)); if (p.length < 10) return;
  const xs = p.map(q => q.x), zs = p.map(q => q.z), mx = Math.min(...xs), Mx = Math.max(...xs), mz = Math.min(...zs), Mz = Math.max(...zs);
  const s = Math.min(760 / (Mx - mx), 460 / (Mz - mz));
  const path = p.map((q, i) => (i ? "L" : "M") + (20 + (q.x - mx) * s).toFixed(1) + " " + (20 + (q.z - mz) * s).toFixed(1)).join(" ");
  const el = $("pistaHero"); el.setAttribute("d", path);
  const len = el.getTotalLength(); el.style.strokeDasharray = len; el.style.strokeDashoffset = len;
}

/* ---------- telemetria interativa ---------- */
const T = { modo: "vel", chart: null };
function opcoes(sel, lista, val) { sel.innerHTML = lista.map(s => `<option ${s === val ? "selected" : ""}>${s}</option>`).join(""); }
function montarTelemetria() {
  const ss = [...new Set(D.voltas.map(v => v.setup))].sort((a, b) => +a.slice(1) - +b.slice(1));
  opcoes($("fSetupA"), ss, "S0"); opcoes($("fSetupB"), ss, ss.includes("S10") ? "S10" : ss[1] || "S0");
  ["fCarro", "fSetupA", "fSetupB", "fTop"].forEach(id => $(id).onchange = desenhar);
  $("fModo").onclick = e => { const b = e.target.closest("button"); if (!b) return; T.modo = b.dataset.m;
    [...$("fModo").children].forEach(x => x.classList.toggle("on", x === b)); desenhar(); };
  $("badgeTel").textContent = D.exemplo ? "EXEMPLO · dados sintéticos" : "dados reais"; $("badgeTel").classList.toggle("ex", D.exemplo);
  desenhar();
}
function voltasDe(setup) {
  const c = $("fCarro").value, n = +$("fTop").value;
  return D.voltas.filter(v => v.setup === setup && (!c || v.carro === c)).sort((a, b) => a.tempo - b.tempo).slice(0, n);
}
const BIN = 10;
function perfil(voltas) { // média por fatia de 10 m: velocidade, tempo, x, z
  const acc = new Map();
  for (const v of voltas) { const arr = D.am.get(v.k); if (!arr) continue;
    for (const p of arr) { const b = Math.floor(p.d / BIN); let o = acc.get(b); if (!o) acc.set(b, o = { v: [], t: [], x: [], z: [] });
      o.v.push(p.v); o.t.push(p.t); o.x.push(p.x); o.z.push(p.z); } }
  return [...acc.entries()].sort((a, b) => a[0] - b[0]).map(([b, o]) => ({ d: b * BIN, v: mean(o.v), t: mean(o.t), x: median(o.x), z: median(o.z) }));
}
function frenagens(voltas) {
  const pts = [];
  for (const v of voltas) { const arr = D.am.get(v.k); if (!arr) continue;
    for (let i = 1; i < arr.length; i++) if (arr[i - 1].b < 0.1 && arr[i].b >= 0.3) pts.push(arr[i]); }
  return pts;
}
const cor = t => `hsl(${120 * Math.max(0, Math.min(1, t))},90%,50%)`;
function desenhar() {
  const cv = $("mapa"), g = cv.getContext("2d"), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const A = voltasDe($("fSetupA").value), B = voltasDe($("fSetupB").value);
  const pA = perfil(A), pB = perfil(B);
  const ref = pA.length ? pA : pB;
  const kpi = (id, l) => $(id).textContent = l.length ? fmt(l[0].tempo) : "—";
  kpi("kA", A); kpi("kB", B);
  $("kD").textContent = A.length && B.length ? sgn(mean(B.map(v => v.tempo)) - mean(A.map(v => v.tempo))) : "—";
  const fA = frenagens(A), fB = frenagens(B);
  $("kF").textContent = `${fA.length} / ${fB.length}`;
  if (!ref.length) { g.fillStyle = "#888"; g.font = "20px Titillium Web"; g.fillText("Sem amostras para este filtro.", 30, 50); return; }
  const xs = ref.map(p => p.x).filter(isFinite), zs = ref.map(p => p.z).filter(isFinite);
  const mx = Math.min(...xs), Mx = Math.max(...xs), mz = Math.min(...zs), Mz = Math.max(...zs);
  const s = Math.min((W - 60) / (Mx - mx), (H - 60) / (Mz - mz)), ox = (W - (Mx - mx) * s) / 2, oz = (H - (Mz - mz) * s) / 2;
  const P = p => [ox + (p.x - mx) * s, oz + (p.z - mz) * s];
  // base da pista
  g.lineCap = "round"; g.lineJoin = "round";
  g.strokeStyle = "#1f1f25"; g.lineWidth = 22; g.beginPath(); ref.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  let leg = "";
  if (T.modo === "vel" || T.modo === "delta") {
    let val, lo, hi;
    if (T.modo === "vel") { val = ref.map(p => p.v); lo = Math.min(...val); hi = Math.max(...val);
      leg = `<span>${Math.round(lo)} km/h</span><span class="bar" style="background:linear-gradient(90deg,${cor(0)},${cor(.5)},${cor(1)})"></span><span>${Math.round(hi)} km/h</span>`; }
    else { const mB = new Map(pB.map(p => [p.d, p.t]));
      // ganho/perda por fatia: derivada da diferença de tempo acumulado
      let prev = 0; val = ref.map(p => { const tb = mB.get(p.d); const d = isFinite(tb) ? tb - p.t : prev; const r = d - prev; prev = d; return r; });
      const lim = Math.max(0.005, ...val.map(Math.abs).sort((a, b) => a - b).slice(0, Math.floor(val.length * .95)).slice(-1)); lo = lim; hi = -lim;
      leg = `<span>B ganha</span><span class="bar" style="background:linear-gradient(90deg,${cor(1)},#888,${cor(0)})"></span><span>B perde</span>`; }
    g.lineWidth = 9;
    for (let i = 1; i < ref.length; i++) { const t = T.modo === "vel" ? (val[i] - lo) / (hi - lo || 1) : 0.5 + (-val[i] / lo) / 2;
      const [x0, y0] = P(ref[i - 1]), [x1, y1] = P(ref[i]); if (Math.hypot(x1 - x0, y1 - y0) > 40) continue;
      g.strokeStyle = cor(t); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  } else {
    g.strokeStyle = "#555"; g.lineWidth = 4; g.beginPath(); ref.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    const dot = (pts, c, r) => { g.fillStyle = c; pts.forEach(p => { const [x, y] = P(p); g.globalAlpha = .55; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); g.globalAlpha = 1; };
    dot(fA, "#ffffff", 5); dot(fB, "#E10600", 4);
    leg = `<span>● <b style="color:#fff">${esc($("fSetupA").value)}</b> pontos de frenagem</span><span>● <b style="color:#E10600">${esc($("fSetupB").value)}</b></span>`;
  }
  // largada
  const [sx, sy] = P(ref[0]); g.fillStyle = "#fff"; g.fillRect(sx - 3, sy - 12, 6, 24);
  $("legenda").innerHTML = leg + `<span style="margin-left:auto">${A.length} voltas A · ${B.length} voltas B</span>`;
  // gráfico velocidade x distância
  const ds = { labels: ref.map(p => p.d), datasets: [
    { label: $("fSetupA").value, data: pA.map(p => ({ x: p.d, y: p.v })), borderColor: "#fff", borderWidth: 1.5, pointRadius: 0 },
    { label: $("fSetupB").value, data: pB.map(p => ({ x: p.d, y: p.v })), borderColor: "#E10600", borderWidth: 1.5, pointRadius: 0 }] };
  if (T.chart) T.chart.destroy();
  T.chart = new Chart($("velChart"), { type: "line", data: ds, options: { animation: false, parsing: false, plugins: { legend: { labels: { color: "#ccc" } },
    title: { display: true, text: "Velocidade média (km/h) ao longo da volta (m)", color: "#9a9aa6" } },
    scales: { x: { type: "linear", ticks: { color: "#777" }, grid: { color: "#1c1c22" } }, y: { ticks: { color: "#777" }, grid: { color: "#1c1c22" } } } } });
}

/* ---------- resultados (resultados.json do notebook) ---------- */
const R = { dados: null, chM: null, chI: null, carro: "ferrari" };
async function carregarResultados() {
  let url = "data/resultados.json", ex = false;
  if (!(await existe(url))) { url = "data/exemplo/resultados.json"; ex = true; }
  try { R.dados = await (await fetch(url, { cache: "no-store" })).json(); } catch { $("avisoRes").hidden = false; $("avisoRes").textContent = "Sem resultados: rode o notebook e copie resultados.json para landing/data/."; if (REG.j) resultadosDoRegistro(); return; }
  if (ex || R.dados.exemplo) { $("avisoRes").hidden = false;
    $("avisoRes").innerHTML = "⚠ EXEMPLO — estes números vêm de dados SINTÉTICOS só para mostrar o layout. Rode o notebook com as suas voltas e copie <code>resultados.json</code> para <code>landing/data/</code>."; }
  const r = R.dados, cm = r.comparacao_modelos || [];
  const best = cm.find(c => c.modelo === r.melhor_modelo);
  $("rMelhor").textContent = (r.melhor_modelo || "—").replace(/_/g, " ");
  $("rMae").textContent = best && best.teste ? best.teste.mae.toFixed(3) + " s" : "—";
  $("rRuido").textContent = isFinite(r.ruido_piloto_s) ? "±" + r.ruido_piloto_s.toFixed(3) + " s" : "—";
  const base = { color: "#9a9aa6" }, grid = { color: "#1c1c22" };
  R.chM = new Chart($("chModelos"), { type: "bar", data: { labels: cm.map(c => c.modelo.replace(/_/g, " ")), datasets: [
      { label: "CV (validação por blocos)", data: cm.map(c => c.cv?.mae), backgroundColor: "#555" },
      { label: "Teste", data: cm.map(c => c.teste?.mae ?? null), backgroundColor: cm.map(c => c.modelo === r.melhor_modelo ? "#E10600" : "#a33") }] },
    options: { plugins: { legend: { labels: base } }, scales: { x: { ticks: base, grid }, y: { ticks: base, grid } } } });
  const imp = (r.importancia || []).slice(0, 10);
  R.chI = new Chart($("chImp"), { type: "bar", data: { labels: imp.map(i => i.variavel), datasets: [{ label: "aumento do MAE (s)", data: imp.map(i => i.aumento_mae_s), backgroundColor: "#E10600" }] },
    options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { ticks: base, grid }, y: { ticks: base, grid } } } });
  const impAll = r.importancia || [];
  const zero = impAll.filter(i => !isFinite(i.aumento_mae_s) || i.aumento_mae_s <= 0.001).length;
  $("impNota").textContent = zero
    ? `Atenção: ${zero} ajuste(s) mostraram importância próxima de zero. Não é erro: significa que esse ajuste não melhora a previsão do tempo além do que os outros ajustes já explicam (sinal fraco ou correlação entre features). Apenas os ajustes com valor acima de zero ajudam o modelo a diferenciar voltas.`
    : "Todos os ajustes mostram alguma influência no tempo de volta.";
  $("rankCarro").onclick = e => { const b = e.target.closest("button"); if (!b) return; R.carro = b.dataset.c;
    [...$("rankCarro").children].forEach(x => x.classList.toggle("on", x === b)); ranking(); };
  ranking(); if (REG.j) resultadosDoRegistro(); else tabelaModelos();
}
const COR_EQ = { ferrari: "#E10600", alfaromeo: "#8B1E2D" };
function setoresPorSetup(carro) { // melhor setor de cada setup (voltas limpas do CSV)
  const out = {};
  for (const v of D.voltas) { if (v.carro !== carro) continue;
    const s = [num(v.r.setor1_ms), num(v.r.setor2_ms), num(v.r.setor3_ms)].map(x => x / 1000);
    const o = out[v.setup] ??= [Infinity, Infinity, Infinity]; s.forEach((x, k) => { if (x > 0 && x < o[k]) o[k] = x; }); }
  return out;
}
function ranking() {
  const L = (R.dados.ranking || []).filter(x => x.carro === R.carro).sort((a, b) => a.media_real - b.media_real);
  const sec = setoresPorSetup(R.carro), s0 = sec.S0, best = [0, 1, 2].map(k => Math.min(...Object.values(sec).map(o => o[k])));
  const cel = (st, k) => { const o = sec[st]; if (!o || !isFinite(o[k])) return '<span class="sec-c n">–</span>';
    const c = o[k] <= best[k] + 1e-9 ? "p" : (st === "S0" ? "n" : (s0 && o[k] < s0[k] ? "g" : "y"));
    return `<span class="sec-c ${c}" title="S${k + 1}: ${o[k].toFixed(3)} s">${o[k].toFixed(3)}</span>`; };
  const lider = L[0]?.media_real;
  $("ranking").innerHTML = `<div class="tower" style="--team:${COR_EQ[R.carro]}"><div class="tw head"><span>P</span><span></span><span>Setup</span><span class="ver">Leitura</span><span class="lap">Média</span><span class="gap">Gap</span><span>S1</span><span>S2</span><span>S3</span></div>` +
    L.map((x, i) => `<div class="tw"><span class="pos">${i + 1}</span><span class="tc"></span><span class="sid">${esc(x.setup_id)}${x.setup_id === "S10" ? '<span class="ia">IA</span>' : ""}</span>
      <span class="ver">${esc(x.veredito || (x.setup_id === "S0" ? "referência" : sgn(x.dif_vs_s0) + " vs S0"))}</span>
      <span class="lap">${fmt(x.media_real)}</span><span class="gap">${i ? "+" + (x.media_real - lider).toFixed(3) : "LÍDER"}</span>${[0, 1, 2].map(k => cel(x.setup_id, k)).join("")}</div>`).join("") + "</div>"
    || '<p class="muted">Sem ranking para este carro.</p>';
}
function tabelaModelos() { // formato antigo (resultados.json) — usado só se não houver registro
  const cm = (R.dados.comparacao_modelos || []).filter(c => c.teste || c.cv);
  const val = c => (c.teste ?? c.cv).mae, base = cm.find(c => c.modelo === "baseline_media");
  const cvm = c => (c.cv ?? c.teste).mae, ord = [...cm].sort((a, b) => cvm(a) - cvm(b));
  const cls = c => c.modelo === R.dados.melhor_modelo ? "p" : (base && val(c) < val(base) ? "g" : "y");
  $("tabModelos").innerHTML = `<div class="tower"><div class="tw head"><span>P</span><span>Modelo</span><span>MAE CV</span><span>MAE teste</span><span>R² teste</span></div>` +
    ord.map((c, i) => `<div class="tw"><span class="pos">${i + 1}</span><span class="sid">${esc(c.modelo.replace(/_/g, " "))}</span>
      <span class="sec-c ${c.cv ? "n" : "n"}">${c.cv ? c.cv.mae.toFixed(3) : "–"}</span><span class="sec-c ${cls(c)}">${c.teste ? c.teste.mae.toFixed(3) : "–"}</span>
      <span class="sec-c n">${c.teste ? c.teste.r2.toFixed(2) : "–"}</span></div>`).join("") +
    `</div><p class="mini">Ordem pelo MAE da validação cruzada (critério de escolha). <i class="sx p"></i>modelo escolhido <i class="sx g"></i>supera o baseline (média) <i class="sx y"></i>não supera o baseline</p>`;
}

/* ---------- registro de modelos (API /modelos → data/registro.json → data/exemplo/registro.json) ---------- */
const REG = { j: null, fonte: "", exemplo: false, alvo: "tempo_s" };
const ALVO_TXT = { tempo_s: "Tempo", vel_max_kmh: "Vel. máx", vel_media_kmh: "Vel. média" };
const apiBase = () => (C.API_URL || "").replace(/\/$/, "");
async function carregarRegistro() {
  try { const r = await fetch(apiBase() + "/modelos", { signal: AbortSignal.timeout(8000) });
    if (r.ok) { REG.j = await r.json(); REG.fonte = "API /modelos"; }
  } catch {}
  for (const [u, ex] of [["data/registro.json", false], ["data/exemplo/registro.json", true]]) {
    if (REG.j) break;
    if (await existe(u)) try { REG.j = await (await fetch(u, { cache: "no-store" })).json(); REG.fonte = u; REG.exemplo = ex || !!REG.j.exemplo; } catch {}
  }
  if (!REG.j) return false;
  const j = REG.j; j.padrao_por_alvo ??= Object.fromEntries(Object.entries(j.alvos || {}).map(([a, v]) => [a, v.padrao]));
  j.padrao_por_alvo.tempo_s = j.padrao || j.padrao_por_alvo.tempo_s;
  return true;
}
const nomeM = m => (m.algoritmo || m.id).replace(/_/g, " ");
const f3 = (x, d = 3) => x == null || !isFinite(x) ? "–" : (+x).toFixed(d);
function resultadosDoRegistro() {
  const j = REG.j, alvos = Object.keys(j.alvos || { tempo_s: 1 }).filter(a => j.modelos.some(m => m.alvo === a));
  $("regFonte").textContent = "· fonte: " + REG.fonte + (j.sintetico ? " · SINTÉTICO" : "");
  if (REG.exemplo || j.sintetico) { $("avisoRes").hidden = false;
    $("avisoRes").innerHTML = "⚠ EXEMPLO / TESTE — o registro de modelos foi treinado com dados SINTÉTICOS só para mostrar o layout. Rode a célula “Registro de modelos” do notebook com as suas voltas."; }
  $("regAlvo").innerHTML = alvos.map(a => `<button data-a="${a}" class="${a === REG.alvo ? "on" : ""}">${ALVO_TXT[a] || a}</button>`).join("");
  $("regAlvo").onclick = e => { const b = e.target.closest("button"); if (!b) return; REG.alvo = b.dataset.a;
    [...$("regAlvo").children].forEach(x => x.classList.toggle("on", x === b)); tabelaRegistro(); };
  const p = j.modelos.find(m => m.id === j.padrao_por_alvo.tempo_s);
  if (p) { $("rMelhor").textContent = nomeM(p); $("rMae").textContent = p.metricas_teste ? p.metricas_teste.mae.toFixed(3) + " s" : "—"; }
  if (isFinite(j.ruido_piloto_s) && j.ruido_piloto_s) $("rRuido").textContent = "±" + j.ruido_piloto_s.toFixed(3) + " s";
  tabelaRegistro();
}
function tabelaRegistro() {
  const j = REG.j, a = REG.alvo, un = (j.alvos?.[a]?.unidade) || (a === "tempo_s" ? "s" : "km/h");
  const L = j.modelos.filter(m => m.alvo === a).sort((x, y) => x.metricas_cv.mae - y.metricas_cv.mae);
  const base = L.find(m => m.algoritmo === "baseline_media"), pad = j.padrao_por_alvo[a];
  const cls = m => m.id === pad ? "p" : (base && m.metricas_cv.mae < base.metricas_cv.mae ? "g" : "y");
  $("tabModelos").innerHTML = `<div class="tower"><div class="tw head reg"><span>P</span><span>Modelo</span><span>MAE CV ± dp</span><span class="hide-m">RMSE CV</span><span>R² CV</span><span>Expl. CV (%)</span><span>MAE teste</span><span class="hide-m">R² teste</span></div>` +
    L.map((m, i) => { const c = m.metricas_cv, t = m.metricas_teste || {};
      const expl = c.r2 > 0 ? "g" : "n";
      return `<div class="tw reg"><span class="pos">${i + 1}</span><span class="sid">${esc(nomeM(m))}</span>
      <span class="sec-c ${cls(m)}">${f3(c.mae)}<small> ±${f3(c.mae_dp, 2)}</small></span><span class="sec-c n hide-m">${f3(c.rmse)}</span>
      <span class="sec-c n">${f3(c.r2, 2)}</span><span class="sec-c ${expl}">${(c.r2 * 100).toFixed(1)}%</span>
      <span class="sec-c n">${f3(t.mae)}</span><span class="sec-c n hide-m">${f3(t.r2, 2)}</span></div>`; }).join("") +
    `</div><p class="mini">Alvo: <b>${esc(j.alvos?.[a]?.descricao || a)}</b> (${un}). Ordem pelo MAE da validação cruzada agrupada (critério de escolha); ± = desvio-padrão entre dobras. <i class="sx p"></i>modelo padrão <i class="sx g"></i>supera o baseline (média) <i class="sx y"></i>não supera o baseline</p>
    <p class="mini">Expl. (%) = variância explicada pelo modelo (R² × 100). Não é “taxa de acerto” de classificação: o modelo prevê um tempo contínuo (segundos), não acerto/erro por volta.</p>`;
  if (R.chM) { R.chM.data.labels = L.map(nomeM); R.chM.data.datasets = [
      { label: "MAE CV", data: L.map(m => m.metricas_cv.mae), backgroundColor: L.map(m => m.id === pad ? "#a855f7" : "#555") },
      { label: "MAE teste", data: L.map(m => m.metricas_teste?.mae ?? null), backgroundColor: L.map(m => m.id === pad ? "#c084fc" : "#a33") }];
    $("chModelosT").textContent = `Comparação de modelos · ${ALVO_TXT[a] || a} (MAE, ${un} — menor é melhor)`; R.chM.update(); }
}
/* ---------- por que estes modelos (Resultados) - removido a pedido ---------- */
function ticker() {
  const it = [];
  for (const c of ["ferrari", "alfaromeo"]) { const v = D.voltas.filter(x => x.carro === c).sort((a, b) => a.tempo - b.tempo)[0];
    if (v) it.push(`<span><b>${c === "ferrari" ? "01" : "09"}</b>${NOME[c].toUpperCase()} · MELHOR VOLTA ${fmt(v.tempo)} · ${v.setup}</span>`); }
  let vmax = 0; for (const a of D.am.values()) for (const p of a) if (p.v > vmax) vmax = p.v;
  it.push(`<span><b>VMAX</b>${Math.round(vmax)} KM/H</span>`, `<span><b>LAPS</b>${D.voltas.length} VOLTAS LIMPAS</span>`,
    `<span><b>SETUPS</b>S0 → S10 · S10 = IA</span>`, `<span><b>TRACK</b>MÔNACO · 3,337 KM · 19 CURVAS</span>`);
  if (R.dados?.ruido_piloto_s) it.push(`<span><b>RUÍDO</b>±${R.dados.ruido_piloto_s.toFixed(3)} S</span>`);
  if (D.exemplo) it.push(`<span><b>!</b>DADOS DE EXEMPLO</span>`);
  $("ticker").innerHTML = (it.join("") + it.join("")); // duplicado p/ loop contínuo
}

/* ---------- vídeos ---------- */
function montarVideos() {
  const ph = (t, s) => `<div class="vid-ph"><div><div class="play"></div><b>${t}</b><p class="muted">${s}</p></div></div>`;
  const yt = C.YOUTUBE_ID ? `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(C.YOUTUBE_ID)}" title="Vídeo do projeto" allowfullscreen loading="lazy"></iframe>` : ph("Vídeo principal", "Defina YOUTUBE_ID em js/config.js");
  const li = C.LINKEDIN_EMBED ? `<iframe src="${esc(C.LINKEDIN_EMBED)}" title="Post no LinkedIn" loading="lazy"></iframe>` : ph("Post LinkedIn", "Defina LINKEDIN_EMBED em js/config.js");
  const mp = C.MP4 ? `<video src="${esc(C.MP4)}" controls muted playsinline preload="metadata"></video>` : ph("Volta onboard", "Coloque um .mp4 em videos/ e defina MP4");
  $("vids").innerHTML = `<div class="card vid">${yt}</div><div style="display:grid;gap:18px"><div class="card vid">${li}</div><div class="card vid">${mp}</div></div>`;
}

/* ---------- simulador (vários modelos) ---------- */
const SIM = { carro: "ferrari", v: { ...S0 }, ok: false, sel: new Set(), ch: null };
function montarSim() {
  $("sliders").innerHTML = AJ.map(([k, r, mi, ma, st]) => `<div class="sl"><label for="sl_${k}">${r}<b id="v_${k}"></b></label>
    <input type="range" id="sl_${k}" min="${mi}" max="${ma}" step="${st}"></div>`).join("");
  const sync = () => AJ.forEach(([k]) => { $("sl_" + k).value = SIM.v[k]; const b = $("v_" + k); b.textContent = SIM.v[k]; b.classList.toggle("mud", SIM.v[k] !== S0[k]); });
  AJ.forEach(([k]) => $("sl_" + k).oninput = e => { SIM.v[k] = +e.target.value; sync(); });
  $("btnS0").onclick = () => { SIM.v = { ...S0 }; sync(); };
  $("btnS10").onclick = () => { SIM.v = { ...S10 }; sync(); };
  $("simCarro").onclick = e => { const b = e.target.closest("button"); if (!b) return; SIM.carro = b.dataset.c; [...$("simCarro").children].forEach(x => x.classList.toggle("on", x === b)); };
  $("simForm").onsubmit = prever; sync();
  fetch(apiBase() + "/health", { signal: AbortSignal.timeout(60000) }).then(r => r.json()).then(j => { SIM.ok = true;
    $("apiStatus").innerHTML = `● API online · padrão <b>${esc(j.modelo_padrao || j.modelo)}</b> · ${j.n_modelos ?? 1} modelo(s)${j.sintetico ? ' · <span style="color:var(--warn)">MODELOS DE TESTE (sintéticos)</span>' : ""}`; })
    .catch(() => $("apiStatus").innerHTML = `<span style="color:#ff8a80">● API indisponível</span> em <code>${esc(apiBase() || "(API_URL vazia)")}</code>. Configure <code>js/config.js</code>. No Render grátis a 1ª chamada pode levar ~1 min.`);
}
function montarSeletor() {
  const tempo = REG.j ? REG.j.modelos.filter(m => m.alvo === "tempo_s").sort((a, b) => a.metricas_cv.mae - b.metricas_cv.mae) : [];
  if (!tempo.length) { $("simModelos").innerHTML = '<span class="muted mini">Sem registro de modelos: o simulador usa só o modelo padrão da API.</span>'; return; }
  const pad = REG.j.padrao_por_alvo.tempo_s; SIM.sel = new Set([pad]);
  const draw = () => { $("simModelos").innerHTML = tempo.map(m => `<label class="chip ${SIM.sel.has(m.id) ? "on" : ""}"><input type="checkbox" value="${esc(m.id)}" ${SIM.sel.has(m.id) ? "checked" : ""}>${esc(nomeM(m))}${m.id === pad ? '<span class="pd">★</span>' : ""}</label>`).join(""); };
  $("simModelos").onchange = e => { const v = e.target.value; e.target.checked ? SIM.sel.add(v) : SIM.sel.delete(v); if (!SIM.sel.size) SIM.sel.add(pad); draw(); };
  $("mTodos").onclick = () => { SIM.sel = new Set(tempo.map(m => m.id)); draw(); };
  $("mPadrao").onclick = () => { SIM.sel = new Set([pad]); draw(); };
  draw();
}
async function prever(e) {
  e.preventDefault();
  $("simTempo").textContent = "…"; $("simAviso").innerHTML = ""; $("simVel").textContent = "";
  try {
    const body = { carro: SIM.carro, setup: SIM.v }; if (SIM.sel.size) body.modelos = [...SIM.sel];
    const r = await fetch(apiBase() + "/prever", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
    const j = await r.json(); if (!r.ok) throw new Error(typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail || r.status));
    $("simTempo").textContent = j.tempo_formatado;
    $("simTitulo").textContent = "Tempo previsto · padrão: " + (j.modelo || "").replace(/_/g, " ");
    $("simDif").innerHTML = `${NOME[j.carro]} · ${sgn(j.dif_vs_S0_s)} vs S0 · <b>${esc(j.leitura)}</b>${j.ruido_piloto_s ? ` (ruído ±${j.ruido_piloto_s.toFixed(3)} s)` : ""}`;
    if (j.velocidade_max_prevista_kmh != null) $("simVel").innerHTML = `VEL. MÁX prevista <b>${j.velocidade_max_prevista_kmh.toFixed(1)} km/h</b>` + (j.velocidade_media_prevista_kmh != null ? ` · VEL. MÉDIA <b>${j.velocidade_media_prevista_kmh.toFixed(1)} km/h</b>` : "");
    let av = "";
    if (j.extrapolacao?.length) av += `<div class="alerta">⚠ Fora da faixa de treino: ${j.extrapolacao.map(x => esc(x.ajuste)).join(", ")}. A previsão é só uma referência.</div>`;
    if (j.sintetico) av += `<div class="alerta">Modelos de TESTE treinados com dados sintéticos — não são o resultado do estudo.</div>`;
    $("simAviso").innerHTML = av;
    comparar(j.resultados || []);
  } catch (err) {
    $("simTempo").textContent = "–:––.–––";
    $("simAviso").innerHTML = `<div class="alerta err">API indisponível ou erro: ${esc(err.message || err)}. Verifique API_URL em js/config.js.</div>`;
  }
}
function comparar(L) {
  if (!L.length) { $("simComp").hidden = true; return; }
  $("simComp").hidden = false; $("simComp").classList.add("in");
  const meta = id => REG.j?.modelos.find(m => m.id === id) || {};
  const cor = x => x.padrao ? "#a855f7" : (x.dif_vs_S0_s < 0 ? "#22c55e" : "#facc15");
  const base = { color: "#9a9aa6" }, grid = { color: "#1c1c22" };
  const data = { labels: L.map(x => (x.algoritmo || x.id).replace(/_/g, " ")), datasets: [
    { type: "bar", label: "faixa ± MAE (CV)", data: L.map(x => x.mae_cv_s != null ? [x.tempo_previsto_s - x.mae_cv_s, x.tempo_previsto_s + x.mae_cv_s] : null),
      backgroundColor: L.map(x => cor(x) + "40"), borderColor: L.map(cor), borderWidth: 1, borderSkipped: false, barPercentage: .6 },
    { type: "line", label: "tempo previsto", data: L.map(x => x.tempo_previsto_s), showLine: false, pointStyle: "rectRot", pointRadius: 8,
      pointBackgroundColor: L.map(cor), pointBorderColor: "#fff" }] };
  const lo = Math.min(...L.map(x => x.tempo_previsto_s - (x.mae_cv_s || 0))), hi = Math.max(...L.map(x => x.tempo_previsto_s + (x.mae_cv_s || 0))), pad = Math.max(.15, (hi - lo) * .15);
  const opt = { responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { labels: base }, tooltip: { callbacks: { label: c => c.datasetIndex ? `previsto ${fmt(c.raw)} (${c.raw.toFixed(3)} s)` : `± MAE: ${c.raw[0].toFixed(3)} – ${c.raw[1].toFixed(3)} s` } } },
    scales: { x: { ticks: base, grid }, y: { beginAtZero: false, min: lo - pad, max: hi + pad, ticks: { ...base, callback: v => fmt(v) }, grid, title: { display: true, text: "tempo de volta previsto", color: "#9a9aa6" } } } };
  if (SIM.ch) SIM.ch.destroy();
  SIM.ch = new Chart($("chSim"), { data, options: opt });
  $("simCards").innerHTML = L.map(x => { const m = meta(x.id), c = m.metricas_cv || {}, t = m.metricas_teste || {}, hp = m.hiperparametros || {};
    const dc = Math.abs(x.dif_vs_S0_s) < 5e-4 ? "n" : (x.dif_vs_S0_s < 0 ? "g" : "y");
    return `<div class="mcard ${x.padrao ? "p" : ""}"><h5>${esc((x.algoritmo || x.id).replace(/_/g, " "))}${x.padrao ? "<small>PADRÃO</small>" : ""}</h5>
      <span class="lat">${x.latencia_ms} ms</span><span class="t">${esc(x.tempo_formatado)}</span>
      <span class="d ${dc}">${sgn(x.dif_vs_S0_s)} vs S0</span>
      ${x.velocidade_max_prevista_kmh != null ? `<div class="mono mini">vel. máx ${x.velocidade_max_prevista_kmh.toFixed(1)} km/h (${x.velocidade_max_dif_vs_S0_kmh >= 0 ? "+" : ""}${x.velocidade_max_dif_vs_S0_kmh} vs S0)${x.velocidade_media_prevista_kmh != null ? ` · média ${x.velocidade_media_prevista_kmh.toFixed(1)}` : ""}</div>` : ""}
      <table><tr><th></th><th>MAE</th><th>RMSE</th><th>R²</th></tr>
      <tr><td>CV</td><td>${f3(c.mae)}${c.mae_dp != null ? "±" + f3(c.mae_dp, 2) : ""}</td><td>${f3(c.rmse)}</td><td>${f3(c.r2, 2)}</td></tr>
      <tr><td>teste</td><td>${f3(t.mae)}</td><td>${f3(t.rmse)}</td><td>${f3(t.r2, 2)}</td></tr></table>
      <details><summary>hiperparâmetros</summary>${Object.keys(hp).length ? `<dl>${Object.entries(hp).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(typeof v === "number" ? +v.toPrecision(4) : v)}</dd>`).join("")}</dl>` : "<p>sem hiperparâmetros (modelo de referência)</p>"}
      ${x.velocidade_max_modelo ? `<p class="mini">velocidade por: ${esc(x.velocidade_max_modelo)}</p>` : ""}</details></div>`; }).join("");
}

/* ---------- FAQ e equipe ---------- */
const FAQ = [
  ["Por que um jogo e não dados reais da F1?", "Dados reais de setup das equipes são secretos. No F1 23 controlamos tudo: mesmo piloto, pista, clima e combustível, mudando só o setup — é um experimento controlado."],
  ["Por que mudar um ajuste por vez (S1–S9)?", "Se dois ajustes mudam juntos não dá para saber qual causou a diferença. O S10 (IA) muda vários de propósito, e por isso é tratado como teste à parte."],
  ["Como vocês dividiram treino e teste?", "Por grupos (sessão/bloco), não por voltas aleatórias. Voltas seguidas do mesmo bloco são quase iguais; misturá-las entre treino e teste inflaria as métricas (vazamento)."],
  ["O que é o ruído do piloto?", "A diferença entre o S0 do início e o S0 do fim de cada sessão. Um setup só é considerado melhor se ganhar mais que esse ruído e o teste de Welch der p < 0,05."],
  ["Por que comparar com baselines?", "Um modelo só vale se superar a média (baseline) e o modelo que só conhece o carro. O placebo, com os setups embaralhados, mostra se o modelo aprendeu algo real."],
  ["Por que a telemetria não entra no modelo do simulador?", "Velocidade, freio etc. só existem depois que a volta acontece. Usá-los para prever o tempo é vazamento; eles servem para explicar (trilha B), não para prever (trilha A)."],
  ["Quais modelos foram testados?", "Lasso, Ridge, Random Forest, XGBoost e LightGBM, com busca de hiperparâmetros em validação cruzada por grupos e escolha pelo menor MAE."],
  ["Dá para confiar na previsão do S10?", "Com cautela: o S10 tem vários ajustes fora da faixa vista no treino (extrapolação). O simulador avisa quando isso acontece."],
  ["Onde a IA foi usada?", "Para dúvidas de sintaxe e para sugerir o S10, que virou hipótese de teste. Todas as decisões de modelagem foram do grupo e estão justificadas no notebook."],
  ["Como o deploy funciona?", "A página é estática (Vercel). O simulador chama uma API FastAPI que carrega o modelo treinado no notebook (.joblib) e devolve o tempo previsto."]];
function montarFaqEquipe() {
  $("faq").innerHTML = FAQ.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join("");
  $("team").innerHTML = (C.EQUIPE || []).map(([n, p, u]) => {
    const tag = u ? "a" : "div";
    const extra = u ? ` href="${esc(u)}" target="_blank" rel="noopener" aria-label="${esc(n)} no LinkedIn"` : "";
    return `<${tag} class="card member"${extra}><div class="av">${esc(n.split(" ").map(s => s[0]).slice(0, 2).join(""))}</div><h3>${esc(n)}</h3><p class="muted">${esc(p)}</p></${tag}>`;
  }).join("");
  if (C.GITHUB) $("ghLink").href = C.GITHUB; else $("ghLink").style.display = "none";
  if (C.DASHBOARD) $("linkDash").href = C.DASHBOARD; else $("linkDash").style.display = "none";
}

/* ---------- modal telemetria carro (cards Ferrari / Alfa Romeo) ---------- */
const M = { team: "ferrari", chartV: null, chartD: null };

function abrirTelemetriaCarro(team) {
  M.team = team;
  const el = $("modalCarro");
  if (!el) return;
  el.hidden = false;
  el.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  montarControlesModal();
  renderModal();
}

function fecharTelemetriaCarro() {
  const el = $("modalCarro");
  if (!el) return;
  el.hidden = true;
  el.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if (M.chartV) { M.chartV.destroy(); M.chartV = null; }
  if (M.chartD) { M.chartD.destroy(); M.chartD = null; }
}

function montarControlesModal() {
  const ss = [...new Set(D.voltas.map(v => v.setup))].sort((a, b) => +a.slice(1) - +b.slice(1));
  const carSel = $("modalCarroSelect");
  carSel.innerHTML = `<option value="ferrari">Ferrari</option><option value="alfaromeo">Alfa Romeo</option>`;
  carSel.value = M.team;
  opcoes($("modalSetupA"), ss, "S0");
  opcoes($("modalSetupB"), ss, ss.includes("S10") ? "S10" : (ss[1] || "S0"));
}

function lapsDe(team, setup, n) {
  return D.voltas.filter(v => v.setup === setup && v.carro === team).sort((a, b) => a.tempo - b.tempo).slice(0, n);
}
function perfilVoltas(voltas) {
  const acc = new Map(); const BIN = 10;
  for (const v of voltas) { const arr = D.am.get(v.k); if (!arr) continue;
    for (const p of arr) { const b = Math.floor(p.d / BIN); let o = acc.get(b); if (!o) acc.set(b, o = { v: [], t: [], x: [], z: [] });
      o.v.push(p.v); o.t.push(p.t); o.x.push(p.x); o.z.push(p.z); } }
  return [...acc.entries()].sort((a, b) => a[0] - b[0]).map(([b, o]) => ({ d: b * BIN, v: mean(o.v), t: mean(o.t), x: median(o.x), z: median(o.z) }));
}
function frenagensVoltas(voltas) {
  const pts = [];
  for (const v of voltas) { const arr = D.am.get(v.k); if (!arr) continue;
    for (let i = 1; i < arr.length; i++) if (arr[i - 1].b < 0.1 && arr[i].b >= 0.3) pts.push(arr[i]); }
  return pts;
}

function renderModal() {
  if (!D.carregado) {
    $("modalKpis").innerHTML = '<p class="muted">Carregando telemetria…</p>';
    $("modalInsights").innerHTML = ""; $("modalLegenda").innerHTML = "";
    const cv = $("modalMapa"), g = cv.getContext("2d"); g.clearRect(0, 0, cv.width, cv.height);
    return;
  }
  const team = $("modalCarroSelect").value || M.team;
  M.team = team;
  const PT = { ferrari: "Ferrari", alfaromeo: "Alfa Romeo" };
  const COR = { ferrari: "#E10600", alfaromeo: "#8B1E2D" };
  $("modalNome").textContent = PT[team];
  $("modalNome").style.color = COR[team];
  $("modalSub").textContent = team === "ferrari" ? "Equipe 01 · Mônaco · Sessões 1–2 (e 5 para S10)" : "Equipe 09 · Mônaco · Sessões 3–4 (e 6 para S10)";
  const n = +$("modalTop").value;
  const A = lapsDe(team, $("modalSetupA").value, n), B = lapsDe(team, $("modalSetupB").value, n);
  $("modalKpis").innerHTML = `
    <div class="modal-kpi"><span>Volta mais rápida A</span><b id="mkA">—</b></div>
    <div class="modal-kpi"><span>Volta mais rápida B</span><b id="mkB">—</b></div>
    <div class="modal-kpi"><span>Diferença média B − A</span><b id="mkD">—</b></div>
    <div class="modal-kpi"><span>Pontos de frenagem (A / B)</span><b id="mkF">—</b></div>`;
  const kpi = (id, l) => $(id).textContent = l.length ? fmt(l[0].tempo) : "—";
  kpi("mkA", A); kpi("mkB", B);
  $("mkD").textContent = A.length && B.length ? sgn(mean(B.map(v => v.tempo)) - mean(A.map(v => v.tempo))) : "—";
  const fA = frenagensVoltas(A), fB = frenagensVoltas(B);
  $("mkF").textContent = `${fA.length} / ${fB.length}`;
  desenharMapaModal();
  chartVelModal();
  chartDeltaModal();
  renderSetupComparacao();
  renderInsightsModal();
}

function desenharMapaModal() {
  const cv = $("modalMapa"), g = cv.getContext("2d"), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const team = $("modalCarroSelect").value; const setupA = $("modalSetupA").value; const setupB = $("modalSetupB").value; const n = +$("modalTop").value;
  const A = lapsDe(team, setupA, n), B = lapsDe(team, setupB, n);
  const pA = perfilVoltas(A), pB = perfilVoltas(B);
  const ref = pA.length ? pA : pB;
  if (!ref.length) { g.fillStyle = "#888"; g.font = "20px Titillium Web"; g.fillText("Sem amostras para este filtro.", 30, 50); return; }
  const xs = ref.map(p => p.x).filter(isFinite), zs = ref.map(p => p.z).filter(isFinite);
  const mx = Math.min(...xs), Mx = Math.max(...xs), mz = Math.min(...zs), Mz = Math.max(...zs);
  const s = Math.min((W - 60) / (Mx - mx), (H - 60) / (Mz - mz)), ox = (W - (Mx - mx) * s) / 2, oz = (H - (Mz - mz) * s) / 2;
  const P = p => [ox + (p.x - mx) * s, oz + (p.z - mz) * s];
  g.lineCap = "round"; g.lineJoin = "round";
  g.strokeStyle = "#1f1f25"; g.lineWidth = 22; g.beginPath(); ref.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  const p = pA; const vals = p.map(x => x.v); const lo = Math.min(...vals), hi = Math.max(...vals);
  g.lineWidth = 7;
  for (let i = 1; i < p.length; i++) { const t = (p[i].v - lo) / (hi - lo || 1);
    const [x0, y0] = P(p[i - 1]), [x1, y1] = P(p[i]); if (Math.hypot(x1 - x0, y1 - y0) > 40) continue;
    g.strokeStyle = `hsl(${120 * t},90%,55%)`; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  const fB = frenagensVoltas(B);
  g.fillStyle = "#E10600"; fB.forEach(p => { const [x, y] = P(p); g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); });
  const [sx, sy] = P(ref[0]); g.fillStyle = "#fff"; g.fillRect(sx - 3, sy - 12, 6, 24);
  $("modalLegenda").innerHTML = `<span style="color:#fff">● ${esc(setupA)} velocidade</span><span style="color:#E10600">● ${esc(setupB)} frenagens</span><span style="margin-left:auto;color:var(--mut);font-size:.78rem">${A.length} voltas ${esc(setupA)} · ${B.length} voltas ${esc(setupB)}</span>`;
}

function chartVelModal() {
  const cv = $("modalVelChart"), gx = cv.getContext("2d"); if (M.chartV) M.chartV.destroy();
  const team = $("modalCarroSelect").value; const setupA = $("modalSetupA").value; const setupB = $("modalSetupB").value; const n = +$("modalTop").value;
  const A = lapsDe(team, setupA, n), B = lapsDe(team, setupB, n);
  const pA = perfilVoltas(A), pB = perfilVoltas(B);
  M.chartV = new Chart(gx, { type: "line", data: {
    labels: pA.map(p => p.d),
    datasets: [
      { label: setupA, data: pA.map(p => ({ x: p.d, y: p.v })), borderColor: "#fff", borderWidth: 1.5, pointRadius: 0, fill: false },
      { label: setupB, data: pB.map(p => ({ x: p.d, y: p.v })), borderColor: "#E10600", borderWidth: 1.5, pointRadius: 0, fill: false }] },
    options: { animation: false, parsing: false, plugins: { legend: { labels: { color: "#ccc" } }, title: { display: true, text: "Velocidade média (km/h) por distância (m)", color: "#9a9aa6" } },
      scales: { x: { type: "linear", ticks: { color: "#777" }, grid: { color: "#1c1c22" } }, y: { ticks: { color: "#777" }, grid: { color: "#1c1c22" } } } } });
}
function chartDeltaModal() {
  const cv = $("modalDeltaChart"), gx = cv.getContext("2d"); if (M.chartD) M.chartD.destroy();
  const team = $("modalCarroSelect").value; const setupA = $("modalSetupA").value; const setupB = $("modalSetupB").value; const n = +$("modalTop").value;
  const A = lapsDe(team, setupA, n), B = lapsDe(team, setupB, n);
  const pA = perfilVoltas(A), pB = perfilVoltas(B);
  const mB = new Map(pB.map(p => [p.d, p.t]));
  let acc = 0;
  const data = pA.map(p => { const tb = mB.get(p.d); if (isFinite(tb)) acc += (tb - p.t); return { x: p.d, y: acc }; });
  M.chartD = new Chart(gx, { type: "line", data: {
    labels: pA.map(p => p.d),
    datasets: [{ label: `Δ ${setupB} − ${setupA} (s)`, data, borderColor: "#a855f7", borderWidth: 2, pointRadius: 0, fill: false }] },
    options: { animation: false, parsing: false, plugins: { legend: { labels: { color: "#ccc" } }, title: { display: true, text: "Diferença de tempo acumulado por setor (s)", color: "#9a9aa6" } },
      scales: { x: { type: "linear", ticks: { color: "#777" }, grid: { color: "#1c1c22" } }, y: { ticks: { color: "#777" }, grid: { color: "#1c1c22" } } } } });
}

function renderSetupComparacao() {
  const team = $("modalCarroSelect").value; const setup = $("modalSetupA").value;
  const sel = SETUPS.find(s => s[0] === setup);
  const changes = sel ? sel[3] : {};
  const rows = AJ.map(([k, label]) => {
    const s0 = S0[k], s1 = k in changes ? changes[k] : s0; const diff = s1 !== s0;
    return `<tr><td>${esc(label)}</td><td>${s0}</td><td class="${diff ? "dif" : ""}">${s1}${diff ? " ←" : ""}</td></tr>`;
  }).join("");
  $("modalSetupComparacao").innerHTML = `<table><tr><th>Ajuste</th><th>S0 (base)</th><th>${esc(setup)}</th></tr>${rows}</table>`;
}

function renderInsightsModal() {
  const team = $("modalCarroSelect").value; const setupA = $("modalSetupA").value; const setupB = $("modalSetupB").value; const n = +$("modalTop").value;
  const A = lapsDe(team, setupA, n), B = lapsDe(team, setupB, n);
  const meanA = mean(A.map(v => v.tempo)), meanB = mean(B.map(v => v.tempo));
  const ruido = (R.dados && isFinite(R.dados.ruido_piloto_s)) ? R.dados.ruido_piloto_s : 1.5;
  const items = [];
  if (isFinite(meanA) && isFinite(meanB)) {
    const gain = meanA - meanB;
    if (gain > ruido) items.push({ c: "g", t: `${setupB} é <b>${sgn(gain)}</b> mais rápido que ${setupA} em média — ultrapassa o ruído do piloto (±${ruido.toFixed(3)} s).` });
    else if (gain < -ruido) items.push({ c: "r", t: `${setupB} é <b>${sgn(-gain)}</b> mais lento que ${setupA} em média.` });
    else items.push({ c: "p", t: `Diferença entre ${setupA} e ${setupB} fica dentro do ruído do piloto (±${ruido.toFixed(3)} s).` });
  }
  const bestA = A[0], bestB = B[0];
  if (bestA && bestB) { const g2 = bestA.tempo - bestB.tempo;
    items.push({ c: g2 > 0 ? "g" : (g2 < 0 ? "r" : "p"), t: `Melhor volta: ${setupB} ${fmt(bestB.tempo)} vs ${setupA} ${fmt(bestA.tempo)} — ${g2 > 0 ? "ganha" : g2 < 0 ? "perde" : "empata"} ${sgn(Math.abs(g2))}.` });
  }
  items.push({ c: "p", t: `${A.length} voltas ${setupA} e ${B.length} voltas ${setupB} analisadas (${PT(team)}).` });
  $("modalInsights").innerHTML = items.map(it => `<div class="insight"><span class="ico ${it.c}">${it.c === "g" ? "✔" : it.c === "r" ? "✖" : "◆"}</span><p>${it.t}</p></div>`).join("");
}
function PT(t) { return { ferrari: "Ferrari", alfaromeo: "Alfa Romeo" }[t] || t; }

/* ---------- animações ---------- */
function reveal() {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));
  document.querySelectorAll("#menu a").forEach(a => a.onclick = () => document.body.classList.remove("menu-on"));
}
function pistaPadrao() { // traçado estilizado enquanto os CSVs carregam
  $("pistaHero").setAttribute("d", "M60 380 C120 300 180 330 230 260 S330 120 420 140 S560 60 640 120 S760 260 700 330 S560 300 520 360 S380 460 300 430 S120 470 60 380Z");
}

document.addEventListener("DOMContentLoaded", () => {
  pistaPadrao(); montarSetups();
  const vid = $("heroVideo");
  if (vid && matchMedia("(prefers-reduced-motion: reduce)").matches) { vid.pause(); vid.removeAttribute("autoplay"); }
  else if (vid) { vid.muted = true; vid.play().catch(() => {}); }
  montarVideos(); montarSim(); montarFaqEquipe(); reveal();
  const btnFechar = $("btnFecharCarro"); if (btnFechar) btnFechar.onclick = fecharTelemetriaCarro;
  const modal = $("modalCarro"); if (modal) modal.onclick = e => { if (e.target.id === "modalCarro") fecharTelemetriaCarro(); };
  document.addEventListener("keydown", e => { if (e.key === "Escape") fecharTelemetriaCarro(); });
  ["modalCarroSelect","modalSetupA","modalSetupB","modalTop"].forEach(id => { const el = $(id); if (el) el.onchange = renderModal; });
  document.querySelectorAll(".card-open").forEach(b => { b.onclick = e => { e.preventDefault(); abrirTelemetriaCarro(b.dataset.team); }; });
  carregarRegistro().then(() => { montarSeletor(); carregarResultados(); }); carregarDados();
});
