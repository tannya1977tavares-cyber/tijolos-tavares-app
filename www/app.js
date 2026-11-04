"use strict";
/* Tijolos Tavares · pedidos, cargas, agenda, orçamentos, recibos e relatórios */

const SB_URL = "https://fgjgtpeptzflhuaklzuz.supabase.co";
const SB_KEY = "sb_publishable_r0gOq_JU2KeAYeFlU2mSTA_znMnud8n";
const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const REPO = "tannya1977tavares-cyber/tijolos-tavares-app";

const NATIVO = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
function plugin(nome) {
  if (!NATIVO) return null;
  try {
    if (window.capacitorExports && window.capacitorExports.registerPlugin) return window.capacitorExports.registerPlugin(nome);
    if (window.Capacitor.registerPlugin) return window.Capacitor.registerPlugin(nome);
  } catch (e) {}
  return (window.Capacitor.Plugins || {})[nome] || null;
}
const Notif = plugin("LocalNotifications"), Camera = plugin("Camera"), FS = plugin("Filesystem"), Share = plugin("Share"), Agenda = plugin("AgendaCelular"), Atual = plugin("Atualizador");
Aparencia.iniciar("tijolos", ["--brick", "--brick-soft", "--on-brick"]);

/* ---------- dados fixos ---------- */
const LOGINS = { Bruno: "bruno@tijolostavares.app", Rafael: "rafael@tijolostavares.app", Wolney: "wolney@tijolostavares.app" };
const REG = { 1: "Anápolis", 2: "Goiânia e região", 3: "Brasília" };
const REG_CENTRO = { 1: { lat: -16.3281, lng: -48.9534 }, 2: { lat: -16.6869, lng: -49.2648 }, 3: { lat: -15.7939, lng: -47.8828 } };
const FRETE_PADRAO = { 1: [30, 50], 2: [40, 60], 3: [50, 75] };
const ORIGEM = REG_CENTRO[1];
const STATUS = ["Agendada", "Carregada", "Entregue"];
const PAGS = ["A receber", "Pago", "Fiado"];
const FPAGS = ["PIX", "Dinheiro", "Transferência", "Boleto", "Cartão"];
const CAD_PADRAO = {
  medidas: [["09x14x24", 84, 108], ["09x14x24 REQ", 84, 108], ["09x19x19", 84, 108], ["09x19x19 REQ", 84, 108], ["09x19x29", 84, 72], ["11,5x19x19", 65, 108], ["11,5x19x19 REQ", 65, 108], ["11,5x19x29", 65, 72], ["11,5x19x29 REQ", 65, 72], ["14x19x19", 54, 108], ["14x19x29", 54, 72], ["19x19x19", 39, 108], ["19x19x29", 39, 72], ["4,3x8x18 maciço", 175, 115], ["5x9x19 maciço", 151, 115]].map(([nome, pf, fiadas]) => ({ nome, pf, fiadas })),
  cidades: [["Anápolis", 1, -16.3281, -48.9534], ["Goiânia", 2, -16.6869, -49.2648], ["Aparecida de Goiânia", 2, -16.8198, -49.2469], ["Trindade", 2, -16.6517, -49.4927], ["Senador Canedo", 2, -16.7084, -49.0914], ["Goianira", 2, -16.4947, -49.4262], ["Brasília", 3, -15.7939, -47.8828]].map(([nome, r, lat, lng]) => ({ nome, r, lat, lng, f108: FRETE_PADRAO[r][0], f72: FRETE_PADRAO[r][1] })),
  fornecedores: [{ id: "anapolina", nome: "Cerâmica Anapolina", origem: "Cerâmica Anapolina, Anápolis - GO" }, { id: "outra", nome: "Outra cerâmica", origem: "Anápolis - GO" }]
};

/* ---------- utilidades ---------- */
const brl = v => (+v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = v => (+v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n1 = v => (+v || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const r2 = v => Math.round(v * 100) / 100;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const parseNum = s => { const t = String(s).trim(); if (!t) return NaN; const v = parseFloat(/,/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t); return isFinite(v) ? v : NaN; };
const parseMil = s => { const v = parseFloat(String(s).replace(",", ".")); return isFinite(v) ? v : NaN; };
const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const pd = s => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
let HOJE = ymd(new Date());
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const diaLabel = s => pd(s).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
const diaCurto = s => pd(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const diaLongo = s => pd(s).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
const dataBR = s => String(s).slice(0, 10).split("-").reverse().join("/");
const mesLabel = k => cap(pd(k + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
const addMes = (k, n) => { const d = pd(k + "-01"); d.setMonth(d.getMonth() + n); return ymd(d).slice(0, 7); };
const addDias = (s, n) => { const d = pd(s); d.setDate(d.getDate() + n); return ymd(d); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cliente";
const copia = o => JSON.parse(JSON.stringify(o));
const ler = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? padrao; } catch (e) { return padrao; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* ---------- estado ---------- */
function localNovo() { return { tab: "pedido", rascunho: { ceramica: "anapolina", entregas: [] }, form: { cliente: "", cidade: "Goiânia", medida: "09x19x19", mil: "", preco: "" }, pedido: { step: 1, dia: null }, calPedido: HOJE.slice(0, 7), calAgenda: HOJE.slice(0, 7), diaAgenda: HOJE, mesResumo: HOJE.slice(0, 7), calc: [], ultima: null }; }
let L = Object.assign(localNovo(), ler("tt-local", {}));
if (!L.pedido || L.pedido.step > 3) L.pedido = { step: 1, dia: null };
if (!L.rascunho || !Array.isArray(L.rascunho.entregas)) L.rascunho = { ceramica: "anapolina", entregas: [] };
const salvarLocal = () => gravar("tt-local", L);
function vazio() { return { perfil: null, cargas: [], marcas: [], admin: {}, clientes: [], cfg: { minimos: {}, custos: null, empresa: {}, cadastro: null }, hist: [], orcs: [], rels: [], fin: { movs: [], ajud: [], pessoas: [], cats: [], ent: {} } }; }
let D = vazio();
let erroRede = "", novaVersao = null, atualizando = "";
const ADM = () => !!(D.perfil && D.perfil.admin);
const acharCli = n => D.clientes.find(c => norm(c.nome) === norm(n));
const acharCarga = id => D.cargas.find(c => c.id === id);

/* ---------- cadastros ---------- */
const CAD = () => (D.cfg.cadastro && D.cfg.cadastro.medidas ? D.cfg.cadastro : CAD_PADRAO);
const med = m => CAD().medidas.find(x => x.nome === m) || { nome: m, pf: 84, fiadas: /x29/.test(m) ? 72 : 108 };
const cid = n => CAD().cidades.find(x => x.nome === n) || { nome: n, r: 2, f108: FRETE_PADRAO[2][0], f72: FRETE_PADRAO[2][1] };
const forn = id => CAD().fornecedores.find(x => x.id === id) || { id, nome: id === "anapolina" ? "Cerâmica Anapolina" : "Outra cerâmica", origem: "Anápolis - GO" };
const coords = n => { const c = cid(n); return c.lat != null ? c : REG_CENTRO[c.r] || REG_CENTRO[2]; };
function custoAtual(fid, m) {
  const C = D.cfg.custos; if (!C) return null;
  const p = (C[fid] || {})[m]; if (p != null) return { v: p, f: forn(fid).nome };
  const r = (C.regiao || {})[m]; return r != null ? { v: r, f: "tabela da região" } : null;
}
function minimo(m, r) { const x = D.cfg.minimos[m]; return x && x[r - 1] != null ? x[r - 1] : null; }
const freteMil = e => med(e.medida).fiadas >= 100 ? cid(e.cidade).f108 : cid(e.cidade).f72;

function calcEntrega(e, c, i) {
  let cm = 0;
  if (ADM()) {
    const snap = c.id && D.admin[c.id] && D.admin[c.id].custos;
    if (snap && snap[i] != null && +snap[i] > 0) cm = +snap[i]; else { const k = custoAtual(c.ceramica, e.medida); cm = k ? k.v : 0; }
  }
  const m = med(e.medida), min = minimo(e.medida, cid(e.cidade).r), fiadas = Math.ceil(e.mil * 1000 / m.pf);
  return { cm, min, fiadas, occ: fiadas / m.fiadas, custo: cm * e.mil, venda: e.preco * e.mil, abaixo: min != null && e.preco < min, fm: e.freteMil != null ? e.freteMil : freteMil(e) };
}
function grupos(c) { const g = []; c.entregas.forEach((e, i) => { const k = e.cliente || "Sem nome"; let x = g.find(y => y.nome === k); if (!x) { x = { nome: k, idx: [] }; g.push(x); } x.idx.push(i); }); return g; }
/* frete de um cliente: carga fechada não paga; carga que não fecha paga à parte (se marcado) */
function freteGrupo(c, g) {
  let occ = 0, valor = 0, tijolo = 0, mil = 0; const taxas = new Set();
  g.idx.forEach(i => { const e = c.entregas[i], k = calcEntrega(e, c, i); occ += k.occ; valor += e.mil * k.fm; tijolo += k.venda; mil += e.mil; taxas.add(k.fm); });
  const fechada = occ >= 0.999, on = c.entregas[g.idx[0]].freteOn !== false;
  const cobrado = c.salva ? g.idx.reduce((s, i) => s + (+c.entregas[i].frete || 0), 0) : (!fechada && on ? valor : 0);
  return { occ, valor: r2(valor), fechada, on, cobrado: r2(cobrado), tijolo, mil, taxas: [...taxas], total: r2(tijolo + cobrado) };
}
function resumo(c) {
  const r = { mil: 0, fiadas: 0, occ: 0, custo: 0, venda: 0, abaixo: 0, frete: 0 };
  c.entregas.forEach((e, i) => { const k = calcEntrega(e, c, i); r.mil += e.mil; r.fiadas += k.fiadas; r.occ += k.occ; r.custo += k.custo; r.venda += k.venda; if (k.abaixo) r.abaixo++; });
  grupos(c).forEach(g => { r.frete += freteGrupo(c, g).cobrado; });
  r.receita = r.venda + r.frete; r.lucro = r.receita - r.custo; r.pct = Math.round(r.occ * 100); return r;
}
/* gastos da viagem que o Financeiro ligou a esta carga (só o administrador vê) */
function gastosViagem(c) {
  if (!ADM()) return 0;
  const cat = id => (D.fin.cats.find(x => x.id === id) || {}).nome || "";
  const g = D.fin.movs.filter(m => m.carga_id === c.id && m.tipo === "saida" && !m.ignorado && !/^compra de tijolo/i.test(cat(m.categoria_id))).reduce((s, m) => s + +m.valor, 0);
  const a = D.fin.ajud.filter(x => x.carga_id === c.id).reduce((s, x) => s + +x.valor, 0);
  return r2(g + a);
}
/* pagamento de cada entrega: o Financeiro sabe mais (Pix lido no banco); senão vale o que foi marcado aqui */
function pagDe(c, i) {
  const s = D.fin.ent[c.id + "|" + i];
  if (s) { if (["pix", "pix_manual", "dinheiro", "nao_cobrar"].includes(s.situacao)) return "Pago"; if (s.situacao === "prazo") return "Fiado"; }
  return ((D.admin[c.id] && D.admin[c.id].pags) || [])[i] || "A receber";
}

/* ---------- rota ---------- */
function dist(a, b) { const dx = (a.lng - b.lng) * Math.cos((a.lat + b.lat) * Math.PI / 360), dy = a.lat - b.lat; return Math.sqrt(dx * dx + dy * dy); }
function ordemCidades(lista) {
  const cs = [...new Set(lista)], out = []; let pos = ORIGEM;
  while (cs.length) { let bi = 0; cs.forEach((c, i) => { if (dist(pos, coords(c)) < dist(pos, coords(cs[bi]))) bi = i; }); const c = cs.splice(bi, 1)[0]; out.push(c); pos = coords(c); }
  return out;
}
const ordemRota = ents => ordemCidades(ents.map(e => e.cidade));
const uf = c => cid(c).r === 3 ? " - DF" : " - GO";
function mapsUrl(carga) {
  const o = ordemRota(carga.entregas); if (!o.length) return "#";
  let u = "https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=" + encodeURIComponent(forn(carga.ceramica).origem) + "&destination=" + encodeURIComponent(o[o.length - 1] + uf(o[o.length - 1]));
  if (o.length > 1) u += "&waypoints=" + encodeURIComponent(o.slice(0, -1).map(c => c + uf(c)).join("|"));
  return u;
}

/* ---------- banco ---------- */
async function carregar() {
  const de = addDias(HOJE, -150), ate = addDias(HOJE, 365);
  const q = [sb.from("cargas").select("*").order("data"), sb.rpc("agenda_marcas", { de, ate }), sb.from("clientes").select("*").order("nome"), sb.from("config").select("chave,dados"), sb.from("orcamentos").select("*").order("criado_em", { ascending: false }), sb.from("profiles").select("*").eq("id", D.perfil.id).single()];
  if (ADM()) q.push(sb.from("carga_admin").select("*"), sb.from("precos_hist").select("*").order("criado_em", { ascending: false }).limit(30), sb.from("relatorios").select("*").order("numero", { ascending: false }),
    sb.from("fin_movimentos").select("id,carga_id,tipo,valor,ignorado,categoria_id,quando,contraparte,texto,banco,origem").not("carga_id", "is", null), sb.from("fin_carga_ajudantes").select("*"), sb.from("fin_pessoas").select("id,nome"), sb.from("fin_categorias").select("id,nome"), sb.from("fin_entregas").select("*"));
  const r = await Promise.all(q);
  if (r.slice(0, 5).some(x => x.error)) { erroRede = "Sem conexão com o servidor. Mostrando o que já estava salvo."; return false; }
  erroRede = "";
  D.cargas = (r[0].data || []).map(c => ({ ...c, salva: true, data: String(c.data).slice(0, 10), entregas: c.entregas || [] }));
  D.marcas = (r[1].data || []).map(m => ({ ...m, data: String(m.data).slice(0, 10) }));
  D.clientes = r[2].data || [];
  const cfg = {}; (r[3].data || []).forEach(x => { cfg[x.chave] = x.dados; });
  D.cfg = { minimos: cfg.minimos || {}, custos: cfg.custos || null, empresa: cfg.empresa || {}, cadastro: cfg.cadastro || null };
  D.orcs = r[4].data || [];
  if (r[5].data) { D.perfil = r[5].data; Aparencia.aplicar(D.perfil.aparencia); }
  if (ADM()) {
    const ok = x => (x && !x.error ? x.data || [] : []);
    D.admin = {}; ok(r[6]).forEach(a => { D.admin[a.carga_id] = a; });
    D.hist = ok(r[7]); D.rels = ok(r[8]);
    D.fin = { movs: ok(r[9]), ajud: ok(r[10]), pessoas: ok(r[11]), cats: ok(r[12]), ent: {} };
    ok(r[13]).forEach(f => { D.fin.ent[f.carga_id + "|" + f.idx] = f; });
  }
  gravar("tt-cache", D);
  return true;
}
let timerRecarga = null;
function recarregarLogo() { clearTimeout(timerRecarga); timerRecarga = setTimeout(async () => { await carregar(); renderSeguro(); sincronizarCelular(); }, 500); }
let canal = null;
function ouvirMudancas() {
  if (canal) sb.removeChannel(canal);
  canal = sb.channel("tijolos");
  ["cargas", "carga_admin", "clientes", "config", "orcamentos", "relatorios", "fin_movimentos", "fin_entregas", "fin_carga_ajudantes", "profiles"].forEach(t => canal.on("postgres_changes", { event: "*", schema: "public", table: t }, recarregarLogo));
  canal.subscribe();
}
const avisoErro = (el, msg) => { const x = document.getElementById(el); if (x) x.textContent = msg; };

/* pagamento marcado aqui vai também pro Financeiro (e some o alerta de lá) */
async function marcarPagamento(c, idxs, v) {
  const a = D.admin[c.id] = D.admin[c.id] || { carga_id: c.id, custos: [], pags: [] };
  const pags = c.entregas.map((x, j) => (a.pags || [])[j] || "A receber");
  idxs.forEach(i => { pags[i] = v; }); a.pags = pags;
  await sb.from("carga_admin").update({ pags }).eq("carga_id", c.id);
  for (const i of idxs) {
    const k = c.id + "|" + i, s = D.fin.ent[k];
    if (v === "A receber") { if (s) { await sb.from("fin_entregas").delete().eq("carga_id", c.id).eq("idx", i); delete D.fin.ent[k]; } }
    else if (v === "Pago" && !(s && ["pix", "pix_manual", "dinheiro", "nao_cobrar"].includes(s.situacao))) {
      const row = { carga_id: c.id, idx: i, situacao: "pix_manual", pago_em: HOJE, vencimento: null, atualizado_em: new Date().toISOString() };
      await sb.from("fin_entregas").upsert(row); D.fin.ent[k] = row;
    } else if (v === "Fiado" && !(s && s.situacao === "prazo")) {
      const row = { carga_id: c.id, idx: i, situacao: "prazo", pago_em: null, vencimento: addDias(HOJE, 7), atualizado_em: new Date().toISOString() };
      await sb.from("fin_entregas").upsert(row); D.fin.ent[k] = row;
    }
  }
}

/* ---------- celular: calendário e lembretes ---------- */
async function pedirPermissoesCelular() {
  if (Notif) { try { const p = await Notif.checkPermissions(); if (p.display !== "granted") await Notif.requestPermissions(); } catch (e) {} }
  if (Agenda) { try { await Agenda.pedirPermissao(); } catch (e) {} }
}
async function sincronizarCelular() { await sincronizarAgenda(); await agendarLembretes(); }
async function agendaLiberada() { if (!Agenda) return false; try { return (await Agenda.temPermissao()).ok; } catch (e) { return false; } }
async function sincronizarAgenda() {
  if (!(await agendaLiberada())) return;
  const mapa = ler("tt-agenda", {}), vivos = new Set(D.cargas.map(c => c.id)), limite = addDias(HOJE, -30);
  for (const c of D.cargas) {
    if (c.data < limite) continue;
    const mil = c.entregas.reduce((s, e) => s + e.mil, 0);
    const titulo = (c.status === "Entregue" ? "Entregue: " : "Entrega: ") + ordemRota(c.entregas).join(" > ") + " (" + n1(mil) + " mil)";
    const desc = c.entregas.map(e => "- " + (e.cliente || "Sem nome") + " · " + e.cidade + " · " + e.medida + " · " + n1(e.mil) + " mil").join("\n") + "\nVendedor: " + c.vendedor + "\nSituação: " + c.status;
    const h = titulo + "|" + desc + "|" + c.data;
    if (mapa[c.id] && mapa[c.id].h === h) continue;
    try { const r = await Agenda.salvar({ eventoId: mapa[c.id] ? mapa[c.id].ev : "", titulo, descricao: desc, data: c.data }); mapa[c.id] = { ev: r.eventoId, h }; } catch (e) {}
  }
  for (const id of Object.keys(mapa)) if (!vivos.has(id)) { try { await Agenda.apagar({ eventoId: mapa[id].ev }); } catch (e) {} delete mapa[id]; }
  gravar("tt-agenda", mapa);
}
async function agendarLembretes() {
  if (!Notif) return;
  try {
    const p = await Notif.checkPermissions(); if (p.display !== "granted") return;
    const pend = await Notif.getPending();
    if (pend.notifications && pend.notifications.length) await Notif.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
    const porDia = {};
    D.cargas.filter(c => c.status !== "Entregue" && c.data >= HOJE).forEach(c => { (porDia[c.data] = porDia[c.data] || []).push(c); });
    const lista = [], agora = new Date();
    Object.keys(porDia).sort().slice(0, 40).forEach(d => {
      const cs = porDia[d], cids = ordemCidades(cs.flatMap(c => c.entregas.map(e => e.cidade))), mil = cs.reduce((s, c) => s + c.entregas.reduce((a, e) => a + e.mil, 0), 0);
      const corpo = cs.length + " carga(s): " + cids.join(", ") + " · " + n1(mil) + " milheiros", n = Number(d.replace(/-/g, "").slice(2));
      const manha = pd(d); manha.setHours(7, 0, 0, 0);
      const vespera = pd(d); vespera.setDate(vespera.getDate() - 1); vespera.setHours(18, 0, 0, 0);
      if (manha > agora) lista.push({ id: n * 10 + 1, title: "Entregas de hoje", body: corpo, schedule: { at: manha } });
      if (vespera > agora) lista.push({ id: n * 10 + 2, title: "Entregas de amanhã", body: corpo, schedule: { at: vespera } });
    });
    if (lista.length) await Notif.schedule({ notifications: lista });
  } catch (e) {}
}

/* ---------- atualização do app ---------- */
async function procurarVersao() {
  if (!NATIVO) return;
  try {
    const r = await fetch("https://api.github.com/repos/" + REPO + "/releases/latest", { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) return;
    const j = await r.json(), n = parseInt(String(j.tag_name || "").split(".").pop()), a = (j.assets || []).find(x => /\.apk$/.test(x.name));
    novaVersao = a && n > (window.VERSAO_APP || 0) ? { n, url: a.browser_download_url } : null;
  } catch (e) {}
}

/* ---------- desenho ---------- */
const main = document.getElementById("main");
let comp = null, confirmar = null, aviso = "", cadastrando = null, buscaCli = "", fotos = {}, renderPendente = false, editando = null, msgCfg = "";

function renderSeguro() {
  const a = document.activeElement;
  if (a && main.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) { renderPendente = true; return; }
  render();
}
main.addEventListener("focusout", () => { setTimeout(() => { if (renderPendente) { const a = document.activeElement; if (!(a && main.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName))) { renderPendente = false; render(); } } }, 50); });

function render() {
  const nav = document.getElementById("nav"), ub = document.getElementById("cfgbtn");
  if (!D.perfil) { nav.hidden = true; ub.hidden = true; main.innerHTML = vLogin(); return; }
  nav.hidden = false; ub.hidden = false; ub.setAttribute("aria-pressed", L.tab === "config");
  const tabs = [["pedido", "Pedido"], ["agenda", "Agenda"], ["clientes", "Clientes"], ["ferramentas", "Ferramentas"]];
  if (ADM()) tabs.push(["painel", "Painel"]);
  if (L.tab !== "config" && !tabs.some(t => t[0] === L.tab)) L.tab = "pedido";
  const abertas = D.cargas.filter(c => c.status !== "Entregue").length;
  document.getElementById("tabs").innerHTML = tabs.map(([k, l]) => '<button data-tab="' + k + '" aria-current="' + (k === L.tab ? "page" : "false") + '">' + l + (k === "agenda" && abertas ? '<span class="n">' + abertas + "</span>" : "") + "</button>").join("");
  const topo = (erroRede ? '<div class="banner" role="status">' + esc(erroRede) + "</div>" : "") +
    (novaVersao && L.tab !== "config" ? '<button class="banner novo" data-act="ir-config">Versão nova do app (1.0.' + novaVersao.n + "). Toque pra atualizar.</button>" : "");
  main.innerHTML = topo + ({ pedido: vPedido, agenda: vAgenda, clientes: vClientes, ferramentas: vFerramentas, painel: vPainel, config: vConfig })[L.tab]();
  if (L.tab === "pedido" && L.pedido.step === 1) updHint();
}
const opts = (list, sel) => list.map(v => '<option value="' + esc(v) + '"' + (v === sel ? " selected" : "") + ">" + esc(v) + "</option>").join("");
const optsObj = (list, sel) => list.map(([v, l]) => '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? " selected" : "") + ">" + esc(l) + "</option>").join("");
const corOcc = p => p > 100 ? "var(--danger)" : p >= 90 ? "var(--warn)" : "var(--ok)";
function barraCaminhao(r) {
  return '<div><div style="display:flex;justify-content:space-between;margin-bottom:6px" class="s"><span>Caminhão</span><strong style="color:' + corOcc(r.pct) + '">' + r.pct + '% ocupado</strong></div><div class="bar"><div style="width:' + Math.min(r.pct, 100) + "%;background:" + corOcc(r.pct) + '"></div></div></div>' +
    (r.pct > 100 ? '<div class="warnmsg" role="status">Essa carga está em ' + r.pct + "% do caminhão. Já passou do limite em " + (r.pct - 100) + "%. Dá pra agendar assim mesmo.</div>" : '<p class="hint">Ainda cabe ' + (100 - r.pct) + "% no caminhão.</p>");
}
function resumoHtml(r) {
  const base = '<div class="stats"><div class="stat"><div class="l">Milheiros</div><div class="v">' + n1(r.mil) + '</div></div><div class="stat"><div class="l">Fiadas</div><div class="v">' + r.fiadas + "</div></div>" +
    '<div class="stat"><div class="l">Tijolo</div><div class="v">' + brl(r.venda) + '</div></div><div class="stat"><div class="l">Frete à parte</div><div class="v">' + brl(r.frete) + "</div></div>";
  if (!ADM()) return base + "</div>" + barraCaminhao(r);
  return base + '<div class="stat"><div class="l">Custo</div><div class="v">' + brl(r.custo) + '</div></div><div class="stat"><div class="l">Lucro</div><div class="v ' + (r.lucro >= 0 ? "pos" : "neg") + '">' + brl(r.lucro) + "</div></div></div>" + barraCaminhao(r);
}
function rotaHtml(carga, link) {
  const o = ordemRota(carga.entregas); if (!o.length) return "";
  return '<div class="rota"><span class="p o">' + esc(forn(carga.ceramica).nome) + "</span>" + o.map(c => '<span class="a" aria-hidden="true">→</span><span class="p">' + esc(c) + "</span>").join("") + "</div>" +
    (link ? '<a class="btn small" href="' + mapsUrl(carga) + '" target="_blank" rel="noopener">Abrir rota no Google Maps</a>' : "");
}
function entregaRow(e, c, i, opt) {
  opt = opt || {}; const k = calcEntrega(e, c, i), pag = opt.pag ? pagDe(c, i) : null;
  return '<div class="row"><div style="min-width:0;flex:1"><div class="t">' + esc(e.cliente || "Sem nome") + " · " + esc(e.cidade) + '</div><div class="s">' + esc(e.medida) + " · " + n1(e.mil) + " mil · " + brl(e.preco) + "/mil · " + k.fiadas + " fiadas" + (+e.frete ? " · frete " + brl(e.frete) : "") + "</div>" +
    ((k.abaixo || pag) ? '<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">' + (k.abaixo ? '<span class="chip red">Abaixo do mínimo de ' + brl(k.min) + "</span>" : "") + (pag ? '<span class="chip ' + (pag === "Pago" ? "green" : pag === "Fiado" ? "red" : "amber") + '">' + esc(pag) + "</span>" : "") + "</div>" : "") +
    (opt.foto ? fotoHtml(c, i) : "") + "</div>" +
    (opt.rm ? '<button class="btn small" data-act="rm" data-i="' + i + '">Remover</button>' : "") + "</div>";
}
function freteLinha(c, g) {
  const f = freteGrupo(c, g);
  if (f.fechada && !f.cobrado) return '<span class="chip green">Fecha a carga: sem frete</span>';
  if (c.salva) return f.cobrado ? '<span class="chip amber">Frete à parte ' + brl2(f.cobrado) + "</span>" : '<span class="chip">Sem frete</span>';
  const taxa = f.taxas.length === 1 ? n1(f.mil) + " mil × " + brl2(f.taxas[0]) : "conforme cidade e medida";
  return f.on ? '<span class="chip amber">Frete à parte ' + brl2(f.valor) + " (" + taxa + ")</span>" : '<span class="chip">Sem cobrança de frete</span>';
}
function fotoHtml(c, i) {
  const e = c.entregas[i], k = c.id + "|" + i;
  let h = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">';
  if (e.foto) h += '<button class="btn small" data-act="ver-foto" data-k="' + esc(k) + '">' + (fotos[k] ? "Esconder foto" : "Ver foto da entrega") + "</button>";
  if (Camera) h += '<button class="btn small" data-act="tirar-foto" data-k="' + esc(k) + '">' + (e.foto ? "Trocar foto" : "Foto da entrega") + "</button>";
  h += "</div>" + '<p class="err" id="foto-' + esc(k) + '"></p>';
  if (fotos[k]) h += '<img class="foto" src="' + esc(fotos[k]) + '" alt="Foto da entrega de ' + esc(e.cliente || "") + '">';
  return h;
}

/* ---------- login ---------- */
function vLogin() {
  return '<div style="display:flex;justify-content:center"><img src="icon.png" alt="" width="96" height="96"></div><h1 style="text-align:center">Entrar</h1>' +
    '<section class="card"><div class="field"><label for="lg-nome">Usuário</label><select id="lg-nome">' + opts(Object.keys(LOGINS), ler("tt-ultimo", "Bruno")) + "</select></div>" +
    '<div class="field"><label for="lg-senha">Senha</label><input id="lg-senha" type="password" autocomplete="current-password"></div><p class="err" id="login-err"></p>' +
    '<button class="btn primary full" data-act="login">Entrar</button></section>';
}

/* ---------- calendário ---------- */
function marcasDia() { const m = {}; D.marcas.forEach(x => { (m[x.data] = m[x.data] || []).push(...[...new Set((x.cidades || []).map(c => cid(c).r))].sort()); }); return m; }
function calendario(mes, sel, px, bloqPassado) {
  const mk = marcasDia(), d0 = pd(mes + "-01"), ini = d0.getDay(), dias = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
  let h = '<div class="calhead"><button class="btn small ghost" data-act="' + px + '-prev" aria-label="Mês anterior">‹</button><h3>' + esc(mesLabel(mes)) + '</h3><button class="btn small ghost" data-act="' + px + '-next" aria-label="Próximo mês">›</button></div><div class="cal">' +
    ["D", "S", "T", "Q", "Q", "S", "S"].map(w => '<div class="wd">' + w + "</div>").join("") + "<div></div>".repeat(ini);
  for (let i = 1; i <= dias; i++) {
    const k = mes + "-" + String(i).padStart(2, "0"), past = k < HOJE, marks = (mk[k] || []).slice(0, 4);
    h += '<button data-act="' + px + '-dia" data-d="' + k + '" class="' + (k === HOJE ? "today " : "") + (k === sel ? "sel " : "") + (past && bloqPassado ? "past" : "") + '" aria-label="' + esc(diaLabel(k)) + ((mk[k] || []).length ? ", tem entrega" : "") + '"><span class="nr">' + i + '</span><span class="mk">' + marks.map(r => '<i style="background:var(--r' + r + ')"></i>').join("") + "</span></button>";
  }
  return h + '</div><div class="legend"><span><i style="background:var(--r1)"></i>Anápolis</span><span><i style="background:var(--r2)"></i>Goiânia e região</span><span><i style="background:var(--r3)"></i>Brasília</span></div>';
}
function linhaMarca(m) { return '<div class="row"><div style="min-width:0"><div class="t">' + esc(ordemCidades(m.cidades || []).join(" → ")) + '</div><div class="s">' + esc(m.vendedor) + " · " + n1(Number(m.milheiros) || 0) + " mil</div></div></div>"; }

/* ---------- pedido: 1 pedido · 2 orçamento ou recibo · 3 agendar ---------- */
function steps(n) { return '<div class="steps">' + ["1. Pedido", "2. Orçamento ou recibo", "3. Agendar"].map((l, i) => '<div class="' + (i + 1 === n ? "on" : i + 1 < n ? "done" : "") + '">' + l + "</div>").join("") + "</div>"; }
const docCarga = () => ({ ...L.rascunho, vendedor: D.perfil.nome, data: L.pedido.dia || null });
function vPedido() {
  if (L.pedido.step === 2) return vDocs();
  if (L.pedido.step === 3) return vAgendar();
  const R = L.rascunho, F = L.form, r = resumo(R);
  const guardados = D.orcs;
  return steps(1) +
    (aviso ? '<div class="okmsg" role="status">' + esc(aviso) + "</div>" : "") +
    (guardados.length ? '<section class="card"><h2>Orçamentos esperando agendar</h2><div>' + guardados.map(o => { const t = resumo({ ...o, entregas: o.entregas });
      return '<div class="row"><div style="min-width:0"><div class="t">' + esc(grupos(o).map(g => g.nome).join(", ")) + '</div><div class="s">' + esc(o.vendedor) + " · " + diaCurto(String(o.criado_em).slice(0, 10)) + " · " + n1(t.mil) + " mil · " + brl(t.receita) + '</div></div><div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="btn small" data-act="orc-abrir" data-id="' + o.id + '">' + (confirmar === "abrir" + o.id ? "Toque de novo" : "Continuar") + '</button><button class="btn small danger" data-act="orc-del" data-id="' + o.id + '">' + (confirmar === "del" + o.id ? "Apagar?" : "Apagar") + "</button></div></div>"; }).join("") + "</div>" +
      (R.entregas.length ? '<p class="hint">Você tem um pedido na tela. Continuar um orçamento troca o pedido da tela.</p>' : "") + "</section>" : "") +
    '<section class="card"><div class="field"><label for="ceramica">Fornecedor (cerâmica)</label><select id="ceramica">' + optsObj(CAD().fornecedores.map(f => [f.id, f.nome]), R.ceramica) + "</select></div></section>" +
    '<section class="card"><h2>Adicionar entrega</h2>' +
    '<div class="field"><label for="f-cliente">Cliente</label><input id="f-cliente" list="dl-cli" autocomplete="off" value="' + esc(F.cliente) + '" placeholder="Nome do cliente ou da obra"><datalist id="dl-cli">' + D.clientes.map(c => '<option value="' + esc(c.nome) + '">').join("") + "</datalist></div>" +
    '<div class="grid2"><div class="field"><label for="f-cidade">Cidade</label><select id="f-cidade">' + opts(CAD().cidades.map(c => c.nome), F.cidade) + "</select></div>" +
    '<div class="field"><label for="f-medida">Medida</label><select id="f-medida">' + opts(CAD().medidas.map(m => m.nome), F.medida) + "</select></div>" +
    '<div class="field"><label for="f-mil">Milheiros</label><input id="f-mil" inputmode="decimal" value="' + esc(F.mil) + '" placeholder="3"></div>' +
    '<div class="field"><label for="f-preco">Preço do milheiro</label><input id="f-preco" inputmode="decimal" value="' + esc(F.preco) + '" placeholder="R$"></div></div>' +
    '<p class="hint" id="f-hint"></p><div id="f-alert"></div><p class="err" id="f-err"></p>' +
    '<button class="btn full" data-act="add">Adicionar na carga</button></section>' +
    '<section class="card"><h2>Entregas desta carga</h2>' +
    (R.entregas.length ? "<div>" + R.entregas.map((e, i) => entregaRow(e, R, i, { rm: true })).join("") + "</div>" +
      '<div style="display:flex;flex-direction:column;gap:6px">' + grupos(R).map(g => '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><span class="s" style="font-weight:600">' + esc(g.nome) + "</span>" + freteLinha(R, g) + "</div>").join("") + "</div>" +
      resumoHtml(r) + "<h3>Rota</h3>" + rotaHtml(R, false)
      : '<p class="hint">Adicione a primeira entrega acima. O app calcula as fiadas, o frete e a rota.</p>') + "</section>" +
    '<p class="err" id="p-err"></p><button class="btn primary full" data-act="ir-docs">Próximo: orçamento ou recibo</button>';
}
function updHint() {
  const F = L.form, h = document.getElementById("f-hint"), a = document.getElementById("f-alert"); if (!h) return;
  const c = custoAtual(L.rascunho.ceramica, F.medida), cd = cid(F.cidade), min = minimo(F.medida, cd.r);
  h.textContent = (ADM() ? "Custo " + (c ? brl(c.v) + " (" + c.f + ")" : "sem preço") + " · " : "") + "Mínimo " + REG[cd.r] + ": " + (min != null ? brl(min) : "sem tabela") + " · Frete " + brl2(freteMil({ cidade: F.cidade, medida: F.medida })) + "/mil · " + med(F.medida).pf + " por fiada";
  const p = parseNum(F.preco);
  a.innerHTML = (min != null && isFinite(p) && p > 0 && p < min) ? '<div class="alert" role="alert">O mínimo desse milheiro pra ' + esc(REG[cd.r]) + " é " + brl(min) + ". Menos que isso não compensa.</div>" : "";
}
function dadosCli(c, g) { const e = c.entregas[g.idx[0]], cl = acharCli(g.nome) || {}; return { tel: e.tel || cl.tel || "", cpf: e.cpf || cl.cpf || "", end: e.endc || cl.endereco || "", cidade: e.cidade, fpag: e.fpag || "PIX" }; }
function waHref(tel, txt) { let d = String(tel || "").replace(/\D/g, ""); if (d && d.length <= 11) d = "55" + d; return "https://wa.me/" + d + "?text=" + encodeURIComponent(txt); }
function waTexto(c, g) { const f = freteGrupo(c, g); return "Olá, " + g.nome + "! Aqui é " + c.vendedor + ", da Tijolos Tavares. Tijolos: " + brl2(f.tijolo) + "." + (f.cobrado ? " Frete à parte: " + brl2(f.cobrado) + "." : "") + " Total: " + brl2(f.total) + "." + (c.data ? " Entrega marcada para " + diaLabel(c.data) + "." : ""); }
function compHtml(c, g, gi) {
  const d = dadosCli(c, g), orc = comp.tipo === "orcamento";
  return '<div class="card" style="gap:10px"><h3>Complemento de dados · ' + (orc ? "orçamento" : "recibo") + '</h3><p class="hint">Preencha só o que tiver. O que ficar em branco não aparece no PDF.</p>' +
    '<div class="field"><label for="cp-cpf">CPF ou CNPJ</label><input id="cp-cpf" inputmode="numeric" value="' + esc(d.cpf) + '"></div>' +
    '<div class="field"><label for="cp-end">Endereço da entrega</label><input id="cp-end" value="' + esc(d.end) + '" placeholder="Rua, número, bairro"></div>' +
    (orc ? '<div class="field"><label for="cp-fp">Forma de pagamento</label><select id="cp-fp">' + opts(FPAGS, d.fpag) + "</select></div>" : "") +
    '<div class="grid2"><button class="btn ghost" data-act="comp-x">Cancelar</button><button class="btn primary" data-act="pdf" data-tipo="' + comp.tipo + '" data-g="' + gi + '">Gerar PDF</button></div></div>';
}
function vDocs() {
  const c = docCarga();
  return steps(2) +
    '<section class="card"><h2>Orçamento ou recibo</h2><p class="hint">Gere o PDF de cada cliente e mande no WhatsApp. Se não precisar, é só ir pro agendamento.</p>' +
    grupos(c).map((g, gi) => { const f = freteGrupo(c, g), tel = dadosCli(c, g).tel, taxa = f.taxas.length === 1 ? n1(f.mil) + " mil × " + brl2(f.taxas[0]) + "/mil" : "conforme cidade e medida";
      return '<div class="cli"><div class="t" style="font-weight:600">' + esc(g.nome) + "</div>" +
        '<div class="linha-total"><span>Tijolos</span><strong>' + brl2(f.tijolo) + "</strong></div>" +
        (f.fechada ? '<div class="okmsg">Esse cliente fecha uma carga (' + Math.round(f.occ * 100) + "%). Não cobra frete.</div>"
          : '<label class="check"><input type="checkbox" data-frete="' + gi + '"' + (f.on ? " checked" : "") + "><span><strong>Cobrar frete à parte: " + brl2(f.valor) + '</strong><br><span class="sub">' + esc(taxa) + ", carga em " + Math.round(f.occ * 100) + "% do caminhão</span></span></label>") +
        '<div class="linha-total grande"><span>Total do cliente</span><strong>' + brl2(f.total) + "</strong></div>" +
        '<div class="field"><label for="tel-' + gi + '">WhatsApp do cliente</label><input id="tel-' + gi + '" data-tel="' + gi + '" inputmode="tel" value="' + esc(tel) + '" placeholder="(62) 99999-9999"></div>' +
        (comp && comp.gi === gi ? compHtml(c, g, gi) : '<div class="grid2"><button class="btn" data-act="comp" data-tipo="orcamento" data-g="' + gi + '">Orçamento PDF</button><button class="btn" data-act="comp" data-tipo="recibo" data-g="' + gi + '">Recibo PDF</button></div>') +
        '<p class="hint" id="msg-' + gi + '" role="status"></p>' +
        '<a class="btn wa full" data-wa="' + gi + '" href="' + esc(waHref(tel, waTexto(c, g))) + '" target="_blank" rel="noopener">Mandar mensagem no WhatsApp</a></div>'; }).join("") +
    "</section>" +
    '<button class="btn primary full" data-act="ir-agendar">Próximo: agendar a entrega</button>' +
    '<p class="err" id="g-err"></p><button class="btn full" data-act="guardar">Guardar orçamento sem agendar</button>' +
    '<button class="btn full ghost" data-act="voltar-pedido">Voltar pro pedido</button>';
}
function vAgendar() {
  const R = L.rascunho, r = resumo(R), dia = L.pedido.dia, doDia = dia ? D.marcas.filter(m => m.data === dia) : [];
  return steps(3) +
    '<section class="card"><h2>Escolha o dia da entrega</h2><p class="hint">Os risquinhos mostram os dias que já têm entrega, na cor da região.</p>' + calendario(L.calPedido, dia, "pc", true) + "</section>" +
    '<section class="card"><h3>Esta carga</h3>' + rotaHtml(R, false) + '<p class="hint">' + n1(r.mil) + " milheiros · " + R.entregas.length + " entrega(s) · frete à parte " + brl(r.frete) + "</p>" + barraCaminhao(r) + "</section>" +
    (dia ? '<section class="card"><h3>Já marcado em ' + esc(diaLabel(dia)) + "</h3>" + (doDia.length ? "<div>" + doDia.map(linhaMarca).join("") + "</div>" : '<p class="hint">Nenhuma entrega nesse dia ainda.</p>') + "</section>" : "") +
    '<p class="err" id="a-err"></p><button class="btn primary full" data-act="agendar">' + (dia ? "Agendar para " + esc(diaLabel(dia)) : "Toque num dia do calendário") + "</button>" +
    '<button class="btn full ghost" data-act="voltar-docs">Voltar pro orçamento</button>';
}

/* ---------- PDF ---------- */
const U = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CT = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
function ate999(n) { if (!n) return ""; if (n === 100) return "cem"; const c = Math.floor(n / 100), r = n % 100, p = []; if (c) p.push(CT[c]); if (r) p.push(r < 20 ? U[r] : DZ[Math.floor(r / 10)] + (r % 10 ? " e " + U[r % 10] : "")); return p.join(" e "); }
function extInt(n) {
  if (!n) return "zero"; const mi = Math.floor(n / 1e6), mil = Math.floor(n % 1e6 / 1000), r = n % 1000, p = [];
  if (mi) p.push(ate999(mi) + (mi === 1 ? " milhão" : " milhões")); if (mil) p.push(mil === 1 ? "mil" : ate999(mil) + " mil");
  let s = p.join(" "); if (r) s += (s ? ((r < 100 || r % 100 === 0) ? " e " : " ") : "") + ate999(r);
  if (mi && !mil && !r) s += " de"; return s;
}
function extenso(v) { const i = Math.floor(v + 1e-9), c = Math.round((v - i) * 100); return extInt(i) + (i === 1 ? " real" : " reais") + (c ? " e " + extInt(c) + (c === 1 ? " centavo" : " centavos") : ""); }
const descMed = m => "Tijolo " + (m.includes("maciço") ? "maciço " : "cerâmico ") + m.replace(" REQ", "").replace(" maciço", "").replace(/x/g, " x ") + " cm" + (m.includes("REQ") ? " requeimado" : "");
const unid = mil => Math.round(mil * 1000).toLocaleString("pt-BR") + " un";
function pdfOrcamento(c, g, num) {
  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" }), it = g.idx.map(i => c.entregas[i]), d = dadosCli(c, g), E = D.cfg.empresa, f = freteGrupo(c, g);
  const TAN = [178, 133, 102], RED = [170, 45, 40], INK = [35, 35, 35];
  const linha = (x1, x2, y, w) => { doc.setDrawColor(...TAN); doc.setLineWidth(w || .6); doc.line(x1, y, x2, y); };
  const dupla = (x1, x2, y) => { linha(x1, x2, y, .3); linha(x1, x2, y + .8, .3); };
  doc.setTextColor(...RED); doc.setFont("helvetica", "normal"); doc.setFontSize(21); doc.text("TIJOLOS TAVARES", 13, 27);
  try { doc.addImage(window.LOGO_ORC, "JPEG", 171, 12, 29, 29); } catch (e) {}
  linha(12, 199, 43);
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("CLIENTE", 86, 47.5, { align: "center" }); doc.text("DATA", 140, 47.5, { align: "center" });
  linha(47, 199, 49.5);
  doc.setFont("times", "normal"); doc.setFontSize(11.5); doc.text(dataBR(HOJE), 140, 54.5, { align: "center" }); doc.text(String(num), 172, 54.5);
  let y = 54.5;
  const campo = (l, v, w) => { const ls = doc.splitTextToSize(l + " " + (v || ""), w); doc.text(ls, 48, y); y += ls.length * 5; };
  campo("NOME:", g.nome, 75); if (d.cpf) campo("CPF/CNPJ:", d.cpf, 75); if (d.end) campo("ENDEREÇO:", d.end, 148); campo("CIDADE:", [...new Set(it.map(e => e.cidade))].join(", "), 148);
  y = Math.max(y + 2, 76); linha(29, 198, y);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("FORMA DE PAGAMENTO", 55, y + 5.5); doc.text("SERVIÇO", 112, y + 5.5);
  linha(29, 198, y + 8); doc.setFont("times", "normal"); doc.setFontSize(11.5); doc.text(d.fpag, 55, y + 13.5); doc.text(c.data ? "Entrega em " + diaLongo(c.data) : "Entrega a combinar", 112, y + 13.5);
  linha(29, 198, y + 16.5);
  y += 26; linha(29, 198, y, .8);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("QTD.", 31, y + 5); doc.text("DESCRIÇÃO", 68, y + 5); doc.text("PREÇO DO MILHEIRO", 121, y + 5); doc.text("TOTAL DA LINHA", 163, y + 5);
  y += 7; linha(29, 198, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  const rows = Math.max(it.length, 4);
  for (let i = 0; i < rows; i++) { const e = it[i];
    if (e) { doc.text(unid(e.mil), 31, y + 5); doc.text("TIJOLO " + e.medida.toUpperCase(), 68, y + 5); doc.text(brl2(e.preco), 121, y + 5); doc.text(brl2(e.mil * e.preco), 163, y + 5); }
    else doc.text("----------", 121, y + 5);
    y += 7.5; dupla(29, 198, y); }
  doc.setFont("helvetica", "bold");
  if (f.cobrado) { doc.text(n1(f.mil) + " mil", 31, y + 5); doc.text("FRETE À PARTE", 68, y + 5); doc.text(f.taxas.length === 1 ? brl2(f.taxas[0]) : "conforme cidade", 121, y + 5); doc.text(brl2(f.cobrado), 163, y + 5); }
  else doc.text(f.fechada ? "FRETE: CARGA FECHADA, SEM FRETE" : "SEM COBRANÇA DE FRETE", 68, y + 5);
  y += 8; linha(29, 198, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.text("Tijolos: " + brl2(f.tijolo) + (f.cobrado ? "   ·   Frete à parte: " + brl2(f.cobrado) : ""), 68, y + 5.5);
  y += 8; linha(29, 198, y);
  doc.setTextColor(...RED); doc.setFontSize(17); doc.text("TOTAL:", 121, y + 9.5); doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(brl2(f.total), 163, y + 9);
  y += 15; linha(29, 198, y);
  doc.setFont("times", "italic"); doc.setFontSize(10); doc.setTextColor(90, 90, 90); doc.text("Orçamento válido por 7 dias. Vendedor: " + c.vendedor + ".", 31, y + 6);
  y = Math.max(y + 30, 225); linha(12, 203, y); doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.text("AGRADECEMOS A", 14, y + 6); doc.text("PREFERÊNCIA!", 14, y + 11.5);
  doc.setFont("times", "normal"); doc.setFontSize(10); doc.text("Tijolos Tavares", 58, y + 6); doc.text(E.email || "", 58, y + 11.5);
  doc.text(E.end || "", 125, y + 6); doc.text(E.cidade || "", 125, y + 11.5); doc.text(E.tel ? "Tel. " + E.tel : "", 158, y + 6); if (E.cnpj) doc.text("CNPJ " + E.cnpj, 158, y + 11.5);
  linha(12, 203, y + 17);
  return doc;
}
function pdfRecibo(c, g, num) {
  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" }), it = g.idx.map(i => c.entregas[i]), d = dadosCli(c, g), E = D.cfg.empresa, f = freteGrupo(c, g), tot = f.total;
  const RED = [151, 65, 66], PINK = [246, 237, 238], INK = [25, 25, 25], W = [255, 255, 255];
  const tipoDoc = d.cpf.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF";
  doc.setFillColor(...RED); doc.rect(18, 18, 174, 25, "F");
  try { doc.addImage(window.LOGO_REC, "JPEG", 21, 20.5, 20, 20); } catch (e) {}
  doc.setTextColor(...W); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("Tijolos Tavares", 46, 29);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text("WhatsApp: " + (E.tel || ""), 46, 34.5); doc.text(E.email || "", 46, 39);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("RECIBO", 188, 28, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text("Nº " + String(num).padStart(4, "0") + "/" + HOJE.slice(0, 4), 188, 34, { align: "right" }); doc.text("Data: " + dataBR(HOJE), 188, 39.5, { align: "right" });
  doc.setFillColor(...RED); doc.rect(80, 48, 110, 10.5, "F"); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("VALOR RECEBIDO", 83, 54.5); doc.setFontSize(13.5); doc.text(brl2(tot), 187, 55, { align: "right" });
  doc.setTextColor(...RED); doc.setFontSize(12.5); doc.text("Dados do Cliente", 20, 68);
  doc.setFontSize(10); const endL = doc.splitTextToSize((d.end ? "Endereço: " : "Cidade: ") + [d.end, d.cidade].filter(Boolean).join(" – "), 166), bh = 8 + endL.length * 5 + 4;
  doc.setFillColor(...PINK); doc.setDrawColor(...RED); doc.setLineWidth(.3); doc.rect(18, 70.5, 174, bh, "FD");
  doc.setTextColor(...INK); const kv = (k, v, x, yy) => { doc.setFont("helvetica", "bold"); doc.text(k, x, yy); doc.setFont("helvetica", "normal"); doc.text(v, x + doc.getTextWidth(k) + 1.5, yy); };
  kv("Nome:", g.nome, 21, 76.5); if (d.cpf) kv(tipoDoc + ":", d.cpf, 128, 76.5);
  doc.setFont("helvetica", "normal"); doc.text(endL, 21, 84);
  let y = 70.5 + bh + 10; doc.setFontSize(11);
  const idDoc = d.cpf ? ", inscrito no " + tipoDoc + " sob o nº " + d.cpf : "";
  const par = doc.splitTextToSize("Recebemos de " + g.nome + idDoc + ", a importância de " + brl2(tot) + " (" + extenso(tot) + "), referente à compra dos materiais discriminados abaixo" + (f.cobrado ? " e ao frete" : "") + ", pelo que damos plena e total quitação.", 170);
  doc.text(par, 20, y, { lineHeightFactor: 1.45 }); y += par.length * 5.9 + 8;
  doc.setTextColor(...RED); doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.text("Materiais Adquiridos", 20, y); y += 3;
  doc.setFillColor(...RED); doc.rect(18, y, 174, 9.5, "F"); doc.setTextColor(...W); doc.setFontSize(10);
  doc.text("Item", 20, y + 6.3); doc.text("Descrição", 32, y + 6.3); doc.text("Qtd.", 124, y + 6.3, { align: "right" }); doc.text("Valor milheiro", 156, y + 6.3, { align: "right" }); doc.text("Subtotal", 189, y + 6.3, { align: "right" });
  y += 9.5; doc.setTextColor(...INK); doc.setFont("helvetica", "normal"); doc.setDrawColor(225, 215, 215); let un = 0;
  it.forEach((e, i) => { un += Math.round(e.mil * 1000); doc.text(String(i + 1), 22, y + 6.5); doc.text(descMed(e.medida), 32, y + 6.5); doc.text(unid(e.mil), 124, y + 6.5, { align: "right" }); doc.text(brl2(e.preco), 156, y + 6.5, { align: "right" }); doc.text(brl2(e.mil * e.preco), 189, y + 6.5, { align: "right" }); y += 10; doc.line(18, y, 192, y); });
  if (f.cobrado) { doc.text(String(it.length + 1), 22, y + 6.5); doc.text("Frete à parte", 32, y + 6.5); doc.text(n1(f.mil) + " mil", 124, y + 6.5, { align: "right" }); doc.text(f.taxas.length === 1 ? brl2(f.taxas[0]) : "–", 156, y + 6.5, { align: "right" }); doc.text(brl2(f.cobrado), 189, y + 6.5, { align: "right" }); y += 10; doc.line(18, y, 192, y); }
  doc.setFillColor(...PINK); doc.rect(18, y, 174, 10, "F"); doc.setFont("helvetica", "bold"); doc.text("TOTAL", 32, y + 6.5); doc.text(un.toLocaleString("pt-BR") + " un", 124, y + 6.5, { align: "right" }); doc.text(brl2(tot), 189, y + 6.5, { align: "right" });
  y += 27; doc.setFont("helvetica", "normal"); doc.text("Emitido em " + dataBR(HOJE) + ".", 189, y, { align: "right" });
  y += 20; doc.setDrawColor(...INK); doc.setLineWidth(.2); doc.line(62, y, 148, y); doc.setFont("helvetica", "bold"); doc.text("Tijolos Tavares", 105, y + 5.5, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.text("Emitente", 105, y + 10.5, { align: "center" });
  y = Math.max(y + 20, 240); doc.setFillColor(...PINK); doc.rect(18, y, 174, 32, "F"); doc.setDrawColor(...RED); doc.setLineWidth(.8); doc.line(18, y, 192, y);
  doc.setTextColor(...RED); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text("Obrigado pela preferência!", 105, y + 8, { align: "center" });
  doc.setTextColor(...INK); doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text("Agradecemos a confiança em nossos produtos. Será um prazer atender você e fazer parte da sua obra.", 105, y + 15, { align: "center" });
  doc.text("Qualquer dúvida, estamos à disposição.", 105, y + 20, { align: "center" });
  doc.setTextColor(120, 120, 120); doc.setFontSize(8.5); doc.text(["Tijolos Tavares", E.tel ? "WhatsApp " + E.tel : "", E.email].filter(Boolean).join("  ·  "), 105, y + 27, { align: "center" });
  return doc;
}
/* abre um arquivo no celular (PDF no compartilhar, planilha no Excel) */
async function entregarArquivo(nome, b64, tipo, compartilhar) {
  if (NATIVO && compartilhar && FS && Share) { const w = await FS.writeFile({ path: nome, data: b64, directory: "CACHE" }); await Share.share({ title: nome, files: [w.uri], dialogTitle: "Mandar o arquivo" }); return; }
  if (NATIVO && Atual) { await Atual.abrirArquivo({ nome, base64: b64, tipo }); return; }
  const a = document.createElement("a"); a.href = "data:" + tipo + ";base64," + b64; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
}
const paraB64 = u => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
async function gerarPdf(gi, tipo) {
  const R = L.rascunho, g = grupos(docCarga())[gi];
  const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : null; };
  const cpf = val("cp-cpf"), end = val("cp-end"), fp = val("cp-fp");
  g.idx.forEach(i => { const e = R.entregas[i]; if (cpf != null) e.cpf = cpf; if (end != null) e.endc = end; if (fp) e.fpag = fp; });
  const cl = acharCli(g.nome);
  if (cl && ((cpf && !cl.cpf) || (end && !cl.endereco))) { const up = {}; if (cpf && !cl.cpf) up.cpf = cpf; if (end && !cl.endereco) up.endereco = end; Object.assign(cl, up); sb.from("clientes").update(up).eq("id", cl.id); }
  comp = null; salvarLocal(); render();
  const msg = document.getElementById("msg-" + gi);
  if (!window.jspdf) { msg.textContent = "Não deu pra carregar o gerador de PDF."; return; }
  msg.textContent = "Gerando o PDF…";
  const { data: num, error } = await sb.rpc("proximo_documento");
  if (error || num == null) { msg.textContent = "Sem conexão. Confira a internet e tente de novo."; return; }
  const doc = tipo === "recibo" ? pdfRecibo(docCarga(), g, num) : pdfOrcamento(docCarga(), g, num);
  const nome = (tipo === "recibo" ? "Recibo" : "Orcamento") + "-" + slug(g.nome) + "-" + HOJE + ".pdf";
  try { await entregarArquivo(nome, doc.output("datauristring").split(",")[1], "application/pdf", true); msg.textContent = NATIVO ? "Escolha o WhatsApp pra mandar o " + (tipo === "recibo" ? "recibo." : "orçamento.") : "PDF salvo."; }
  catch (e) { if (!/cancel/i.test(String(e && e.message))) msg.textContent = "Não deu pra abrir o compartilhar. Tente de novo."; }
}

/* ---------- relatório de viagem (só o administrador) ---------- */
function dadosRelatorio(c) {
  const rel = D.rels.find(r => r.carga_id === c.id), fin = {};
  c.entregas.forEach((e, i) => { if (D.fin.ent[c.id + "|" + i]) fin[i] = D.fin.ent[c.id + "|" + i]; });
  return RelatorioViagem.dadosDe({ numero: rel ? rel.numero : "", carga: c, custos: (D.admin[c.id] || {}).custos || [], pags: c.entregas.map((e, i) => pagDe(c, i)), fin, cadastro: CAD(), movs: D.fin.movs, cats: D.fin.cats, ajudantes: D.fin.ajud, pessoas: D.fin.pessoas });
}
async function abrirRelatorio(cargaId, msgId) {
  const c = acharCarga(cargaId), msg = t => { const el = document.getElementById(msgId); if (el) el.textContent = t; };
  if (!c) return;
  msg("Montando a planilha…");
  try {
    const dados = dadosRelatorio(c), bytes = RelatorioViagem.montar(dados), nome = RelatorioViagem.nomeArquivo(dados), b64 = paraB64(bytes);
    const caminho = c.data.slice(0, 7) + "/" + nome;
    sb.storage.from("relatorios").upload(caminho, new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), { upsert: true })
      .then(r => { if (!r.error) sb.from("relatorios").update({ arquivo: caminho, gerado_em: new Date().toISOString() }).eq("carga_id", c.id); });
    await entregarArquivo(nome, b64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", false);
    msg("Planilha aberta.");
  } catch (e) { msg("Não deu pra montar a planilha. Tente de novo."); }
}

/* ---------- agenda ---------- */
function cargaCard(c) {
  const r = resumo(c), st = c.status === "Entregue" ? "green" : c.status === "Carregada" ? "amber" : "brick", adm = ADM(), rel = adm && D.rels.find(x => x.carga_id === c.id);
  const gv = gastosViagem(c);
  return '<section class="card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div style="min-width:0"><h3>' + esc(c.vendedor) + " · " + n1(r.mil) + ' mil</h3><div class="hint">' + esc(forn(c.ceramica).nome) + "</div></div>" +
    '<span class="chip ' + st + '">' + esc(c.status) + "</span></div>" + rotaHtml(c, true) +
    '<div class="stats"><div class="stat"><div class="l">Caminhão</div><div class="v" style="color:' + corOcc(r.pct) + '">' + r.pct + '%</div></div><div class="stat"><div class="l">Frete à parte</div><div class="v">' + brl(r.frete) + "</div></div>" +
    (adm ? '<div class="stat"><div class="l">Lucro antes da viagem</div><div class="v ' + (r.lucro >= 0 ? "pos" : "neg") + '">' + brl(r.lucro) + '</div></div><div class="stat"><div class="l">Líquido (com gastos)</div><div class="v ' + (r.lucro - gv >= 0 ? "pos" : "neg") + '">' + brl(r.lucro - gv) + "</div></div>" : '<div class="stat" style="grid-column:1/-1"><div class="l">Total da carga</div><div class="v">' + brl(r.receita) + "</div></div>") + "</div>" +
    (adm && gv ? '<p class="hint">Gastos da viagem lidos pelo Financeiro: ' + brl(gv) + ".</p>" : "") +
    (r.abaixo ? '<span class="chip red">' + r.abaixo + " entrega(s) abaixo do mínimo</span>" : "") +
    (c.status === "Entregue" && Camera && c.entregas.some(e => !e.foto) ? '<p class="hint">Falta a foto da entrega. Abra "Ver entregas" pra tirar.</p>' : "") +
    "<details" + (c.entregas.some((e, i) => fotos[c.id + "|" + i]) ? " open" : "") + "><summary>Ver entregas</summary>" + c.entregas.map((e, i) => entregaRow(e, c, i, { pag: adm, foto: true })).join("") +
      (adm ? grupos(c).map(g => '<div class="field" style="margin-bottom:8px"><label for="pg-' + c.id + "-" + g.idx[0] + '">Pagamento de ' + esc(g.nome) + '</label><select id="pg-' + c.id + "-" + g.idx[0] + '" data-pag="' + c.id + "|" + g.idx.join(",") + '">' + opts(PAGS, pagDe(c, g.idx[0])) + "</select></div>").join("") : "") + "</details>" +
    (rel ? '<button class="btn" data-act="rel" data-id="' + c.id + '" data-msg="rm-' + c.id + '">Relatório de viagem nº ' + String(rel.numero).padStart(4, "0") + ' (Excel)</button><p class="hint" id="rm-' + c.id + '"></p>' : "") +
    '<div class="grid2"><div class="field"><label for="st-' + c.id + '">Situação</label><select id="st-' + c.id + '" data-status="' + c.id + '">' + opts(STATUS, c.status) + "</select></div>" +
    '<div class="field"><label aria-hidden="true">&nbsp;</label><button class="btn danger" data-act="del" data-id="' + c.id + '">' + (confirmar === c.id ? "Toque de novo" : "Apagar carga") + "</button></div></div></section>";
}
function vAgenda() {
  const ab = D.cargas.filter(c => c.status !== "Entregue"), dia = L.diaAgenda, minhasDia = D.cargas.filter(c => c.data === dia), ids = new Set(minhasDia.map(c => c.id)), outras = D.marcas.filter(m => m.data === dia && !ids.has(m.id));
  let t = { mil: 0, v: 0 }; ab.forEach(c => { const r = resumo(c); t.mil += r.mil; t.v += ADM() ? r.lucro : r.receita; });
  return (Agenda ? '<div id="agenda-aviso"></div>' : "") +
    '<section class="card"><div class="stats"><div class="stat"><div class="l">Cargas em aberto</div><div class="v">' + ab.length + '</div></div><div class="stat"><div class="l">Milheiros</div><div class="v">' + n1(t.mil) + "</div></div>" +
    '<div class="stat" style="grid-column:1/-1"><div class="l">' + (ADM() ? "Lucro em aberto" : "Total em aberto") + '</div><div class="v">' + brl(t.v) + "</div></div></div></section>" +
    '<section class="card">' + calendario(L.calAgenda, dia, "ac", false) + "</section>" +
    "<h2>" + esc(cap(diaLabel(dia))) + "</h2>" +
    (minhasDia.length ? minhasDia.map(cargaCard).join("") : (outras.length ? "" : '<section class="card"><p class="hint">Nenhuma entrega nesse dia.</p><button class="btn primary" data-act="ir-pedido">Montar um pedido</button></section>')) +
    (outras.length ? '<section class="card"><h3>De outros vendedores</h3><div>' + outras.map(linhaMarca).join("") + "</div></section>" : "");
}
async function avisoAgendaCelular() {
  const el = document.getElementById("agenda-aviso"); if (!el) return;
  if (!(await agendaLiberada())) el.innerHTML = '<section class="card"><p class="hint">Libere o calendário pra as cargas aparecerem na agenda do seu celular.</p><button class="btn" data-act="liberar-agenda">Ligar calendário do celular</button></section>';
}

/* ---------- clientes ---------- */
function vendasPor(nome) { const out = []; D.cargas.forEach(c => c.entregas.forEach(e => { if (norm(e.cliente) === norm(nome)) out.push({ c, e }); })); return out; }
function vClientes() {
  const sem = [];
  D.cargas.forEach(c => c.entregas.forEach(e => { if (e.cliente && !acharCli(e.cliente) && !sem.some(s => norm(s.nome) === norm(e.cliente))) sem.push({ nome: e.cliente, cidade: e.cidade, tel: e.tel || "", cpf: e.cpf || "", end: e.endc || "", data: c.data }); }));
  const lista = D.clientes.filter(c => !buscaCli || norm(c.nome).includes(norm(buscaCli)));
  const cidades = CAD().cidades.map(c => c.nome);
  const form = (s, id) => '<div class="row" style="flex-direction:column;align-items:stretch;gap:10px"><div class="field"><label for="cn">Nome</label><input id="cn" value="' + esc(s.nome) + '"></div>' +
    '<div class="grid2"><div class="field"><label for="ct">Telefone</label><input id="ct" inputmode="tel" value="' + esc(s.tel) + '" placeholder="(62) 99999-9999"></div><div class="field"><label for="cc">Cidade</label><select id="cc">' + opts(cidades.includes(s.cidade) ? cidades : cidades.concat([s.cidade || ""]), s.cidade) + "</select></div></div>" +
    '<div class="field"><label for="cpfc">CPF ou CNPJ</label><input id="cpfc" inputmode="numeric" value="' + esc(s.cpf) + '"></div>' +
    '<div class="field"><label for="ce">Endereço</label><input id="ce" value="' + esc(s.end) + '" placeholder="Rua, número, bairro"></div><p class="err" id="c-err"></p>' +
    '<div class="grid2"><button class="btn ghost" data-act="cad-cancel">Cancelar</button><button class="btn primary" data-act="cad-salvar"' + (id ? ' data-id="' + id + '"' : "") + ">Salvar cliente</button></div></div>";
  return '<section class="card"><h2>Vendas passadas sem cadastro</h2><p class="hint">Cadastre quando tiver tempo. Nada aqui atrapalha os pedidos.</p>' +
    (sem.length ? "<div>" + sem.map((s, i) => cadastrando === i ? form(s) :
      '<div class="row"><div style="min-width:0"><div class="t">' + esc(s.nome) + '</div><div class="s">' + esc(s.cidade) + " · comprou em " + esc(diaCurto(s.data)) + '</div></div><button class="btn small" data-act="cad-abrir" data-i="' + i + '">Cadastrar</button></div>').join("") + "</div>"
      : '<p class="hint">Todas as vendas já têm cliente cadastrado.</p>') + "</section>" +
    '<section class="card"><h2>Clientes cadastrados</h2>' + (D.clientes.length > 5 ? '<div class="field"><label for="busca">Buscar</label><input id="busca" value="' + esc(buscaCli) + '" placeholder="Nome do cliente"></div>' : "") +
    (lista.length ? "<div>" + lista.map(cl => { const v = vendasPor(cl.nome), tot = v.reduce((s, x) => s + x.e.mil * x.e.preco + (+x.e.frete || 0), 0);
      if (cadastrando === "e" + cl.id) return form({ nome: cl.nome, tel: cl.tel, cidade: cl.cidade, cpf: cl.cpf, end: cl.endereco }, cl.id);
      return '<div class="row"><div style="min-width:0;flex:1"><div class="t">' + esc(cl.nome) + '</div><div class="s">' + esc([cl.tel, cl.cpf, cl.cidade, cl.endereco].filter(Boolean).join(" · ")) + '</div><div class="s">' + v.length + " compra(s) · " + brl(tot) + "</div>" +
        (v.length ? '<details style="margin-top:6px"><summary>Ver compras</summary>' + v.map(x => '<div class="s">' + esc(diaCurto(x.c.data)) + " · " + esc(x.e.medida) + " · " + n1(x.e.mil) + " mil · " + brl(x.e.mil * x.e.preco) + "</div>").join("") + "</details>" : "") + '</div><button class="btn small" data-act="cad-editar" data-id="' + cl.id + '">Editar</button></div>'; }).join("") + "</div>"
      : '<p class="hint">' + (D.clientes.length ? "Nenhum cliente com esse nome." : "Nenhum cliente cadastrado ainda. Comece pelas vendas passadas acima.") + "</p>") + "</section>";
}

/* ---------- ferramentas ---------- */
function vFerramentas() {
  let tf = 0, occ = 0;
  const rows = L.calc.map((l, i) => { const m = med(l.medida), f = Math.ceil(l.mil * 1000 / m.pf); tf += f; occ += f / m.fiadas;
    return '<div class="row"><div><div class="t">' + esc(l.medida) + " · " + n1(l.mil) + ' mil</div><div class="s">' + f + " fiadas · " + m.pf + ' por fiada</div></div><button class="btn small" data-act="crm" data-i="' + i + '">Remover</button></div>'; }).join("");
  const p = Math.round(occ * 100), fm = v => v != null ? brl(v) : "–", C = D.cfg.custos || {};
  return '<section class="card"><h2>Calculadora de fiadas</h2><div class="grid2"><div class="field"><label for="c-mil">Milheiros</label><input id="c-mil" inputmode="decimal" placeholder="5"></div>' +
    '<div class="field"><label for="c-medida">Medida</label><select id="c-medida">' + opts(CAD().medidas.map(m => m.nome), "09x19x19") + '</select></div></div><p class="err" id="calc-err"></p>' +
    '<button class="btn full" data-act="cadd">Calcular e somar na carga</button>' + (rows ? "<div>" + rows + "</div>" : "") +
    '<div class="stats"><div class="stat"><div class="l">Total de fiadas</div><div class="v">' + tf + '</div></div><div class="stat"><div class="l">Caminhão</div><div class="v" style="color:' + corOcc(p) + '">' + p + "%</div></div></div>" +
    '<div class="bar"><div style="width:' + Math.min(p, 100) + "%;background:" + corOcc(p) + '"></div></div>' + (rows ? '<button class="btn small" data-act="climpar">Limpar</button>' : "") + "</section>" +
    '<section class="card"><h2>Preço mínimo de venda</h2><p class="hint">Menos que isso não compensa.</p><div class="tbl"><table><thead><tr><th>Medida</th>' + (ADM() ? "<th>Custo região</th>" : "") + "<th>Anápolis</th><th>Goiânia</th><th>Brasília</th></tr></thead><tbody>" +
    CAD().medidas.map(m => { const x = D.cfg.minimos[m.nome] || []; return "<tr><td>" + esc(m.nome) + "</td>" + (ADM() ? "<td>" + fm((C.regiao || {})[m.nome]) + "</td>" : "") + "<td>" + fm(x[0]) + "</td><td>" + fm(x[1]) + "</td><td>" + fm(x[2]) + "</td></tr>"; }).join("") + "</tbody></table></div></section>" +
    '<section class="card"><h2>Frete por milheiro</h2><p class="hint">Só cobra quando a entrega não fecha uma carga. Os maciços usam a coluna de 108.</p><div class="tbl"><table><thead><tr><th>Cidade</th><th>Carga de 108</th><th>Carga de 72</th></tr></thead><tbody>' +
    CAD().cidades.map(c => "<tr><td>" + esc(c.nome) + "</td><td>" + brl2(c.f108) + "</td><td>" + brl2(c.f72) + "</td></tr>").join("") + "</tbody></table></div></section>" +
    '<section class="card"><h2>Carga cheia por medida</h2><div class="tbl"><table><thead><tr><th>Medida</th><th>Por fiada</th><th>Fiadas</th><th>Peças</th></tr></thead><tbody>' +
    CAD().medidas.map(m => "<tr><td>" + esc(m.nome) + "</td><td>" + m.pf + "</td><td>" + m.fiadas + "</td><td>" + (m.pf * m.fiadas).toLocaleString("pt-BR") + "</td></tr>").join("") + "</tbody></table></div></section>";
}

/* ---------- painel do administrador ---------- */
function vPainel() {
  const mes = L.mesResumo, doMes = D.cargas.filter(c => c.data.slice(0, 7) === mes), pv = {}; const T = { n: 0, mil: 0, venda: 0, frete: 0, lucro: 0, gastos: 0 };
  doMes.forEach(c => { const r = resumo(c), g = gastosViagem(c), x = pv[c.vendedor] = pv[c.vendedor] || { n: 0, mil: 0, venda: 0, frete: 0, lucro: 0 }; [x, T].forEach(o => { o.n++; o.mil += r.mil; o.venda += r.venda; o.frete += r.frete; o.lucro += r.lucro; }); T.gastos += g; });
  const deve = {}; let aRec = 0, fiado = 0;
  D.cargas.forEach(c => grupos(c).forEach(g => { const p = pagDe(c, g.idx[0]); if (p === "Pago") return; const v = freteGrupo(c, g).total; if (p === "Fiado") fiado += v; else aRec += v; (deve[g.nome] = deve[g.nome] || []).push({ c, g, v, p }); }));
  const rels = D.rels.map(r => ({ r, c: acharCarga(r.carga_id) })).filter(x => x.c), meses = [...new Set(rels.map(x => x.c.data.slice(0, 7)))].sort().reverse();
  return '<section class="card"><div class="calhead"><button class="btn small ghost" data-act="rm-prev" aria-label="Mês anterior">‹</button><h2>Resumo de ' + esc(mesLabel(mes).toLowerCase()) + '</h2><button class="btn small ghost" data-act="rm-next" aria-label="Próximo mês">›</button></div>' +
    '<div class="stats"><div class="stat"><div class="l">Cargas</div><div class="v">' + T.n + '</div></div><div class="stat"><div class="l">Milheiros</div><div class="v">' + n1(T.mil) + "</div></div>" +
    '<div class="stat"><div class="l">Tijolo</div><div class="v">' + brl(T.venda) + '</div></div><div class="stat"><div class="l">Frete</div><div class="v">' + brl(T.frete) + "</div></div>" +
    '<div class="stat"><div class="l">Gastos das viagens</div><div class="v neg">' + brl(T.gastos) + '</div></div><div class="stat"><div class="l">Líquido</div><div class="v ' + (T.lucro - T.gastos >= 0 ? "pos" : "neg") + '">' + brl(T.lucro - T.gastos) + "</div></div></div>" +
    (Object.keys(pv).length ? '<div class="tbl"><table><thead><tr><th>Vendedor</th><th>Cargas</th><th>Mil</th><th>Tijolo</th><th>Lucro</th></tr></thead><tbody>' +
      Object.entries(pv).sort((a, b) => b[1].venda - a[1].venda).map(([v, x]) => "<tr><td>" + esc(v) + "</td><td>" + x.n + "</td><td>" + n1(x.mil) + "</td><td>" + brl(x.venda) + "</td><td>" + brl(x.lucro) + "</td></tr>").join("") + "</tbody></table></div>" : '<p class="hint">Nenhuma carga nesse mês.</p>') + "</section>" +
    '<section class="card"><h2>Pagamentos</h2><div class="stats"><div class="stat"><div class="l">A receber</div><div class="v" style="color:var(--warn)">' + brl(aRec) + '</div></div><div class="stat"><div class="l">Fiado</div><div class="v neg">' + brl(fiado) + "</div></div></div>" +
    '<p class="hint">Quando o Pix cai na conta, o Financeiro marca como pago sozinho.</p>' +
    (Object.keys(deve).length ? "<div>" + Object.entries(deve).map(([k, l]) => '<div class="row" style="flex-direction:column;align-items:stretch;gap:6px"><div style="display:flex;justify-content:space-between;gap:8px"><span class="t">' + esc(k) + "</span><strong>" + brl(l.reduce((s, x) => s + x.v, 0)) + "</strong></div>" +
      l.map(x => '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="s">' + esc(diaCurto(x.c.data)) + " · " + brl(x.v) + '</span><select class="mini" aria-label="Pagamento" data-pag="' + x.c.id + "|" + x.g.idx.join(",") + '">' + opts(PAGS, x.p) + "</select></div>").join("") + "</div>").join("") + "</div>"
      : '<p class="hint">Ninguém está devendo.</p>') + "</section>" +
    '<section class="card"><h2>Relatórios de viagem</h2><p class="hint">Cada carga entregue ganha o seu, no modelo da sua planilha, com os gastos que o Financeiro leu dos bancos.</p>' +
    (meses.length ? meses.map((m, mi) => '<details' + (mi === 0 ? " open" : "") + '><summary>' + esc(mesLabel(m)) + " (" + rels.filter(x => x.c.data.slice(0, 7) === m).length + ")</summary>" +
      rels.filter(x => x.c.data.slice(0, 7) === m).sort((a, b) => b.r.numero - a.r.numero).map(x => { const d = dadosRelatorio(x.c), t = RelatorioViagem.calcular(d);
        return '<div class="row"><div style="min-width:0"><div class="t">Nº ' + String(x.r.numero).padStart(4, "0") + " · " + dataBR(x.c.data) + '</div><div class="s">' + esc(d.rota.join(" → ")) + " · líquido " + brl(t.liquido) + '</div><p class="hint" id="rp-' + x.c.id + '"></p></div><button class="btn small" data-act="rel" data-id="' + x.c.id + '" data-msg="rp-' + x.c.id + '">Abrir</button></div>'; }).join("") + "</details>").join("")
      : '<p class="hint">Quando uma carga for marcada como Entregue, o relatório aparece aqui.</p>') + "</section>";
}

/* ---------- configurações ---------- */
const numTxt = v => v == null ? "" : String(v).replace(".", ",");
function lerNum(id) { const el = document.getElementById(id); if (!el) return null; const s = el.value.trim(); if (!s) return null; const n = parseNum(s); return isFinite(n) && n >= 0 ? n : NaN; }
const emUso = f => D.cargas.some(c => c.entregas.some(f)) || D.orcs.some(c => c.entregas.some(f)) || L.rascunho.entregas.some(f);
function vCfgMedidas() {
  const C = D.cfg.custos || {}, inp = (id, v, w) => '<td><input id="' + id + '" inputmode="decimal" value="' + numTxt(v) + '"' + (w ? ' style="width:' + w + 'px"' : "") + "></td>";
  return '<details' + (editando === "med" ? " open" : "") + "><summary>Medidas e preços (" + CAD().medidas.length + ")</summary>" +
    '<p class="hint">Custo da região vale pra quem não tem preço próprio. Em branco = sem preço.</p>' +
    '<div class="tbl tp"><table><thead><tr><th>Medida</th><th>Por fiada</th><th>Fiadas</th><th>Custo região</th><th>Mín. Anápolis</th><th>Mín. Goiânia</th><th>Mín. Brasília</th><th></th></tr></thead><tbody>' +
    CAD().medidas.map((m, i) => { const mn = D.cfg.minimos[m.nome] || [];
      return "<tr><td>" + esc(m.nome) + "</td>" + inp("md-" + i + "-pf", m.pf, 60) + inp("md-" + i + "-fi", m.fiadas, 60) + inp("md-" + i + "-c", (C.regiao || {})[m.nome]) + inp("md-" + i + "-m1", mn[0]) + inp("md-" + i + "-m2", mn[1]) + inp("md-" + i + "-m3", mn[2]) +
        "<td>" + (emUso(e => e.medida === m.nome) ? '<span class="sub">Em uso</span>' : '<button class="btn small danger" data-act="md-del" data-i="' + i + '">' + (confirmar === "md" + i ? "Remover?" : "Remover") + "</button>") + "</td></tr>"; }).join("") +
    '</tbody></table></div><p class="err" id="md-err"></p><button class="btn primary" data-act="md-salvar">Salvar medidas e preços</button>' +
    '<h3 style="margin-top:12px">Adicionar medida</h3><div class="grid2"><div class="field" style="grid-column:1/-1"><label for="nm-nome">Nome</label><input id="nm-nome" placeholder="12x19x39"></div>' +
    '<div class="field"><label for="nm-pf">Peças por fiada</label><input id="nm-pf" inputmode="numeric"></div><div class="field"><label for="nm-fi">Fiadas na carga</label><input id="nm-fi" inputmode="numeric" placeholder="108, 72 ou 115"></div>' +
    '<div class="field"><label for="nm-c">Custo região</label><input id="nm-c" inputmode="decimal"></div><div class="field"><label for="nm-m1">Mín. Anápolis</label><input id="nm-m1" inputmode="decimal"></div>' +
    '<div class="field"><label for="nm-m2">Mín. Goiânia</label><input id="nm-m2" inputmode="decimal"></div><div class="field"><label for="nm-m3">Mín. Brasília</label><input id="nm-m3" inputmode="decimal"></div></div>' +
    '<p class="err" id="nm-err"></p><button class="btn" data-act="md-add">Adicionar medida</button></details>';
}
function vCfgCidades() {
  return '<details' + (editando === "cid" ? " open" : "") + "><summary>Cidades e frete (" + CAD().cidades.length + ")</summary>" +
    '<div class="tbl tp"><table><thead><tr><th>Cidade</th><th>Preço mínimo de</th><th>Frete 108</th><th>Frete 72</th><th></th></tr></thead><tbody>' +
    CAD().cidades.map((c, i) => "<tr><td>" + esc(c.nome) + '</td><td><select id="cd-' + i + '-r" style="width:150px">' + optsObj(Object.entries(REG), c.r) + '</select></td><td><input id="cd-' + i + '-a" inputmode="decimal" value="' + numTxt(c.f108) + '"></td><td><input id="cd-' + i + '-b" inputmode="decimal" value="' + numTxt(c.f72) + '"></td>' +
      "<td>" + (emUso(e => e.cidade === c.nome) ? '<span class="sub">Em uso</span>' : '<button class="btn small danger" data-act="cd-del" data-i="' + i + '">' + (confirmar === "cd" + i ? "Remover?" : "Remover") + "</button>") + "</td></tr>").join("") +
    '</tbody></table></div><p class="err" id="cd-err"></p><button class="btn primary" data-act="cd-salvar">Salvar cidades</button>' +
    '<h3 style="margin-top:12px">Adicionar cidade</h3><div class="grid2"><div class="field" style="grid-column:1/-1"><label for="nc-nome">Nome</label><input id="nc-nome" placeholder="Inhumas"></div>' +
    '<div class="field" style="grid-column:1/-1"><label for="nc-r">Usa o preço mínimo de</label><select id="nc-r">' + optsObj(Object.entries(REG), 2) + "</select></div>" +
    '<div class="field"><label for="nc-a">Frete 108 (R$/mil)</label><input id="nc-a" inputmode="decimal" placeholder="padrão da região"></div><div class="field"><label for="nc-b">Frete 72 (R$/mil)</label><input id="nc-b" inputmode="decimal" placeholder="padrão da região"></div></div>' +
    '<p class="err" id="nc-err"></p><button class="btn" data-act="cd-add">Adicionar cidade</button></details>';
}
function vCfgFornecedores() {
  const C = D.cfg.custos || {};
  return '<details' + (editando === "forn" ? " open" : "") + "><summary>Fornecedores (" + CAD().fornecedores.length + ")</summary>" +
    CAD().fornecedores.map((f, fi) => '<details class="sub-d"><summary>' + esc(f.nome) + "</summary>" +
      '<div class="grid2"><div class="field"><label for="fo-' + fi + '-n">Nome</label><input id="fo-' + fi + '-n" value="' + esc(f.nome) + '"></div><div class="field"><label for="fo-' + fi + '-o">Endereço pra rota</label><input id="fo-' + fi + '-o" value="' + esc(f.origem) + '"></div></div>' +
      '<p class="hint">Custo por milheiro desse fornecedor. Em branco usa o custo da região.</p><div class="tbl tp"><table><thead><tr><th>Medida</th><th>Custo</th><th>Região</th></tr></thead><tbody>' +
      CAD().medidas.map((m, mi) => "<tr><td>" + esc(m.nome) + '</td><td><input id="fo-' + fi + "-" + mi + '" inputmode="decimal" value="' + numTxt((C[f.id] || {})[m.nome]) + '"></td><td class="sub">' + ((C.regiao || {})[m.nome] != null ? brl(C.regiao[m.nome]) : "–") + "</td></tr>").join("") +
      '</tbody></table></div><p class="err" id="fo-' + fi + '-err"></p><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="fo-salvar" data-i="' + fi + '">Salvar ' + esc(f.nome) + "</button>" +
      (D.cargas.some(c => c.ceramica === f.id) || D.orcs.some(c => c.ceramica === f.id) ? "" : '<button class="btn danger" data-act="fo-del" data-i="' + fi + '">' + (confirmar === "fo" + fi ? "Remover?" : "Remover") + "</button>") + "</div></details>").join("") +
    '<h3 style="margin-top:12px">Adicionar fornecedor</h3><div class="grid2"><div class="field"><label for="nf-nome">Nome</label><input id="nf-nome" placeholder="Cerâmica Silvânia"></div><div class="field"><label for="nf-o">Cidade</label><input id="nf-o" placeholder="Anápolis - GO"></div></div>' +
    '<p class="err" id="nf-err"></p><button class="btn" data-act="fo-add">Adicionar fornecedor</button></details>';
}
function vConfig() {
  const E = D.cfg.empresa;
  return '<h1>Configurações</h1>' + (msgCfg ? '<div class="okmsg" role="status">' + esc(msgCfg) + "</div>" : "") +
    '<section class="card"><h2>Aparência</h2><p class="hint">Vale pra você nos dois apps, Tijolos e Financeiro.</p>' + Aparencia.html() + "</section>" +
    (ADM() ? '<section class="card"><h2>Cadastros</h2><p class="hint">Mudou aqui, muda no app de todo mundo e no Financeiro. As cargas já agendadas guardam o preço da época.</p>' + vCfgFornecedores() + vCfgMedidas() + vCfgCidades() + "</section>" +
      '<section class="card"><h2>Dados da empresa</h2><p class="hint">Saem no orçamento e no recibo.</p>' +
      '<div class="grid2"><div class="field"><label for="em-end">Endereço</label><input id="em-end" value="' + esc(E.end) + '"></div><div class="field"><label for="em-cidade">Cidade</label><input id="em-cidade" value="' + esc(E.cidade) + '"></div>' +
      '<div class="field"><label for="em-tel">WhatsApp</label><input id="em-tel" inputmode="tel" value="' + esc(E.tel) + '"></div><div class="field"><label for="em-cnpj">CNPJ (opcional)</label><input id="em-cnpj" value="' + esc(E.cnpj) + '"></div></div>' +
      '<div class="field"><label for="em-email">E-mail</label><input id="em-email" inputmode="email" value="' + esc(E.email) + '"></div></section>' +
      '<section class="card"><h2>Histórico de preço</h2>' + (D.hist.length ? "<div>" + D.hist.map((h, i) => '<div class="row"><div><div class="t">' + esc(new Date(h.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })) + '</div><div class="s">Custo do 09x19x19 na Anapolina: ' + (((h.custos || {}).anapolina || {})["09x19x19"] != null ? brl(h.custos.anapolina["09x19x19"]) : "–") + '</div></div><button class="btn small" data-act="hist-usar" data-i="' + i + '">' + (confirmar === "h" + i ? "Toque de novo" : "Voltar pra esta") + "</button></div>").join("") + "</div>" : '<p class="hint">Cada vez que você salvar preços, a versão anterior fica aqui.</p>') + "</section>" : "") +
    '<section class="card"><h2>Conta</h2><p>' + esc(D.perfil.nome) + (ADM() ? " · administrador" : " · vendedor") + "</p>" +
    '<p class="hint">Versão do app: 1.0.' + (window.VERSAO_APP || 0) + "</p>" +
    (novaVersao ? '<div class="okmsg">Tem versão nova (1.0.' + novaVersao.n + ').</div><button class="btn primary full" data-act="atualizar-app">Atualizar agora</button>' + (atualizando ? '<p class="hint">' + esc(atualizando) + "</p>" : "") : (NATIVO ? '<button class="btn" data-act="procurar-versao">Procurar atualização</button>' : "")) +
    '<button class="btn" data-act="sair">Sair</button></section>';
}
async function salvarPrecos(novos) {
  const ant = { minimos: D.cfg.minimos, custos: D.cfg.custos || {}, cadastro: CAD() };
  const ops = [], agora = new Date().toISOString();
  if (novos.cadastro) ops.push(sb.from("config").upsert({ chave: "cadastro", dados: novos.cadastro, atualizado_em: agora }));
  if (novos.custos) ops.push(sb.from("config").upsert({ chave: "custos", dados: novos.custos, atualizado_em: agora }));
  if (novos.minimos) ops.push(sb.from("config").upsert({ chave: "minimos", dados: novos.minimos, atualizado_em: agora }));
  ops.push(sb.from("precos_hist").insert({ minimos: ant.minimos, custos: ant.custos, cadastro: ant.cadastro }));
  const r = await Promise.all(ops);
  if (r.some(x => x.error)) return false;
  if (novos.cadastro) D.cfg.cadastro = novos.cadastro; if (novos.custos) D.cfg.custos = novos.custos; if (novos.minimos) D.cfg.minimos = novos.minimos;
  await carregar(); return true;
}

/* ---------- foto da entrega ---------- */
async function tirarFoto(k) {
  const [id, i] = k.split("|"), c = acharCarga(id), el = () => document.getElementById("foto-" + k);
  try {
    const f = await Camera.getPhoto({ quality: 60, width: 1280, resultType: "base64", source: "CAMERA", saveToGallery: false });
    const bin = atob(f.base64String), bytes = new Uint8Array(bin.length); for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
    const caminho = id + "/" + i + "-" + Date.now() + ".jpg";
    if (el()) el().textContent = "Enviando a foto…";
    const up = await sb.storage.from("entregas").upload(caminho, new Blob([bytes], { type: "image/jpeg" }), { contentType: "image/jpeg" });
    if (up.error) throw up.error;
    const ents = copia(c.entregas); ents[+i].foto = caminho;
    const r = await sb.from("cargas").update({ entregas: ents }).eq("id", id); if (r.error) throw r.error;
    c.entregas = ents; fotos[k] = "data:image/jpeg;base64," + f.base64String; render();
  } catch (e) { if (!/cancel/i.test(String(e && e.message)) && el()) el().textContent = "Não deu pra salvar a foto. Confira a internet."; }
}
async function verFoto(k) {
  if (fotos[k]) { delete fotos[k]; render(); return; }
  const [id, i] = k.split("|"), c = acharCarga(id);
  const r = await sb.storage.from("entregas").createSignedUrl(c.entregas[+i].foto, 3600);
  if (r.error) { const el = document.getElementById("foto-" + k); if (el) el.textContent = "Não deu pra abrir a foto."; return; }
  fotos[k] = r.data.signedUrl; render();
}

/* ---------- sessão ---------- */
async function entrarComSessao(user) {
  const { data, error } = await sb.from("profiles").select("*").eq("id", user.id).single();
  if (error || !data) { await sb.auth.signOut(); D.perfil = null; render(); return; }
  const cache = ler("tt-cache", null);
  if (cache && cache.perfil && cache.perfil.id === data.id) D = Object.assign(vazio(), cache);
  D.perfil = data; Aparencia.aplicar(data.aparencia); render();
  await carregar(); render(); ouvirMudancas();
  procurarVersao().then(() => { if (novaVersao) render(); });
  if (NATIVO) { await pedirPermissoesCelular(); sincronizarCelular(); if (L.tab === "agenda") avisoAgendaCelular(); }
}
async function iniciar() { const { data } = await sb.auth.getSession(); if (data.session) await entrarComSessao(data.session.user); else render(); }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && D.perfil) { HOJE = ymd(new Date()); recarregarLogo(); } });

/* ---------- eventos ---------- */
document.getElementById("tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; L.tab = b.dataset.tab; confirmar = null; aviso = ""; cadastrando = null; editando = null; msgCfg = ""; salvarLocal(); render(); window.scrollTo(0, 0); if (L.tab === "agenda") avisoAgendaCelular(); });
document.getElementById("cfgbtn").addEventListener("click", () => { L.tab = L.tab === "config" ? "pedido" : "config"; confirmar = null; editando = null; msgCfg = ""; salvarLocal(); render(); window.scrollTo(0, 0); });
document.addEventListener("click", e => { const a = e.target.closest('a[target="_blank"]'); if (a && NATIVO) { e.preventDefault(); window.location.href = a.href; } });

main.addEventListener("input", e => {
  const t = e.target, id = t.id, v = t.value;
  if (id.startsWith("f-")) { L.form[id.slice(2)] = v;
    if (id === "f-cliente") { const cl = acharCli(v); if (cl && CAD().cidades.some(c => c.nome === cl.cidade)) { L.form.cidade = cl.cidade; document.getElementById("f-cidade").value = cl.cidade; } }
    salvarLocal(); updHint(); avisoErro("f-err", ""); }
  else if (t.dataset.tel != null) { const R = L.rascunho, g = grupos(R)[+t.dataset.tel]; g.idx.forEach(i => { R.entregas[i].tel = v; }); salvarLocal();
    const a = document.querySelector('[data-wa="' + t.dataset.tel + '"]'); if (a) a.href = waHref(v, waTexto(docCarga(), g)); }
  else if (id === "busca") { buscaCli = v; const pos = t.selectionStart; render(); const b = document.getElementById("busca"); if (b) { b.focus(); b.setSelectionRange(pos, pos); } }
  else if (id === "c-mil") avisoErro("calc-err", "");
  else if (id === "lg-senha") avisoErro("login-err", "");
});
let timerEmpresa = null;
main.addEventListener("change", async e => {
  const t = e.target, v = t.value;
  if (t.id === "ceramica") { L.rascunho.ceramica = v; salvarLocal(); render(); }
  else if (t.dataset.frete != null) { const R = L.rascunho; grupos(R)[+t.dataset.frete].idx.forEach(i => { R.entregas[i].freteOn = t.checked; }); salvarLocal(); render(); }
  else if (t.id.startsWith("em-")) { D.cfg.empresa[t.id.slice(3)] = v.trim(); clearTimeout(timerEmpresa); timerEmpresa = setTimeout(() => sb.from("config").upsert({ chave: "empresa", dados: D.cfg.empresa }), 300); }
  else if (t.dataset.status) { const c = acharCarga(t.dataset.status); if (c) { c.status = v; render(); const r = await sb.from("cargas").update({ status: v }).eq("id", c.id); if (!r.error) { await carregar(); render(); sincronizarCelular(); } } }
  else if (t.dataset.pag) { const [cid_, idxs] = t.dataset.pag.split("|"), c = acharCarga(cid_); if (!c) return; await marcarPagamento(c, idxs.split(",").map(Number), v); render(); }
});
async function fazerLogin() {
  const n = document.getElementById("lg-nome").value, p = document.getElementById("lg-senha").value, b = main.querySelector('[data-act="login"]');
  if (!p) { avisoErro("login-err", "Digite a senha."); return; }
  b.disabled = true; b.textContent = "Entrando…";
  const { data, error } = await sb.auth.signInWithPassword({ email: LOGINS[n], password: p });
  if (error) { b.disabled = false; b.textContent = "Entrar"; avisoErro("login-err", /invalid/i.test(error.message) ? "Senha errada. Confira e tente de novo." : "Sem conexão. Confira a internet."); return; }
  gravar("tt-ultimo", n); L = localNovo(); L.tab = n === "Bruno" ? "agenda" : "pedido"; salvarLocal();
  await entrarComSessao(data.user);
}
/* congela custo e frete na hora de agendar */
function congelar(R) {
  const c = { entregas: copia(R.entregas), ceramica: R.ceramica };
  grupos(c).forEach(g => { const f = freteGrupo(c, g); g.idx.forEach(i => { const e = c.entregas[i], fm = e.freteMil != null ? e.freteMil : freteMil(e); e.freteMil = fm; e.frete = f.cobrado > 0 ? r2(e.mil * fm) : 0; }); });
  return c.entregas;
}
main.addEventListener("click", async e => {
  const nova = Aparencia.clique(e.target);
  if (nova) { sb.rpc("salvar_aparencia", { a: nova }).then(() => {}); if (D.perfil) D.perfil.aparencia = nova; render(); return; }
  const b = e.target.closest("[data-act]"); if (!b) return; const a = b.dataset.act;
  if (a === "login") fazerLogin();
  else if (a === "ir-config") { L.tab = "config"; render(); window.scrollTo(0, 0); }
  else if (a === "add") {
    const F = L.form, mil = parseMil(F.mil), preco = parseNum(F.preco);
    if (!(mil > 0)) { avisoErro("f-err", "Coloque quantos milheiros vão nessa entrega."); return; }
    if (!(preco > 0)) { avisoErro("f-err", "Coloque o preço de venda do milheiro."); return; }
    const cl = acharCli(F.cliente), nome = F.cliente.trim(), ja = L.rascunho.entregas.find(x => norm(x.cliente) === norm(nome));
    L.rascunho.entregas.push({ cliente: nome, cidade: F.cidade, medida: F.medida, mil, preco, tel: cl ? cl.tel || "" : "", cpf: cl ? cl.cpf || "" : "", endc: cl ? cl.endereco || "" : "", freteOn: ja ? ja.freteOn !== false : true });
    L.form = { ...F, cliente: "", mil: "", preco: "" }; aviso = ""; salvarLocal(); render();
  }
  else if (a === "rm") { L.rascunho.entregas.splice(+b.dataset.i, 1); salvarLocal(); render(); }
  else if (a === "ir-docs") { if (!L.rascunho.entregas.length) { avisoErro("p-err", "Adicione pelo menos uma entrega."); return; } L.pedido.step = 2; comp = null; aviso = ""; salvarLocal(); render(); window.scrollTo(0, 0); }
  else if (a === "voltar-pedido") { L.pedido.step = 1; comp = null; salvarLocal(); render(); window.scrollTo(0, 0); }
  else if (a === "ir-agendar") { L.pedido.step = 3; L.pedido.dia = null; L.calPedido = HOJE.slice(0, 7); comp = null; salvarLocal(); render(); window.scrollTo(0, 0); }
  else if (a === "voltar-docs") { L.pedido.step = 2; salvarLocal(); render(); window.scrollTo(0, 0); }
  else if (a === "guardar") {
    const R = L.rascunho, o = { id: R.orcId || uid(), vendedor_id: D.perfil.id, vendedor: D.perfil.nome, ceramica: R.ceramica, entregas: copia(R.entregas) };
    b.disabled = true;
    const { error } = await sb.from("orcamentos").upsert(o);
    if (error) { b.disabled = false; avisoErro("g-err", "Não deu pra guardar. Confira a internet."); return; }
    L.rascunho = { ceramica: R.ceramica, entregas: [] }; L.pedido = { step: 1, dia: null }; L.ultima = null; aviso = "Orçamento guardado. Ele fica no topo desta tela até ser agendado.";
    salvarLocal(); await carregar(); render(); window.scrollTo(0, 0);
  }
  else if (a === "orc-abrir") {
    const id = b.dataset.id; if (L.rascunho.entregas.length && L.rascunho.orcId !== id && confirmar !== "abrir" + id) { confirmar = "abrir" + id; render(); return; }
    const o = D.orcs.find(x => x.id === id); confirmar = null; if (!o) return;
    L.rascunho = { ceramica: o.ceramica, entregas: copia(o.entregas), orcId: o.id }; L.pedido = { step: 2, dia: null }; aviso = ""; salvarLocal(); render(); window.scrollTo(0, 0);
  }
  else if (a === "orc-del") { const id = b.dataset.id; if (confirmar !== "del" + id) { confirmar = "del" + id; render(); return; } confirmar = null; await sb.from("orcamentos").delete().eq("id", id); D.orcs = D.orcs.filter(x => x.id !== id); render(); }
  else if (a === "pc-prev" || a === "pc-next") { L.calPedido = addMes(L.calPedido, a.endsWith("next") ? 1 : -1); salvarLocal(); render(); }
  else if (a === "pc-dia") { if (b.dataset.d < HOJE) return; L.pedido.dia = b.dataset.d; salvarLocal(); render(); }
  else if (a === "agendar") {
    if (!L.pedido.dia) { avisoErro("a-err", "Toque no dia da entrega no calendário."); return; }
    b.disabled = true; b.textContent = "Agendando…";
    const R = L.rascunho, c = { id: uid(), vendedor_id: D.perfil.id, vendedor: D.perfil.nome, ceramica: R.ceramica, data: L.pedido.dia, status: "Agendada", entregas: congelar(R) };
    const { error } = await sb.from("cargas").insert(c);
    if (error) { b.disabled = false; b.textContent = "Agendar para " + diaLabel(L.pedido.dia); avisoErro("a-err", "Não deu pra agendar. Confira a internet e tente de novo."); return; }
    if (R.orcId) await sb.from("orcamentos").delete().eq("id", R.orcId);
    D.cargas.push({ ...c, salva: true }); D.marcas.push({ id: c.id, data: c.data, vendedor: c.vendedor, cidades: c.entregas.map(x => x.cidade), milheiros: c.entregas.reduce((s, x) => s + x.mil, 0) });
    L.rascunho = { ceramica: R.ceramica, entregas: [] }; L.pedido = { step: 1, dia: null }; L.ultima = c.id;
    aviso = "Carga agendada para " + diaLabel(c.data) + "." + (Agenda ? " Já está no calendário do celular." : ""); salvarLocal(); render(); window.scrollTo(0, 0);
    sincronizarCelular(); recarregarLogo();
  }
  else if (a === "comp") { comp = { gi: +b.dataset.g, tipo: b.dataset.tipo }; render(); }
  else if (a === "comp-x") { comp = null; render(); }
  else if (a === "pdf") gerarPdf(+b.dataset.g, b.dataset.tipo);
  else if (a === "ac-prev" || a === "ac-next") { L.calAgenda = addMes(L.calAgenda, a.endsWith("next") ? 1 : -1); salvarLocal(); render(); }
  else if (a === "ac-dia") { L.diaAgenda = b.dataset.d; confirmar = null; salvarLocal(); render(); avisoAgendaCelular(); }
  else if (a === "liberar-agenda") { try { const r = await Agenda.pedirPermissao(); if (r.ok) { document.getElementById("agenda-aviso").innerHTML = ""; sincronizarAgenda(); } } catch (err) {} }
  else if (a === "del") {
    if (confirmar !== b.dataset.id) { confirmar = b.dataset.id; render(); return; }
    const id = b.dataset.id; confirmar = null;
    const { error } = await sb.from("cargas").delete().eq("id", id);
    if (!error) { D.cargas = D.cargas.filter(c => c.id !== id); D.marcas = D.marcas.filter(m => m.id !== id); sincronizarCelular(); }
    render();
  }
  else if (a === "ir-pedido") { L.tab = "pedido"; salvarLocal(); render(); }
  else if (a === "rel") abrirRelatorio(b.dataset.id, b.dataset.msg);
  else if (a === "tirar-foto") tirarFoto(b.dataset.k);
  else if (a === "ver-foto") verFoto(b.dataset.k);
  else if (a === "cad-abrir") { cadastrando = +b.dataset.i; render(); }
  else if (a === "cad-editar") { cadastrando = "e" + b.dataset.id; render(); }
  else if (a === "cad-cancel") { cadastrando = null; render(); }
  else if (a === "cad-salvar") {
    const n = document.getElementById("cn").value.trim(); if (!n) { avisoErro("c-err", "Coloque o nome do cliente."); return; }
    const outro = acharCli(n); if (outro && String(outro.id) !== String(b.dataset.id)) { avisoErro("c-err", "Já tem um cliente com esse nome."); return; }
    const row = { nome: n, tel: document.getElementById("ct").value.trim(), cidade: document.getElementById("cc").value, cpf: document.getElementById("cpfc").value.trim(), endereco: document.getElementById("ce").value.trim() };
    const r = b.dataset.id ? await sb.from("clientes").update(row).eq("id", b.dataset.id).select().single() : await sb.from("clientes").insert(row).select().single();
    if (r.error) { avisoErro("c-err", /duplicate|unique/i.test(r.error.message) ? "Já tem um cliente com esse nome." : "Não deu pra salvar. Confira a internet."); return; }
    D.clientes = D.clientes.filter(x => x.id !== r.data.id).concat([r.data]).sort((x, y) => x.nome.localeCompare(y.nome)); cadastrando = null; render();
  }
  else if (a === "cadd") { const mil = parseMil(document.getElementById("c-mil").value); if (!(mil > 0)) { avisoErro("calc-err", "Coloque a quantidade de milheiros."); return; } L.calc.push({ mil, medida: document.getElementById("c-medida").value }); salvarLocal(); render(); }
  else if (a === "crm") { L.calc.splice(+b.dataset.i, 1); salvarLocal(); render(); }
  else if (a === "climpar") { L.calc = []; salvarLocal(); render(); }
  else if (a === "rm-prev" || a === "rm-next") { L.mesResumo = addMes(L.mesResumo, a.endsWith("next") ? 1 : -1); salvarLocal(); render(); }
  else if (a === "sair") {
    if (canal) sb.removeChannel(canal);
    await sb.auth.signOut(); D = vazio(); gravar("tt-cache", null); L = localNovo(); salvarLocal(); render(); window.scrollTo(0, 0);
  }
  else if (a === "procurar-versao") { await procurarVersao(); msgCfg = novaVersao ? "Tem versão nova!" : "Você já está na versão mais nova."; render(); }
  else if (a === "atualizar-app") {
    if (!novaVersao || !Atual) return;
    atualizando = "Baixando a versão nova…"; render();
    try { await Atual.atualizar({ url: novaVersao.url }); atualizando = "Toque em Instalar na tela do Android."; }
    catch (err) { atualizando = String(err && err.message).includes("PERMITIR") ? "Libere \"Instalar apps desconhecidos\" pro Tijolos Tavares e toque em Atualizar de novo." : "Não deu pra baixar. Confira a internet e tente de novo."; }
    render();
  }
  /* cadastros */
  else if (a === "md-salvar") {
    const medidas = [], custos = copia(D.cfg.custos || {}), minimos = copia(D.cfg.minimos); custos.regiao = custos.regiao || {};
    for (let i = 0; i < CAD().medidas.length; i++) {
      const m = CAD().medidas[i], pf = lerNum("md-" + i + "-pf"), fi = lerNum("md-" + i + "-fi"), c = lerNum("md-" + i + "-c"), mn = [lerNum("md-" + i + "-m1"), lerNum("md-" + i + "-m2"), lerNum("md-" + i + "-m3")];
      if (!(pf > 0) || !(fi > 0)) { avisoErro("md-err", "Na medida " + m.nome + ", coloque peças por fiada e fiadas na carga."); return; }
      if ([c, ...mn].some(x => Number.isNaN(x))) { avisoErro("md-err", "Tem um valor errado na medida " + m.nome + ". Use só números."); return; }
      medidas.push({ nome: m.nome, pf: Math.round(pf), fiadas: Math.round(fi) });
      if (c != null) custos.regiao[m.nome] = c; else delete custos.regiao[m.nome];
      if (mn.some(x => x != null)) minimos[m.nome] = mn; else delete minimos[m.nome];
    }
    avisoErro("md-err", "Salvando…");
    const ok = await salvarPrecos({ cadastro: { ...CAD(), medidas }, custos, minimos });
    editando = "med"; if (!ok) { avisoErro("md-err", "Não deu pra salvar. Confira a internet."); return; } msgCfg = "Medidas e preços salvos."; render();
  }
  else if (a === "md-add") {
    const nome = document.getElementById("nm-nome").value.trim(), pf = lerNum("nm-pf"), fi = lerNum("nm-fi"), c = lerNum("nm-c"), mn = [lerNum("nm-m1"), lerNum("nm-m2"), lerNum("nm-m3")];
    if (!nome) { avisoErro("nm-err", "Coloque o nome da medida."); return; }
    if (CAD().medidas.some(m => norm(m.nome) === norm(nome))) { avisoErro("nm-err", "Essa medida já existe."); return; }
    if (!(pf > 0) || !(fi > 0)) { avisoErro("nm-err", "Coloque peças por fiada e fiadas na carga."); return; }
    if ([c, ...mn].some(x => Number.isNaN(x))) { avisoErro("nm-err", "Tem um valor errado. Use só números."); return; }
    const custos = copia(D.cfg.custos || {}), minimos = copia(D.cfg.minimos); custos.regiao = custos.regiao || {};
    if (c != null) custos.regiao[nome] = c; if (mn.some(x => x != null)) minimos[nome] = mn;
    const ok = await salvarPrecos({ cadastro: { ...CAD(), medidas: CAD().medidas.concat([{ nome, pf: Math.round(pf), fiadas: Math.round(fi) }]) }, custos, minimos });
    editando = "med"; if (!ok) { avisoErro("nm-err", "Não deu pra salvar."); return; } msgCfg = "Medida " + nome + " adicionada."; render();
  }
  else if (a === "md-del") { const i = +b.dataset.i; if (confirmar !== "md" + i) { confirmar = "md" + i; editando = "med"; render(); return; } confirmar = null; await salvarPrecos({ cadastro: { ...CAD(), medidas: CAD().medidas.filter((x, j) => j !== i) } }); editando = "med"; render(); }
  else if (a === "cd-salvar") {
    const cidades = [];
    for (let i = 0; i < CAD().cidades.length; i++) {
      const c = CAD().cidades[i], r = +document.getElementById("cd-" + i + "-r").value, fa = lerNum("cd-" + i + "-a"), fb = lerNum("cd-" + i + "-b");
      if (fa == null || fb == null || Number.isNaN(fa) || Number.isNaN(fb)) { avisoErro("cd-err", "Coloque o frete de " + c.nome + " nas duas colunas."); return; }
      cidades.push({ ...c, r, f108: fa, f72: fb });
    }
    const ok = await salvarPrecos({ cadastro: { ...CAD(), cidades } }); editando = "cid"; if (!ok) { avisoErro("cd-err", "Não deu pra salvar."); return; } msgCfg = "Cidades salvas."; render();
  }
  else if (a === "cd-add") {
    const nome = document.getElementById("nc-nome").value.trim(), r = +document.getElementById("nc-r").value, fa = lerNum("nc-a"), fb = lerNum("nc-b");
    if (!nome) { avisoErro("nc-err", "Coloque o nome da cidade."); return; }
    if (CAD().cidades.some(c => norm(c.nome) === norm(nome))) { avisoErro("nc-err", "Essa cidade já existe."); return; }
    if (Number.isNaN(fa) || Number.isNaN(fb)) { avisoErro("nc-err", "O frete tem que ser um número."); return; }
    const ok = await salvarPrecos({ cadastro: { ...CAD(), cidades: CAD().cidades.concat([{ nome, r, lat: null, lng: null, f108: fa ?? FRETE_PADRAO[r][0], f72: fb ?? FRETE_PADRAO[r][1] }]) } });
    editando = "cid"; if (!ok) { avisoErro("nc-err", "Não deu pra salvar."); return; } msgCfg = "Cidade " + nome + " adicionada."; render();
  }
  else if (a === "cd-del") { const i = +b.dataset.i; if (confirmar !== "cd" + i) { confirmar = "cd" + i; editando = "cid"; render(); return; } confirmar = null; await salvarPrecos({ cadastro: { ...CAD(), cidades: CAD().cidades.filter((x, j) => j !== i) } }); editando = "cid"; render(); }
  else if (a === "fo-salvar") {
    const fi = +b.dataset.i, f = CAD().fornecedores[fi], nome = document.getElementById("fo-" + fi + "-n").value.trim(), origem = document.getElementById("fo-" + fi + "-o").value.trim(), precos = {};
    if (!nome) { avisoErro("fo-" + fi + "-err", "Coloque o nome do fornecedor."); return; }
    for (let mi = 0; mi < CAD().medidas.length; mi++) { const v = lerNum("fo-" + fi + "-" + mi); if (Number.isNaN(v)) { avisoErro("fo-" + fi + "-err", "Tem um valor errado em " + CAD().medidas[mi].nome + "."); return; } if (v != null) precos[CAD().medidas[mi].nome] = v; }
    const custos = copia(D.cfg.custos || {}); custos[f.id] = precos;
    const ok = await salvarPrecos({ cadastro: { ...CAD(), fornecedores: CAD().fornecedores.map((x, j) => j === fi ? { ...x, nome, origem: origem || "Anápolis - GO" } : x) }, custos });
    editando = "forn"; if (!ok) { avisoErro("fo-" + fi + "-err", "Não deu pra salvar."); return; } msgCfg = nome + " salvo."; render();
  }
  else if (a === "fo-add") {
    const nome = document.getElementById("nf-nome").value.trim(), o = document.getElementById("nf-o").value.trim();
    if (!nome) { avisoErro("nf-err", "Coloque o nome do fornecedor."); return; }
    if (CAD().fornecedores.some(f => norm(f.nome) === norm(nome))) { avisoErro("nf-err", "Esse fornecedor já existe."); return; }
    const ok = await salvarPrecos({ cadastro: { ...CAD(), fornecedores: CAD().fornecedores.concat([{ id: slug(nome) + "-" + uid().slice(-4), nome, origem: o ? nome + ", " + o : "Anápolis - GO" }]) } });
    editando = "forn"; if (!ok) { avisoErro("nf-err", "Não deu pra salvar."); return; } msgCfg = nome + " adicionado. Abra ele pra colocar os preços."; render();
  }
  else if (a === "fo-del") { const i = +b.dataset.i; if (confirmar !== "fo" + i) { confirmar = "fo" + i; editando = "forn"; render(); return; } confirmar = null; await salvarPrecos({ cadastro: { ...CAD(), fornecedores: CAD().fornecedores.filter((x, j) => j !== i) } }); editando = "forn"; render(); }
  else if (a === "hist-usar") {
    const i = +b.dataset.i; if (confirmar !== "h" + i) { confirmar = "h" + i; render(); return; } confirmar = null;
    const h = D.hist[i]; const ok = await salvarPrecos({ minimos: h.minimos, custos: h.custos, cadastro: h.cadastro || undefined });
    msgCfg = ok ? "Preços de volta pra versão de " + new Date(h.criado_em).toLocaleDateString("pt-BR") + "." : ""; render();
  }
});

iniciar();
