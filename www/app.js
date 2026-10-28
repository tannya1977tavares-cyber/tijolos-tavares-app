"use strict";
/* Tijolos Tavares · app de pedidos, cargas e agenda */

const SB_URL = "https://fgjgtpeptzflhuaklzuz.supabase.co";
const SB_KEY = "sb_publishable_r0gOq_JU2KeAYeFlU2mSTA_znMnud8n";
const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

const NATIVO = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
function plugin(nome) {
  if (!NATIVO) return null;
  try {
    if (window.capacitorExports && window.capacitorExports.registerPlugin) return window.capacitorExports.registerPlugin(nome);
    if (window.Capacitor.registerPlugin) return window.Capacitor.registerPlugin(nome);
  } catch (e) {}
  return (window.Capacitor.Plugins || {})[nome] || null;
}
const Notif = plugin("LocalNotifications"), Camera = plugin("Camera"), FS = plugin("Filesystem"), Share = plugin("Share"), Agenda = plugin("AgendaCelular");

/* ---------- dados fixos ---------- */
const LOGINS = { Bruno: "bruno@tijolostavares.app", Rafael: "rafael@tijolostavares.app", Wolney: "wolney@tijolostavares.app" };
const MEDIDAS = ["09x14x24","09x14x24 REQ","09x19x19","09x19x19 REQ","09x19x29","11,5x19x19","11,5x19x19 REQ","11,5x19x29","11,5x19x29 REQ","14x19x19","14x19x29","19x19x19","19x19x29","4,3x8x18 maciço","5x9x19 maciço"];
const PORFIADA = {"09x14x24":84,"09x19x19":84,"09x19x29":84,"11,5x19x19":65,"11,5x19x29":65,"14x19x19":54,"14x19x29":54,"19x19x19":39,"19x19x29":39,"4,3x8x18":175,"5x9x19":151};
const CAP = {"4,3x8x18":115,"5x9x19":115};
const base = m => m.replace(" REQ","").replace(" maciço","");
const capac = m => CAP[base(m)] || (base(m).endsWith("x29") ? 72 : 108);
const CERAMICAS = {anapolina:{nome:"Cerâmica Anapolina",origem:"Cerâmica Anapolina, Anápolis - GO"},outra:{nome:"Outra cerâmica (tabela da região)",origem:"Anápolis - GO"}};
const REGIOES = {1:"Anápolis",2:"Goiânia e região",3:"Brasília"};
const CIDADES = {
  "Anápolis":{r:1,lat:-16.3281,lng:-48.9534},
  "Goiânia":{r:2,lat:-16.6869,lng:-49.2648},
  "Aparecida de Goiânia":{r:2,lat:-16.8198,lng:-49.2469},
  "Trindade":{r:2,lat:-16.6517,lng:-49.4927},
  "Senador Canedo":{r:2,lat:-16.7084,lng:-49.0914},
  "Goianira":{r:2,lat:-16.4947,lng:-49.4262},
  "Brasília":{r:3,lat:-15.7939,lng:-47.8828}};
const ORIGEM = {lat:-16.3281,lng:-48.9534};
const STATUS = ["Agendada","Carregada","Entregue"];
const PAGS = ["A receber","Pago","Fiado"];
const FPAGS = ["PIX","Dinheiro","Transferência","Boleto","Cartão"];

/* ---------- utilidades ---------- */
const brl = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:0});
const brl2 = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2,maximumFractionDigits:2});
const n1 = v => v.toLocaleString("pt-BR",{maximumFractionDigits:2});
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const parseNum = s => { const v = parseFloat(String(s).replace(/\./g,"").replace(",",".")); return isFinite(v) ? v : NaN; };
const parseMil = s => { const v = parseFloat(String(s).replace(",",".")); return isFinite(v) ? v : NaN; };
const ymd = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const pd = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
let HOJE = ymd(new Date());
const diaLabel = s => pd(s).toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"2-digit"});
const diaCurto = s => pd(s).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"});
const diaLongo = s => pd(s).toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"});
const dataBR = s => s.split("-").reverse().join("/");
const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
const mesLabel = k => cap(pd(k+"-01").toLocaleDateString("pt-BR",{month:"long",year:"numeric"}));
const addMes = (k,n) => { const d = pd(k+"-01"); d.setMonth(d.getMonth()+n); return ymd(d).slice(0,7); };
const addDias = (s,n) => { const d = pd(s); d.setDate(d.getDate()+n); return ymd(d); };
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const norm = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").trim().toLowerCase();
const slug = s => norm(s).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "cliente";
const ler = (k,padrao) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? padrao; } catch(e) { return padrao; } };
const gravar = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} };

/* ---------- estado ---------- */
// L = o que fica só neste celular (rascunho do pedido, abas, calculadora)
function localNovo(){ return {tab:"pedido",rascunho:{ceramica:"anapolina",entregas:[]},form:{cliente:"",cidade:"Goiânia",medida:"09x19x19",mil:"",preco:""},pedido:{step:1,dia:null,cargaId:null},calPedido:HOJE.slice(0,7),calAgenda:HOJE.slice(0,7),diaAgenda:HOJE,mesResumo:HOJE.slice(0,7),calc:[]}; }
let L = Object.assign(localNovo(), ler("tt-local", {}));
const salvarLocal = () => gravar("tt-local", L);
// D = o que vem do banco (compartilhado entre todos)
let D = {perfil:null,cargas:[],marcas:[],admin:{},clientes:[],cfg:{minimos:{},custos:null,empresa:{}},hist:[]};
let erroRede = "", carregou = false;
const ADM = () => !!(D.perfil && D.perfil.admin);
const acharCli = n => D.clientes.find(c => norm(c.nome) === norm(n));
const acharCarga = id => D.cargas.find(c => c.id === id);

/* ---------- preços ---------- */
function custoAtual(cer,m){
  const C = D.cfg.custos; if (!C) return null;
  if (cer === "anapolina" && C.anapolina && C.anapolina[m] != null) return {v:C.anapolina[m],f:"Anapolina"};
  if (C.regiao && C.regiao[m] != null) return {v:C.regiao[m],f:"tabela da região"};
  return null;
}
function minimo(m,r){ const x = D.cfg.minimos[m]; return x && x[r-1] != null ? x[r-1] : null; }
function calcEntrega(e,cer,cargaId,i){
  let cm = 0;
  if (ADM()) {
    const snap = cargaId && D.admin[cargaId] && D.admin[cargaId].custos;
    if (snap && snap[i] != null && snap[i] > 0) cm = snap[i];
    else { const c = custoAtual(cer,e.medida); cm = c ? c.v : 0; }
  }
  const min = minimo(e.medida, CIDADES[e.cidade].r);
  const fiadas = Math.ceil(e.mil*1000/PORFIADA[base(e.medida)]);
  return {cm,min,fiadas,occ:fiadas/capac(e.medida),custo:cm*e.mil,venda:e.preco*e.mil,abaixo:min!=null&&e.preco<min};
}
function resumo(carga){
  const r = {mil:0,fiadas:0,occ:0,custo:0,venda:0,abaixo:0};
  carga.entregas.forEach((e,i) => { const c = calcEntrega(e,carga.ceramica,carga.id,i); r.mil+=e.mil; r.fiadas+=c.fiadas; r.occ+=c.occ; r.custo+=c.custo; r.venda+=c.venda; if (c.abaixo) r.abaixo++; });
  r.lucro = r.venda-r.custo; r.margem = r.venda ? r.lucro/r.venda : 0; r.pct = Math.round(r.occ*100); return r;
}
const pagDe = (c,i) => ((D.admin[c.id] && D.admin[c.id].pags) || [])[i] || "A receber";

/* ---------- rota ---------- */
function dist(a,b){ const dx=(a.lng-b.lng)*Math.cos((a.lat+b.lat)*Math.PI/360), dy=a.lat-b.lat; return Math.sqrt(dx*dx+dy*dy); }
function ordemCidades(cidades){
  const cid = [...new Set(cidades)].filter(c => CIDADES[c]), out = []; let pos = ORIGEM;
  while (cid.length) { let bi = 0; cid.forEach((c,i) => { if (dist(pos,CIDADES[c]) < dist(pos,CIDADES[cid[bi]])) bi = i; }); const c = cid.splice(bi,1)[0]; out.push(c); pos = CIDADES[c]; }
  return out;
}
const ordemRota = entregas => ordemCidades(entregas.map(e => e.cidade));
const uf = c => c === "Brasília" ? " - DF" : " - GO";
function mapsUrl(carga){
  const o = ordemRota(carga.entregas); if (!o.length) return "#";
  let u = "https://www.google.com/maps/dir/?api=1&travelmode=driving&origin="+encodeURIComponent(CERAMICAS[carga.ceramica].origem)+"&destination="+encodeURIComponent(o[o.length-1]+uf(o[o.length-1]));
  if (o.length > 1) u += "&waypoints="+encodeURIComponent(o.slice(0,-1).map(c => c+uf(c)).join("|"));
  return u;
}

/* ---------- banco ---------- */
async function carregar(){
  const de = addDias(HOJE,-120), ate = addDias(HOJE,365);
  const q = [
    sb.from("cargas").select("*").order("data"),
    sb.rpc("agenda_marcas",{de,ate}),
    sb.from("clientes").select("*").order("nome"),
    sb.from("config").select("chave,dados")
  ];
  if (ADM()) { q.push(sb.from("carga_admin").select("*")); q.push(sb.from("precos_hist").select("*").order("criado_em",{ascending:false}).limit(30)); }
  const r = await Promise.all(q);
  const erro = r.find(x => x.error);
  if (erro) { erroRede = "Sem conexão com o servidor. Mostrando o que já estava salvo."; return false; }
  erroRede = "";
  D.cargas = (r[0].data || []).map(c => ({...c, data:String(c.data).slice(0,10), entregas:c.entregas||[]}));
  D.marcas = (r[1].data || []).map(m => ({...m, data:String(m.data).slice(0,10)}));
  D.clientes = r[2].data || [];
  const cfg = {}; (r[3].data || []).forEach(x => { cfg[x.chave] = x.dados; });
  D.cfg = {minimos:cfg.minimos||{}, custos:cfg.custos||null, empresa:cfg.empresa||{}};
  if (ADM()) { D.admin = {}; (r[4].data || []).forEach(a => { D.admin[a.carga_id] = a; }); D.hist = r[5].data || []; }
  gravar("tt-cache", D); carregou = true;
  return true;
}
let timerRecarga = null;
function recarregarLogo(){
  clearTimeout(timerRecarga);
  timerRecarga = setTimeout(async () => { await carregar(); renderSeguro(); sincronizarCelular(); }, 400);
}
let canal = null;
function ouvirMudancas(){
  if (canal) sb.removeChannel(canal);
  canal = sb.channel("tudo");
  ["cargas","carga_admin","clientes","config"].forEach(t => canal.on("postgres_changes",{event:"*",schema:"public",table:t}, recarregarLogo));
  canal.subscribe();
}
const avisoErro = (el,msg) => { const x = document.getElementById(el); if (x) x.textContent = msg; };
const timersEntregas = {};
function salvarEntregasDepois(c){
  clearTimeout(timersEntregas[c.id]);
  timersEntregas[c.id] = setTimeout(() => { sb.from("cargas").update({entregas:c.entregas}).eq("id",c.id).then(({error}) => { if (error) erroRede = "Não deu pra salvar. Confira a internet."; }); }, 700);
}

/* ---------- celular: calendário e lembretes ---------- */
async function pedirPermissoesCelular(){
  if (Notif) { try { const p = await Notif.checkPermissions(); if (p.display !== "granted") await Notif.requestPermissions(); } catch(e) {} }
  if (Agenda) { try { await Agenda.pedirPermissao(); } catch(e) {} }
}
async function sincronizarCelular(){ await sincronizarAgenda(); await agendarLembretes(); }
async function agendaLiberada(){ if (!Agenda) return false; try { return (await Agenda.temPermissao()).ok; } catch(e) { return false; } }
async function sincronizarAgenda(){
  if (!(await agendaLiberada())) return;
  const mapa = ler("tt-agenda",{}), vivos = new Set(D.cargas.map(c => c.id)), limite = addDias(HOJE,-30);
  for (const c of D.cargas) {
    if (c.data < limite) continue;
    const mil = c.entregas.reduce((s,e) => s+e.mil, 0);
    const titulo = (c.status === "Entregue" ? "Entregue: " : "Entrega: ")+ordemRota(c.entregas).join(" > ")+" ("+n1(mil)+" mil)";
    const desc = c.entregas.map(e => "- "+(e.cliente||"Sem nome")+" · "+e.cidade+" · "+e.medida+" · "+n1(e.mil)+" mil").join("\n")+"\nVendedor: "+c.vendedor+"\nSituação: "+c.status;
    const h = titulo+"|"+desc+"|"+c.data;
    if (mapa[c.id] && mapa[c.id].h === h) continue;
    try { const r = await Agenda.salvar({eventoId:mapa[c.id] ? mapa[c.id].ev : "", titulo, descricao:desc, data:c.data}); mapa[c.id] = {ev:r.eventoId, h}; } catch(e) {}
  }
  for (const id of Object.keys(mapa)) if (!vivos.has(id)) { try { await Agenda.apagar({eventoId:mapa[id].ev}); } catch(e) {} delete mapa[id]; }
  gravar("tt-agenda", mapa);
}
async function agendarLembretes(){
  if (!Notif) return;
  try {
    const p = await Notif.checkPermissions(); if (p.display !== "granted") return;
    const pend = await Notif.getPending();
    if (pend.notifications && pend.notifications.length) await Notif.cancel({notifications:pend.notifications.map(n => ({id:n.id}))});
    const porDia = {};
    D.cargas.filter(c => c.status !== "Entregue" && c.data >= HOJE).forEach(c => { (porDia[c.data] = porDia[c.data] || []).push(c); });
    const lista = [], agora = new Date();
    Object.keys(porDia).sort().slice(0,40).forEach(d => {
      const cs = porDia[d], cid = ordemCidades(cs.flatMap(c => c.entregas.map(e => e.cidade))), mil = cs.reduce((s,c) => s+c.entregas.reduce((a,e) => a+e.mil,0), 0);
      const corpo = cs.length+" carga(s): "+cid.join(", ")+" · "+n1(mil)+" milheiros";
      const n = Number(d.replace(/-/g,"").slice(2));
      const manha = pd(d); manha.setHours(7,0,0,0);
      const vespera = pd(d); vespera.setDate(vespera.getDate()-1); vespera.setHours(18,0,0,0);
      if (manha > agora) lista.push({id:n*10+1, title:"Entregas de hoje", body:corpo, schedule:{at:manha}});
      if (vespera > agora) lista.push({id:n*10+2, title:"Entregas de amanhã", body:corpo, schedule:{at:vespera}});
    });
    if (lista.length) await Notif.schedule({notifications:lista});
  } catch(e) {}
}

/* ---------- desenho ---------- */
const main = document.getElementById("main");
let comp = null, confirmar = null, aviso = "", cadastrando = null, buscaCli = "", fotos = {}, renderPendente = false, editandoTabela = null;

function renderSeguro(){
  const a = document.activeElement;
  if (a && main.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) { renderPendente = true; return; }
  render();
}
main.addEventListener("focusout", () => { setTimeout(() => { if (renderPendente) { const a = document.activeElement; if (!(a && main.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName))) { renderPendente = false; render(); } } }, 50); });

function render(){
  const nav = document.getElementById("nav"), ub = document.getElementById("userbtn");
  if (!D.perfil) { nav.hidden = true; ub.hidden = true; main.innerHTML = vLogin(); return; }
  nav.hidden = false; ub.hidden = false; ub.textContent = D.perfil.nome+(ADM()?" · adm":"")+" · sair";
  const tabs = [["pedido","Pedido"],["agenda","Agenda"],["clientes","Clientes"],["ferramentas","Ferramentas"]];
  if (ADM()) tabs.push(["painel","Painel"]);
  if (!tabs.some(t => t[0] === L.tab)) L.tab = "pedido";
  const abertas = D.cargas.filter(c => c.status !== "Entregue").length;
  document.getElementById("tabs").innerHTML = tabs.map(([k,l]) => '<button data-tab="'+k+'" aria-current="'+(k===L.tab?"page":"false")+'">'+l+(k==="agenda"&&abertas?'<span class="n">'+abertas+"</span>":"")+"</button>").join("");
  main.innerHTML = (erroRede ? '<div class="banner" role="status">'+esc(erroRede)+"</div>" : "") + ({pedido:vPedido,agenda:vAgenda,clientes:vClientes,ferramentas:vFerramentas,painel:vPainel})[L.tab]();
  if (L.tab === "pedido" && L.pedido.step === 1) updHint();
}
const opts = (list,sel) => list.map(v => '<option value="'+esc(v)+'"'+(v===sel?" selected":"")+">"+esc(v)+"</option>").join("");
const corOcc = p => p > 100 ? "var(--danger)" : p >= 90 ? "var(--warn)" : "var(--ok)";
function barraCaminhao(r){
  return '<div><div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px"><span>Caminhão</span><strong style="color:'+corOcc(r.pct)+'">'+r.pct+'% ocupado</strong></div><div class="bar"><div style="width:'+Math.min(r.pct,100)+'%;background:'+corOcc(r.pct)+'"></div></div></div>'+
    (r.pct > 100 ? '<div class="warnmsg" role="status">Essa carga está em '+r.pct+'% do caminhão. Já passou do limite em '+(r.pct-100)+'%. Dá pra agendar assim mesmo.</div>' : '<p class="hint">Ainda cabe '+(100-r.pct)+'% no caminhão.</p>');
}
function resumoHtml(r){
  if (!ADM()) return '<div class="stats"><div class="stat"><div class="l">Milheiros</div><div class="v">'+n1(r.mil)+'</div></div><div class="stat"><div class="l">Fiadas</div><div class="v">'+r.fiadas+'</div></div><div class="stat" style="grid-column:1/-1"><div class="l">Valor da venda</div><div class="v">'+brl(r.venda)+"</div></div></div>"+barraCaminhao(r);
  return '<div class="stats"><div class="stat"><div class="l">Milheiros</div><div class="v">'+n1(r.mil)+'</div></div><div class="stat"><div class="l">Fiadas</div><div class="v">'+r.fiadas+'</div></div>'+
    '<div class="stat"><div class="l">Custo</div><div class="v">'+brl(r.custo)+'</div></div><div class="stat"><div class="l">Venda</div><div class="v">'+brl(r.venda)+'</div></div>'+
    '<div class="stat" style="grid-column:1/-1"><div class="l">Lucro da carga</div><div class="v '+(r.lucro>=0?"pos":"neg")+'">'+brl(r.lucro)+' <span class="hint" style="display:inline">('+Math.round(r.margem*100)+'% da venda)</span></div></div></div>'+barraCaminhao(r);
}
function rotaHtml(carga,link){
  const o = ordemRota(carga.entregas); if (!o.length) return "";
  return '<div class="rota"><span class="p o">'+esc(CERAMICAS[carga.ceramica].nome.split(" (")[0])+"</span>"+o.map(c => '<span class="a" aria-hidden="true">→</span><span class="p">'+esc(c)+"</span>").join("")+"</div>"+
    (link ? '<a class="btn small" href="'+mapsUrl(carga)+'" target="_blank" rel="noopener">Abrir rota no Google Maps</a>' : "");
}
function entregaRow(e,c,i,opt){
  opt = opt || {}; const k = calcEntrega(e,c.ceramica,c.id,i), pag = opt.pag ? pagDe(c,i) : null;
  return '<div class="row"><div style="min-width:0;flex:1"><div class="t">'+esc(e.cliente||"Sem nome")+" · "+esc(e.cidade)+'</div><div class="s">'+esc(e.medida)+" · "+n1(e.mil)+" mil · "+brl(e.preco)+"/mil · "+k.fiadas+" fiadas</div>"+
    ((k.abaixo||pag) ? '<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">'+(k.abaixo?'<span class="chip red">Abaixo do mínimo de '+brl(k.min)+"</span>":"")+(pag?'<span class="chip '+(pag==="Pago"?"green":pag==="Fiado"?"red":"amber")+'">'+esc(pag)+"</span>":"")+"</div>" : "")+
    (opt.foto ? fotoHtml(c,i) : "")+"</div>"+
    (opt.rm ? '<button class="btn small" data-act="rm" data-i="'+i+'">Remover</button>' : "")+"</div>";
}
function fotoHtml(c,i){
  const e = c.entregas[i], k = c.id+"|"+i;
  let h = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">';
  if (e.foto) h += '<button class="btn small" data-act="ver-foto" data-k="'+esc(k)+'">'+(fotos[k]?"Esconder foto":"Ver foto da entrega")+"</button>";
  if (Camera) h += '<button class="btn small" data-act="tirar-foto" data-k="'+esc(k)+'">'+(e.foto?"Trocar foto":"Foto da entrega")+"</button>";
  h += "</div>"+'<p class="err" id="foto-'+esc(k)+'"></p>';
  if (fotos[k]) h += '<img class="foto" src="'+esc(fotos[k])+'" alt="Foto da entrega de '+esc(e.cliente||"")+'">';
  return h;
}

/* ---------- login ---------- */
function vLogin(){
  return '<div style="display:flex;justify-content:center"><img src="icon.png" alt="" width="96" height="96"></div><h1 style="text-align:center">Entrar</h1>'+
    '<section class="card"><div class="field"><label for="lg-nome">Usuário</label><select id="lg-nome">'+opts(Object.keys(LOGINS), ler("tt-ultimo","Bruno"))+"</select></div>"+
    '<div class="field"><label for="lg-senha">Senha</label><input id="lg-senha" type="password" autocomplete="current-password"></div><p class="err" id="login-err"></p>'+
    '<button class="btn primary full" data-act="login">Entrar</button></section>';
}

/* ---------- calendário do app ---------- */
const regioesDe = cidades => [...new Set(cidades.filter(c => CIDADES[c]).map(c => CIDADES[c].r))].sort();
function marcasDia(){ const m = {}; D.marcas.forEach(x => { (m[x.data] = m[x.data] || []).push(...regioesDe(x.cidades||[])); }); return m; }
function calendario(mes,sel,px,bloqPassado){
  const mk = marcasDia(), d0 = pd(mes+"-01"), ini = d0.getDay(), dias = new Date(d0.getFullYear(), d0.getMonth()+1, 0).getDate();
  let h = '<div class="calhead"><button class="btn small ghost" data-act="'+px+'-prev" aria-label="Mês anterior">‹</button><h3>'+esc(mesLabel(mes))+'</h3><button class="btn small ghost" data-act="'+px+'-next" aria-label="Próximo mês">›</button></div><div class="cal">'+
    ["D","S","T","Q","Q","S","S"].map(w => '<div class="wd">'+w+"</div>").join("")+"<div></div>".repeat(ini);
  for (let i = 1; i <= dias; i++) {
    const k = mes+"-"+String(i).padStart(2,"0"), past = k < HOJE, marks = (mk[k]||[]).slice(0,4);
    h += '<button data-act="'+px+'-dia" data-d="'+k+'" class="'+(k===HOJE?"today ":"")+(k===sel?"sel ":"")+(past&&bloqPassado?"past":"")+'" aria-label="'+esc(diaLabel(k))+((mk[k]||[]).length?", tem entrega":"")+'"><span class="nr">'+i+'</span><span class="mk">'+marks.map(r => '<i style="background:var(--r'+r+')"></i>').join("")+"</span></button>";
  }
  return h+'</div><div class="legend"><span><i style="background:var(--r1)"></i>Anápolis</span><span><i style="background:var(--r2)"></i>Goiânia e região</span><span><i style="background:var(--r3)"></i>Brasília</span></div>';
}
function linhaMarca(m){
  return '<div class="row"><div style="min-width:0"><div class="t">'+esc(ordemCidades(m.cidades||[]).join(" → "))+'</div><div class="s">'+esc(m.vendedor)+" · "+n1(Number(m.milheiros)||0)+" mil</div></div></div>";
}

/* ---------- pedido ---------- */
function steps(n){ return '<div class="steps">'+["1. Pedido","2. Agendar","3. Orçamento ou recibo"].map((l,i) => '<div class="'+(i+1===n?"on":i+1<n?"done":"")+'">'+l+"</div>").join("")+"</div>"; }
function vPedido(){
  if (L.pedido.step === 2) return vAgendar();
  if (L.pedido.step === 3) return vDocs();
  const R = L.rascunho, F = L.form, r = resumo(R);
  return steps(1)+(aviso ? '<div class="okmsg" role="status">'+esc(aviso)+"</div>" : "")+
    '<section class="card"><div class="field"><label for="ceramica">Cerâmica onde vai carregar</label><select id="ceramica">'+Object.entries(CERAMICAS).map(([k,c]) => '<option value="'+k+'"'+(k===R.ceramica?" selected":"")+">"+esc(c.nome)+"</option>").join("")+"</select></div></section>"+
    '<section class="card"><h2>Adicionar entrega</h2>'+
    '<div class="field"><label for="f-cliente">Cliente</label><input id="f-cliente" list="dl-cli" autocomplete="off" value="'+esc(F.cliente)+'" placeholder="Nome do cliente ou da obra"><datalist id="dl-cli">'+D.clientes.map(c => '<option value="'+esc(c.nome)+'">').join("")+"</datalist></div>"+
    '<div class="grid2"><div class="field"><label for="f-cidade">Cidade</label><select id="f-cidade">'+opts(Object.keys(CIDADES),F.cidade)+"</select></div>"+
    '<div class="field"><label for="f-medida">Medida</label><select id="f-medida">'+opts(MEDIDAS,F.medida)+"</select></div>"+
    '<div class="field"><label for="f-mil">Milheiros</label><input id="f-mil" inputmode="decimal" value="'+esc(F.mil)+'" placeholder="3"></div>'+
    '<div class="field"><label for="f-preco">Preço do milheiro</label><input id="f-preco" inputmode="decimal" value="'+esc(F.preco)+'" placeholder="R$"></div></div>'+
    '<p class="hint" id="f-hint"></p><div id="f-alert"></div><p class="err" id="f-err"></p>'+
    '<button class="btn full" data-act="add">Adicionar na carga</button></section>'+
    '<section class="card"><h2>Entregas desta carga</h2>'+
    (R.entregas.length ? "<div>"+R.entregas.map((e,i) => entregaRow(e,R,i,{rm:true})).join("")+"</div>"+resumoHtml(r)+"<h3>Rota</h3>"+rotaHtml(R,false)
      : '<p class="hint">Adicione a primeira entrega acima. O app vai calculando as fiadas e a rota.</p>')+"</section>"+
    '<p class="err" id="p-err"></p><button class="btn primary full" data-act="ir-agendar">Próximo: escolher o dia</button>';
}
function updHint(){
  const F = L.form, h = document.getElementById("f-hint"), a = document.getElementById("f-alert"); if (!h) return;
  const c = custoAtual(L.rascunho.ceramica,F.medida), reg = CIDADES[F.cidade].r, min = minimo(F.medida,reg);
  h.textContent = (ADM() ? "Custo "+(c ? brl(c.v)+" ("+c.fonte+")" : "sem preço")+" · " : "")+"Mínimo "+REGIOES[reg]+": "+(min!=null ? brl(min) : "sem tabela")+" · "+PORFIADA[base(F.medida)]+" por fiada";
  const p = parseNum(F.preco);
  a.innerHTML = (min!=null && isFinite(p) && p>0 && p<min) ? '<div class="alert" role="alert">O mínimo desse milheiro pra '+esc(REGIOES[reg])+" é "+brl(min)+". Menos que isso não compensa.</div>" : "";
}
function vAgendar(){
  const R = L.rascunho, r = resumo(R), dia = L.pedido.dia, doDia = dia ? D.marcas.filter(m => m.data === dia) : [];
  return steps(2)+
    '<section class="card"><h2>Escolha o dia da entrega</h2><p class="hint">Os risquinhos mostram os dias que já têm entrega, na cor da região.</p>'+calendario(L.calPedido,dia,"pc",true)+"</section>"+
    '<section class="card"><h3>Esta carga</h3>'+rotaHtml(R,false)+'<p class="hint">'+n1(r.mil)+" milheiros · "+R.entregas.length+" entrega(s)</p>"+barraCaminhao(r)+"</section>"+
    (dia ? '<section class="card"><h3>Já marcado em '+esc(diaLabel(dia))+"</h3>"+(doDia.length ? "<div>"+doDia.map(linhaMarca).join("")+"</div>" : '<p class="hint">Nenhuma entrega nesse dia ainda.</p>')+"</section>" : "")+
    '<p class="err" id="a-err"></p><button class="btn primary full" data-act="agendar">'+(dia ? "Agendar para "+esc(diaLabel(dia)) : "Toque num dia do calendário")+"</button>"+
    '<button class="btn full ghost" data-act="voltar-pedido">Voltar pro pedido</button>';
}
function gruposCliente(c){ const g = []; c.entregas.forEach((e,i) => { const k = e.cliente || "Sem nome"; let x = g.find(y => y.nome === k); if (!x) { x = {nome:k,idx:[]}; g.push(x); } x.idx.push(i); }); return g; }
function dadosCli(c,g){ const e = c.entregas[g.idx[0]], cl = acharCli(g.nome) || {}; return {tel:e.tel||cl.tel||"",cpf:e.cpf||cl.cpf||"",end:e.endc||cl.endereco||"",cidade:e.cidade,fpag:e.fpag||"PIX"}; }
function waHref(tel,txt){ let d = String(tel||"").replace(/\D/g,""); if (d && d.length <= 11) d = "55"+d; return "https://wa.me/"+d+"?text="+encodeURIComponent(txt); }
function waTexto(c,g){ const tot = g.idx.reduce((s,i) => s+c.entregas[i].mil*c.entregas[i].preco, 0); return "Olá, "+g.nome+"! Aqui é "+c.vendedor+", da Tijolos Tavares. Sua entrega está marcada para "+diaLabel(c.data)+", no valor total de "+brl2(tot)+"."; }
function compHtml(c,g,gi){
  const d = dadosCli(c,g), orc = comp.tipo === "orcamento";
  return '<div class="card" style="gap:10px"><h3>Complemento de dados · '+(orc?"orçamento":"recibo")+'</h3><p class="hint">Preencha só o que tiver. O que ficar em branco não aparece no PDF.</p>'+
    '<div class="field"><label for="cp-cpf">CPF ou CNPJ</label><input id="cp-cpf" inputmode="numeric" value="'+esc(d.cpf)+'"></div>'+
    '<div class="field"><label for="cp-end">Endereço da entrega</label><input id="cp-end" value="'+esc(d.end)+'" placeholder="Rua, número, bairro"></div>'+
    (orc ? '<div class="field"><label for="cp-fp">Forma de pagamento</label><select id="cp-fp">'+opts(FPAGS,d.fpag)+"</select></div>" : "")+
    '<div class="grid2"><button class="btn ghost" data-act="comp-x">Cancelar</button><button class="btn primary" data-act="pdf" data-tipo="'+comp.tipo+'" data-g="'+gi+'">Gerar PDF</button></div></div>';
}
function vDocs(){
  const c = acharCarga(L.pedido.cargaId);
  if (!c) { L.pedido = {step:1,dia:null,cargaId:null}; salvarLocal(); return vPedido(); }
  return steps(3)+'<div class="okmsg" role="status">Carga agendada para '+esc(diaLabel(c.data))+"."+(Agenda?" Ela já vai pro calendário do celular.":"")+"</div>"+
    '<section class="card"><h2>Orçamento ou recibo</h2><p class="hint">Gere o PDF de cada cliente e mande no WhatsApp. Se não precisar, é só concluir.</p>'+
    gruposCliente(c).map((g,gi) => { const tot = g.idx.reduce((s,i) => s+c.entregas[i].mil*c.entregas[i].preco, 0), tel = dadosCli(c,g).tel;
      return '<div class="cli"><div style="display:flex;justify-content:space-between;gap:8px"><div class="t" style="font-weight:600;min-width:0">'+esc(g.nome)+"</div><strong>"+brl(tot)+"</strong></div>"+
        '<div class="field"><label for="tel-'+gi+'">WhatsApp do cliente</label><input id="tel-'+gi+'" data-tel="'+gi+'" inputmode="tel" value="'+esc(tel)+'" placeholder="(62) 99999-9999"></div>'+
        (comp && comp.gi === gi ? compHtml(c,g,gi) : '<div class="grid2"><button class="btn" data-act="comp" data-tipo="orcamento" data-g="'+gi+'">Orçamento PDF</button><button class="btn" data-act="comp" data-tipo="recibo" data-g="'+gi+'">Recibo PDF</button></div>')+
        '<p class="hint" id="msg-'+gi+'" role="status"></p>'+
        '<a class="btn wa full" data-wa="'+gi+'" href="'+esc(waHref(tel,waTexto(c,g)))+'" target="_blank" rel="noopener">Mandar mensagem no WhatsApp</a></div>'; }).join("")+
    "</section>"+'<button class="btn primary full" data-act="concluir">Concluir atendimento</button>';
}

/* ---------- PDF ---------- */
const U = ["","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
const DZ = ["","","vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa"];
const CT = ["","cento","duzentos","trezentos","quatrocentos","quinhentos","seiscentos","setecentos","oitocentos","novecentos"];
function ate999(n){ if (!n) return ""; if (n === 100) return "cem"; const c = Math.floor(n/100), r = n%100, p = []; if (c) p.push(CT[c]); if (r) p.push(r < 20 ? U[r] : DZ[Math.floor(r/10)]+(r%10 ? " e "+U[r%10] : "")); return p.join(" e "); }
function extInt(n){
  if (!n) return "zero"; const mi = Math.floor(n/1e6), mil = Math.floor(n%1e6/1000), r = n%1000, p = [];
  if (mi) p.push(ate999(mi)+(mi===1?" milhão":" milhões")); if (mil) p.push(mil===1 ? "mil" : ate999(mil)+" mil");
  let s = p.join(" "); if (r) s += (s ? ((r<100||r%100===0) ? " e " : " ") : "")+ate999(r);
  if (mi && !mil && !r) s += " de"; return s;
}
function extenso(v){ const i = Math.floor(v+1e-9), c = Math.round((v-i)*100); return extInt(i)+(i===1?" real":" reais")+(c ? " e "+extInt(c)+(c===1?" centavo":" centavos") : ""); }
const descMed = m => "Tijolo "+(m.includes("maciço")?"maciço ":"cerâmico ")+base(m).replace(/x/g," x ")+" cm"+(m.includes("REQ")?" requeimado":"");
const unid = mil => Math.round(mil*1000).toLocaleString("pt-BR")+" un";
function pdfOrcamento(c,g,num){
  const doc = new window.jspdf.jsPDF({unit:"mm",format:"a4"}), it = g.idx.map(i => c.entregas[i]), d = dadosCli(c,g), E = D.cfg.empresa;
  const TAN = [178,133,102], RED = [170,45,40], INK = [35,35,35];
  const linha = (x1,x2,y,w) => { doc.setDrawColor(...TAN); doc.setLineWidth(w||.6); doc.line(x1,y,x2,y); };
  const dupla = (x1,x2,y) => { linha(x1,x2,y,.3); linha(x1,x2,y+.8,.3); };
  doc.setTextColor(...RED); doc.setFont("helvetica","normal"); doc.setFontSize(21); doc.text("TIJOLOS TAVARES",13,27);
  try { doc.addImage(window.LOGO_ORC,"JPEG",171,12,29,29); } catch(e) {}
  linha(12,199,43);
  doc.setTextColor(...INK); doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.text("CLIENTE",86,47.5,{align:"center"}); doc.text("DATA",140,47.5,{align:"center"});
  linha(47,199,49.5);
  doc.setFont("times","normal"); doc.setFontSize(11.5); doc.text(dataBR(HOJE),140,54.5,{align:"center"}); doc.text(String(num),172,54.5);
  let y = 54.5;
  const campo = (l,v,w) => { const ls = doc.splitTextToSize(l+" "+(v||""),w); doc.text(ls,48,y); y += ls.length*5; };
  campo("NOME:",g.nome,75); if (d.cpf) campo("CPF/CNPJ:",d.cpf,75); if (d.end) campo("ENDEREÇO:",d.end,148); campo("CIDADE:",[...new Set(it.map(e => e.cidade))].join(", "),148);
  y = Math.max(y+2,76); linha(29,198,y);
  doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.text("FORMA DE PAGAMENTO",61,y+5.5); doc.text("SERVIÇO",107,y+5.5);
  linha(29,198,y+8); doc.setFont("times","normal"); doc.setFontSize(11.5); doc.text(d.fpag,61,y+13.5); doc.text("Orçamento com entrega em "+diaLongo(c.data),107,y+13.5);
  linha(29,198,y+16.5);
  y += 26; linha(29,198,y,.8);
  doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.text("QTD.",31,y+5); doc.text("DESCRIÇÃO",68,y+5); doc.text("PREÇO DO MILHEIRO",121,y+5); doc.text("TOTAL DA LINHA",163,y+5);
  y += 7; linha(29,198,y);
  doc.setFont("helvetica","normal"); doc.setFontSize(9.5); let tot = 0;
  const rows = Math.max(it.length,5);
  for (let i = 0; i < rows; i++) { const e = it[i];
    if (e) { const t = e.mil*e.preco; tot += t; doc.text(unid(e.mil),31,y+5); doc.text(doc.splitTextToSize(descMed(e.medida).toUpperCase(),50),68,y+5); doc.text(brl2(e.preco),121,y+5); doc.text(brl2(t),163,y+5); }
    else doc.text("----------",121,y+5);
    y += 7.5; dupla(29,198,y); }
  doc.text("FRETE NEGOCIADO NO",68,y+5); doc.text("ATENDIMENTO!",68,y+9.5); doc.text("----------",121,y+7);
  y += 12; linha(29,198,y);
  doc.setTextColor(...RED); doc.setFontSize(17); doc.text("TOTAL:",121,y+9.5); doc.setTextColor(...INK); doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.text(brl2(tot),163,y+9);
  y += 15; linha(29,198,y);
  doc.setFont("times","italic"); doc.setFontSize(10); doc.setTextColor(90,90,90); doc.text("Orçamento válido por 7 dias. Vendedor: "+c.vendedor+".",31,y+6);
  y = Math.max(y+30,220); linha(12,203,y); doc.setTextColor(...INK);
  doc.setFont("helvetica","bold"); doc.setFontSize(10.5); doc.text("AGRADECEMOS A",14,y+6); doc.text("PREFERÊNCIA!",14,y+11.5);
  doc.setFont("times","normal"); doc.setFontSize(10); doc.text("Tijolos Tavares",58,y+6); doc.text(E.email||"",58,y+11.5);
  doc.text(E.end||"",125,y+6); doc.text(E.cidade||"",125,y+11.5); doc.text(E.tel ? "Tel. "+E.tel : "",158,y+6); if (E.cnpj) doc.text("CNPJ "+E.cnpj,158,y+11.5);
  linha(12,203,y+17);
  return doc;
}
function pdfRecibo(c,g,num){
  const doc = new window.jspdf.jsPDF({unit:"mm",format:"a4"}), it = g.idx.map(i => c.entregas[i]), d = dadosCli(c,g), E = D.cfg.empresa, tot = it.reduce((s,e) => s+e.mil*e.preco, 0);
  const RED = [151,65,66], PINK = [246,237,238], INK = [25,25,25], W = [255,255,255];
  const tipoDoc = d.cpf.replace(/\D/g,"").length > 11 ? "CNPJ" : "CPF";
  doc.setFillColor(...RED); doc.rect(18,18,174,25,"F");
  try { doc.addImage(window.LOGO_REC,"JPEG",21,20.5,20,20); } catch(e) {}
  doc.setTextColor(...W); doc.setFont("helvetica","bold"); doc.setFontSize(15); doc.text("Tijolos Tavares",46,29);
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text("WhatsApp: "+(E.tel||""),46,34.5); doc.text(E.email||"",46,39);
  doc.setFont("helvetica","bold"); doc.setFontSize(15); doc.text("RECIBO",188,28,{align:"right"});
  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.text("Nº "+String(num).padStart(4,"0")+"/"+HOJE.slice(0,4),188,34,{align:"right"}); doc.text("Data: "+dataBR(HOJE),188,39.5,{align:"right"});
  doc.setFillColor(...RED); doc.rect(80,48,110,10.5,"F"); doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.text("VALOR RECEBIDO",83,54.5); doc.setFontSize(13.5); doc.text(brl2(tot),187,55,{align:"right"});
  doc.setTextColor(...RED); doc.setFontSize(12.5); doc.text("Dados do Cliente",20,68);
  doc.setFontSize(10); const endL = doc.splitTextToSize((d.end?"Endereço: ":"Cidade: ")+[d.end,d.cidade].filter(Boolean).join(" – "),166), bh = 8+endL.length*5+4;
  doc.setFillColor(...PINK); doc.setDrawColor(...RED); doc.setLineWidth(.3); doc.rect(18,70.5,174,bh,"FD");
  doc.setTextColor(...INK); const kv = (k,v,x,yy) => { doc.setFont("helvetica","bold"); doc.text(k,x,yy); doc.setFont("helvetica","normal"); doc.text(v,x+doc.getTextWidth(k)+1.5,yy); };
  kv("Nome:",g.nome,21,76.5); if (d.cpf) kv(tipoDoc+":",d.cpf,128,76.5);
  doc.setFont("helvetica","normal"); doc.text(endL,21,84);
  let y = 70.5+bh+10; doc.setFontSize(11);
  const idDoc = d.cpf ? ", inscrito no "+tipoDoc+" sob o nº "+d.cpf : "";
  const par = doc.splitTextToSize("Recebemos de "+g.nome+idDoc+", a importância de "+brl2(tot)+" ("+extenso(tot)+"), referente à compra dos materiais discriminados abaixo, pelo que damos plena e total quitação.",170);
  doc.text(par,20,y,{lineHeightFactor:1.45}); y += par.length*5.9+8;
  doc.setTextColor(...RED); doc.setFont("helvetica","bold"); doc.setFontSize(12.5); doc.text("Materiais Adquiridos",20,y); y += 3;
  doc.setFillColor(...RED); doc.rect(18,y,174,9.5,"F"); doc.setTextColor(...W); doc.setFontSize(10);
  doc.text("Item",20,y+6.3); doc.text("Descrição",32,y+6.3); doc.text("Qtd.",124,y+6.3,{align:"right"}); doc.text("Valor milheiro",156,y+6.3,{align:"right"}); doc.text("Subtotal",189,y+6.3,{align:"right"});
  y += 9.5; doc.setTextColor(...INK); doc.setFont("helvetica","normal"); doc.setDrawColor(225,215,215); let un = 0;
  it.forEach((e,i) => { un += Math.round(e.mil*1000); doc.text(String(i+1),22,y+6.5); doc.text(descMed(e.medida),32,y+6.5); doc.text(unid(e.mil),124,y+6.5,{align:"right"}); doc.text(brl2(e.preco),156,y+6.5,{align:"right"}); doc.text(brl2(e.mil*e.preco),189,y+6.5,{align:"right"}); y += 10; doc.line(18,y,192,y); });
  doc.setFillColor(...PINK); doc.rect(18,y,174,10,"F"); doc.setFont("helvetica","bold"); doc.text("TOTAL",32,y+6.5); doc.text(un.toLocaleString("pt-BR")+" un",124,y+6.5,{align:"right"}); doc.text(brl2(tot),189,y+6.5,{align:"right"});
  y += 27; doc.setFont("helvetica","normal"); doc.text("Emitido em "+dataBR(HOJE)+".",189,y,{align:"right"});
  y += 20; doc.setDrawColor(...INK); doc.setLineWidth(.2); doc.line(62,y,148,y); doc.setFont("helvetica","bold"); doc.text("Tijolos Tavares",105,y+5.5,{align:"center"});
  doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.text("Emitente",105,y+10.5,{align:"center"});
  y = Math.max(y+20,240); doc.setFillColor(...PINK); doc.rect(18,y,174,32,"F"); doc.setDrawColor(...RED); doc.setLineWidth(.8); doc.line(18,y,192,y);
  doc.setTextColor(...RED); doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.text("Obrigado pela preferência!",105,y+8,{align:"center"});
  doc.setTextColor(...INK); doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.text("Agradecemos a confiança em nossos produtos. Será um prazer atender você e fazer parte da sua obra.",105,y+15,{align:"center"});
  doc.text("Qualquer dúvida, estamos à disposição.",105,y+20,{align:"center"});
  doc.setTextColor(120,120,120); doc.setFontSize(8.5); doc.text(["Tijolos Tavares",E.tel?"WhatsApp "+E.tel:"",E.email].filter(Boolean).join("  ·  "),105,y+27,{align:"center"});
  return doc;
}
async function gerarPdf(gi,tipo){
  const c = acharCarga(L.pedido.cargaId), g = gruposCliente(c)[gi];
  const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : null; };
  const cpf = val("cp-cpf"), end = val("cp-end"), fp = val("cp-fp");
  g.idx.forEach(i => { const e = c.entregas[i]; if (cpf != null) e.cpf = cpf; if (end != null) e.endc = end; if (fp) e.fpag = fp; });
  salvarEntregasDepois(c);
  const cl = acharCli(g.nome);
  if (cl && ((cpf && !cl.cpf) || (end && !cl.endereco))) { const up = {}; if (cpf && !cl.cpf) up.cpf = cpf; if (end && !cl.endereco) up.endereco = end; Object.assign(cl,up); sb.from("clientes").update(up).eq("id",cl.id); }
  comp = null; render();
  const msg = document.getElementById("msg-"+gi);
  if (!window.jspdf) { msg.textContent = "Não deu pra carregar o gerador de PDF."; return; }
  msg.textContent = "Gerando o PDF…";
  const {data:num, error} = await sb.rpc("proximo_documento");
  if (error || num == null) { msg.textContent = "Sem conexão. Confira a internet e tente de novo."; return; }
  const doc = tipo === "recibo" ? pdfRecibo(c,g,num) : pdfOrcamento(c,g,num);
  const nome = (tipo === "recibo" ? "Recibo" : "Orcamento")+"-"+slug(g.nome)+"-"+HOJE+".pdf";
  try {
    if (FS && Share) {
      const b64 = doc.output("datauristring").split(",")[1];
      const w = await FS.writeFile({path:nome, data:b64, directory:"CACHE"});
      msg.textContent = "Escolha o WhatsApp pra mandar o "+(tipo==="recibo"?"recibo":"orçamento")+".";
      await Share.share({title:nome, files:[w.uri], dialogTitle:"Mandar o PDF"});
    } else { doc.save(nome); msg.textContent = "PDF salvo."; }
  } catch(e) { if (!/cancel/i.test(String(e && e.message))) msg.textContent = "Não deu pra abrir o compartilhar. Tente de novo."; }
}

/* ---------- agenda ---------- */
function cargaCard(c){
  const r = resumo(c), st = c.status === "Entregue" ? "green" : c.status === "Carregada" ? "amber" : "brick", adm = ADM();
  return '<section class="card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div style="min-width:0"><h3>'+esc(c.vendedor)+" · "+n1(r.mil)+' mil</h3><div class="hint">'+esc(CERAMICAS[c.ceramica].nome)+"</div></div>"+
    '<span class="chip '+st+'">'+esc(c.status)+"</span></div>"+rotaHtml(c,true)+
    '<div class="stats"><div class="stat"><div class="l">Caminhão</div><div class="v" style="color:'+corOcc(r.pct)+'">'+r.pct+'%</div></div><div class="stat"><div class="l">'+(adm?"Lucro":"Venda")+'</div><div class="v '+(adm?(r.lucro>=0?"pos":"neg"):"")+'">'+brl(adm?r.lucro:r.venda)+"</div></div></div>"+
    (r.abaixo ? '<span class="chip red">'+r.abaixo+" entrega(s) abaixo do mínimo</span>" : "")+
    (c.status === "Entregue" && Camera && c.entregas.some(e => !e.foto) ? '<p class="hint">Falta a foto da entrega. Abra "Ver entregas" pra tirar.</p>' : "")+
    "<details"+(c.entregas.some((e,i) => fotos[c.id+"|"+i]) ? " open" : "")+"><summary>Ver entregas</summary>"+c.entregas.map((e,i) => entregaRow(e,c,i,{pag:adm,foto:true})+(adm ? '<div class="field" style="margin-bottom:8px"><label for="pg-'+c.id+"-"+i+'">Pagamento de '+esc(e.cliente||"Sem nome")+'</label><select id="pg-'+c.id+"-"+i+'" data-pag="'+c.id+"|"+i+'">'+opts(PAGS,pagDe(c,i))+"</select></div>" : "")).join("")+"</details>"+
    '<div class="grid2"><div class="field"><label for="st-'+c.id+'">Situação</label><select id="st-'+c.id+'" data-status="'+c.id+'">'+opts(STATUS,c.status)+"</select></div>"+
    '<div class="field"><label aria-hidden="true">&nbsp;</label><button class="btn danger" data-act="del" data-id="'+c.id+'">'+(confirmar===c.id?"Toque de novo":"Apagar carga")+"</button></div></div></section>";
}
function vAgenda(){
  const ab = D.cargas.filter(c => c.status !== "Entregue"), dia = L.diaAgenda, minhasDia = D.cargas.filter(c => c.data === dia), ids = new Set(minhasDia.map(c => c.id)), outras = D.marcas.filter(m => m.data === dia && !ids.has(m.id));
  let t = {mil:0,v:0}; ab.forEach(c => { const r = resumo(c); t.mil += r.mil; t.v += ADM() ? r.lucro : r.venda; });
  return (Agenda ? '<div id="agenda-aviso"></div>' : "")+
    '<section class="card"><div class="stats"><div class="stat"><div class="l">Cargas em aberto</div><div class="v">'+ab.length+'</div></div><div class="stat"><div class="l">Milheiros</div><div class="v">'+n1(t.mil)+'</div></div>'+
    '<div class="stat" style="grid-column:1/-1"><div class="l">'+(ADM()?"Lucro em aberto":"Venda em aberto")+'</div><div class="v">'+brl(t.v)+"</div></div></div></section>"+
    '<section class="card">'+calendario(L.calAgenda,dia,"ac",false)+"</section>"+
    '<h2>'+esc(cap(diaLabel(dia)))+"</h2>"+
    (minhasDia.length ? minhasDia.map(cargaCard).join("") : (outras.length ? "" : '<section class="card"><p class="hint">Nenhuma entrega nesse dia.</p><button class="btn primary" data-act="ir-pedido">Montar um pedido</button></section>'))+
    (outras.length ? '<section class="card"><h3>De outros vendedores</h3><div>'+outras.map(linhaMarca).join("")+"</div></section>" : "");
}
async function avisoAgendaCelular(){
  const el = document.getElementById("agenda-aviso"); if (!el) return;
  if (!(await agendaLiberada())) el.innerHTML = '<section class="card"><p class="hint">Libere o calendário pra as cargas aparecerem na agenda do seu celular.</p><button class="btn" data-act="liberar-agenda">Ligar calendário do celular</button></section>';
}

/* ---------- clientes ---------- */
function vendasPor(nome){ const out = []; D.cargas.forEach(c => c.entregas.forEach(e => { if (norm(e.cliente) === norm(nome)) out.push({c,e}); })); return out; }
function vClientes(){
  const sem = [];
  D.cargas.forEach(c => c.entregas.forEach(e => { if (e.cliente && !acharCli(e.cliente) && !sem.some(s => norm(s.nome) === norm(e.cliente))) sem.push({nome:e.cliente,cidade:e.cidade,tel:e.tel||"",cpf:e.cpf||"",end:e.endc||"",data:c.data}); }));
  const lista = D.clientes.filter(c => !buscaCli || norm(c.nome).includes(norm(buscaCli)));
  return '<section class="card"><h2>Vendas passadas sem cadastro</h2><p class="hint">Cadastre quando tiver tempo. Nada aqui atrapalha os pedidos.</p>'+
    (sem.length ? "<div>"+sem.map((s,i) => cadastrando === i ?
      '<div class="row" style="flex-direction:column;align-items:stretch;gap:10px"><div class="field"><label for="cn">Nome</label><input id="cn" value="'+esc(s.nome)+'"></div>'+
      '<div class="grid2"><div class="field"><label for="ct">Telefone</label><input id="ct" inputmode="tel" value="'+esc(s.tel)+'" placeholder="(62) 99999-9999"></div><div class="field"><label for="cc">Cidade</label><select id="cc">'+opts(Object.keys(CIDADES),s.cidade)+"</select></div></div>"+
      '<div class="field"><label for="cpfc">CPF ou CNPJ</label><input id="cpfc" inputmode="numeric" value="'+esc(s.cpf)+'"></div>'+
      '<div class="field"><label for="ce">Endereço</label><input id="ce" value="'+esc(s.end)+'" placeholder="Rua, número, bairro"></div><p class="err" id="c-err"></p>'+
      '<div class="grid2"><button class="btn ghost" data-act="cad-cancel">Cancelar</button><button class="btn primary" data-act="cad-salvar">Salvar cliente</button></div></div>'
      : '<div class="row"><div style="min-width:0"><div class="t">'+esc(s.nome)+'</div><div class="s">'+esc(s.cidade)+" · comprou em "+esc(diaCurto(s.data))+'</div></div><button class="btn small" data-act="cad-abrir" data-i="'+i+'">Cadastrar</button></div>').join("")+"</div>"
      : '<p class="hint">Todas as vendas já têm cliente cadastrado.</p>')+"</section>"+
    '<section class="card"><h2>Clientes cadastrados</h2>'+(D.clientes.length > 5 ? '<div class="field"><label for="busca">Buscar</label><input id="busca" value="'+esc(buscaCli)+'" placeholder="Nome do cliente"></div>' : "")+
    (lista.length ? "<div>"+lista.map(cl => { const v = vendasPor(cl.nome), tot = v.reduce((s,x) => s+x.e.mil*x.e.preco, 0);
      return '<div class="row"><div style="min-width:0;flex:1"><div class="t">'+esc(cl.nome)+'</div><div class="s">'+esc([cl.tel,cl.cpf,cl.cidade,cl.endereco].filter(Boolean).join(" · "))+'</div><div class="s">'+v.length+" compra(s) · "+brl(tot)+"</div>"+
        (v.length ? '<details style="margin-top:6px"><summary>Ver compras</summary>'+v.map(x => '<div class="s">'+esc(diaCurto(x.c.data))+" · "+esc(x.e.medida)+" · "+n1(x.e.mil)+" mil · "+brl(x.e.mil*x.e.preco)+"</div>").join("")+"</details>" : "")+"</div></div>"; }).join("")+"</div>"
      : '<p class="hint">'+(D.clientes.length ? "Nenhum cliente com esse nome." : "Nenhum cliente cadastrado ainda. Comece pelas vendas passadas acima.")+"</p>")+"</section>";
}

/* ---------- ferramentas ---------- */
function vFerramentas(){
  let tf = 0, occ = 0;
  const rows = L.calc.map((l,i) => { const f = Math.ceil(l.mil*1000/PORFIADA[base(l.medida)]); tf += f; occ += f/capac(l.medida);
    return '<div class="row"><div><div class="t">'+esc(l.medida)+" · "+n1(l.mil)+' mil</div><div class="s">'+f+" fiadas · "+PORFIADA[base(l.medida)]+' por fiada</div></div><button class="btn small" data-act="crm" data-i="'+i+'">Remover</button></div>'; }).join("");
  const p = Math.round(occ*100), M = D.cfg.minimos, C = D.cfg.custos;
  return '<section class="card"><h2>Calculadora de fiadas</h2><div class="grid2"><div class="field"><label for="c-mil">Milheiros</label><input id="c-mil" inputmode="decimal" placeholder="5"></div>'+
    '<div class="field"><label for="c-medida">Medida</label><select id="c-medida">'+opts(MEDIDAS,"09x19x19")+'</select></div></div><p class="err" id="calc-err"></p>'+
    '<button class="btn full" data-act="cadd">Calcular e somar na carga</button>'+(rows ? "<div>"+rows+"</div>" : "")+
    '<div class="stats"><div class="stat"><div class="l">Total de fiadas</div><div class="v">'+tf+'</div></div><div class="stat"><div class="l">Caminhão</div><div class="v" style="color:'+corOcc(p)+'">'+p+"%</div></div></div>"+
    '<div class="bar"><div style="width:'+Math.min(p,100)+"%;background:"+corOcc(p)+'"></div></div><p class="hint">Medidas x19 vão até 108 fiadas, x29 até 72 e os maciços até 115.</p>'+
    (rows ? '<button class="btn small" data-act="climpar">Limpar</button>' : "")+"</section>"+
    '<section class="card"><h2>Preço mínimo de venda</h2><p class="hint">Menos que isso não compensa. Goiânia vale pra Aparecida, Trindade, Senador Canedo e Goianira.</p>'+
    '<div class="tbl"><table><thead><tr><th>Medida</th>'+(ADM()?"<th>Custo região</th><th>Custo Anapolina</th>":"")+"<th>Anápolis</th><th>Goiânia</th><th>Brasília</th></tr></thead><tbody>"+
    MEDIDAS.map(m => { const x = M[m] || []; const f = v => v != null ? brl(v) : "–";
      return "<tr><td>"+esc(m)+"</td>"+(ADM() && C ? "<td>"+f(C.regiao&&C.regiao[m])+"</td><td>"+f(C.anapolina&&C.anapolina[m])+"</td>" : "")+"<td>"+f(x[0])+"</td><td>"+f(x[1])+"</td><td>"+f(x[2])+"</td></tr>"; }).join("")+"</tbody></table></div>"+
    (ADM() ? '<p class="hint">Pra mudar os preços, vá no Painel.</p>' : "")+"</section>"+
    '<section class="card"><h2>Carga cheia por medida</h2><div class="tbl"><table><thead><tr><th>Medida</th><th>Por fiada</th><th>Fiadas</th><th>Peças</th></tr></thead><tbody>'+
    Object.entries(PORFIADA).map(([m,pf]) => { const c = capac(m); return "<tr><td>"+m+"</td><td>"+pf+"</td><td>"+c+"</td><td>"+(pf*c).toLocaleString("pt-BR")+"</td></tr>"; }).join("")+"</tbody></table></div></section>";
}

/* ---------- painel do administrador ---------- */
function tabelaPrecosHtml(){
  const T = editandoTabela, cel = (m,k,v) => '<td><input id="tp-'+MEDIDAS.indexOf(m)+"-"+k+'" inputmode="decimal" value="'+(v!=null?v:"")+'" aria-label="'+esc(m)+" "+k+'"></td>';
  return '<div class="tbl tp"><table><thead><tr><th>Medida</th><th>Custo Anapolina</th><th>Custo região</th><th>Mín. Anápolis</th><th>Mín. Goiânia</th><th>Mín. Brasília</th></tr></thead><tbody>'+
    MEDIDAS.map(m => { const mm = T.minimos[m] || []; return "<tr><td>"+esc(m)+"</td>"+cel(m,"ca",T.custos.anapolina[m])+cel(m,"cr",T.custos.regiao[m])+cel(m,"m1",mm[0])+cel(m,"m2",mm[1])+cel(m,"m3",mm[2])+"</tr>"; }).join("")+
    '</tbody></table></div><p class="err" id="tp-err"></p><div class="grid2"><button class="btn ghost" data-act="tp-cancel">Cancelar</button><button class="btn primary" data-act="tp-salvar">Salvar nova tabela</button></div>'+
    '<p class="hint">As cargas já agendadas continuam com o custo da época. A tabela nova vale pros próximos pedidos.</p>';
}
function vPainel(){
  const mes = L.mesResumo, doMes = D.cargas.filter(c => c.data.slice(0,7) === mes), pv = {}; let T = {n:0,mil:0,venda:0,lucro:0};
  doMes.forEach(c => { const r = resumo(c), x = pv[c.vendedor] = pv[c.vendedor] || {n:0,mil:0,venda:0,lucro:0}; [x,T].forEach(o => { o.n++; o.mil += r.mil; o.venda += r.venda; o.lucro += r.lucro; }); });
  const deve = {}; let aRec = 0, fiado = 0;
  D.cargas.forEach(c => c.entregas.forEach((e,i) => { const p = pagDe(c,i); if (p === "Pago") return; const v = e.mil*e.preco; if (p === "Fiado") fiado += v; else aRec += v; const k = e.cliente || "Sem nome"; (deve[k] = deve[k] || []).push({c,e,i,v,p}); }));
  const E = D.cfg.empresa;
  return '<section class="card"><div class="calhead"><button class="btn small ghost" data-act="rm-prev" aria-label="Mês anterior">‹</button><h2>Resumo de '+esc(mesLabel(mes).toLowerCase())+'</h2><button class="btn small ghost" data-act="rm-next" aria-label="Próximo mês">›</button></div>'+
    '<div class="stats"><div class="stat"><div class="l">Cargas</div><div class="v">'+T.n+'</div></div><div class="stat"><div class="l">Milheiros</div><div class="v">'+n1(T.mil)+'</div></div>'+
    '<div class="stat"><div class="l">Venda</div><div class="v">'+brl(T.venda)+'</div></div><div class="stat"><div class="l">Lucro</div><div class="v '+(T.lucro>=0?"pos":"neg")+'">'+brl(T.lucro)+"</div></div></div>"+
    (Object.keys(pv).length ? '<div class="tbl"><table><thead><tr><th>Vendedor</th><th>Cargas</th><th>Mil</th><th>Venda</th><th>Lucro</th></tr></thead><tbody>'+
      Object.entries(pv).sort((a,b) => b[1].venda-a[1].venda).map(([v,x]) => "<tr><td>"+esc(v)+"</td><td>"+x.n+"</td><td>"+n1(x.mil)+"</td><td>"+brl(x.venda)+"</td><td>"+brl(x.lucro)+"</td></tr>").join("")+"</tbody></table></div>" : '<p class="hint">Nenhuma carga nesse mês.</p>')+"</section>"+
    '<section class="card"><h2>Pagamentos</h2><div class="stats"><div class="stat"><div class="l">A receber</div><div class="v" style="color:var(--warn)">'+brl(aRec)+'</div></div><div class="stat"><div class="l">Fiado</div><div class="v neg">'+brl(fiado)+"</div></div></div>"+
    (Object.keys(deve).length ? "<div>"+Object.entries(deve).map(([k,l]) => '<div class="row" style="flex-direction:column;align-items:stretch;gap:6px"><div style="display:flex;justify-content:space-between;gap:8px"><span class="t">'+esc(k)+"</span><strong>"+brl(l.reduce((s,x) => s+x.v, 0))+"</strong></div>"+
      l.map(x => '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="s">'+esc(diaCurto(x.c.data))+" · "+esc(x.e.medida)+" · "+brl(x.v)+'</span><select style="width:auto;height:36px" aria-label="Pagamento" data-pag="'+x.c.id+"|"+x.i+'">'+opts(PAGS,x.p)+"</select></div>").join("")+"</div>").join("")+"</div>"
      : '<p class="hint">Ninguém está devendo.</p>')+"</section>"+
    '<section class="card"><h2>Tabelas de preço</h2>'+(editandoTabela ? tabelaPrecosHtml() :
      '<p class="hint">Mude o custo e o preço mínimo de cada medida, inclusive dos maciços.</p><button class="btn" data-act="tp-editar">Mudar preços</button>')+
      (D.hist.length ? '<h3>Histórico de preço</h3><div>'+D.hist.map((h,i) => '<div class="row"><div><div class="t">'+esc(new Date(h.criado_em).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}))+'</div><div class="s">Custo do 09x19x19 na Anapolina: '+((h.custos.anapolina||{})["09x19x19"]!=null?brl(h.custos.anapolina["09x19x19"]):"–")+'</div></div><button class="btn small" data-act="tp-usar" data-i="'+i+'">Usar esta</button></div>').join("")+"</div>" : "")+"</section>"+
    '<section class="card"><h2>Logins</h2><div><div class="row"><span class="t">Bruno</span><span class="chip brick">Administrador</span></div><div class="row"><span class="t">Rafael</span><span class="chip">Vendedor</span></div><div class="row"><span class="t">Wolney</span><span class="chip">Vendedor</span></div></div></section>'+
    '<section class="card"><h2>Dados da empresa</h2><p class="hint">Saem no orçamento e no recibo.</p>'+
    '<div class="grid2"><div class="field"><label for="em-end">Endereço</label><input id="em-end" value="'+esc(E.end)+'"></div><div class="field"><label for="em-cidade">Cidade</label><input id="em-cidade" value="'+esc(E.cidade)+'"></div>'+
    '<div class="field"><label for="em-tel">WhatsApp</label><input id="em-tel" inputmode="tel" value="'+esc(E.tel)+'"></div><div class="field"><label for="em-cnpj">CNPJ (opcional)</label><input id="em-cnpj" value="'+esc(E.cnpj)+'"></div></div>'+
    '<div class="field"><label for="em-email">E-mail</label><input id="em-email" inputmode="email" value="'+esc(E.email)+'"></div></section>';
}
async function salvarTabela(){
  const er = document.getElementById("tp-err"), minimos = {}, custos = {anapolina:{},regiao:{}};
  for (const m of MEDIDAS) {
    const i = MEDIDAS.indexOf(m), v = k => { const s = document.getElementById("tp-"+i+"-"+k).value.trim(); if (!s) return null; const n = parseNum(s); return isFinite(n) && n > 0 ? n : NaN; };
    const ca = v("ca"), cr = v("cr"), mm = [v("m1"),v("m2"),v("m3")];
    if ([ca,cr,...mm].some(x => Number.isNaN(x))) { er.textContent = "Tem um valor errado na linha "+m+". Use só números."; return; }
    if (ca != null) custos.anapolina[m] = ca; if (cr != null) custos.regiao[m] = cr;
    if (mm.some(x => x != null)) minimos[m] = mm;
  }
  er.textContent = "Salvando…";
  const r1 = await sb.from("config").update({dados:minimos, atualizado_em:new Date().toISOString()}).eq("chave","minimos");
  const r2 = await sb.from("config").update({dados:custos, atualizado_em:new Date().toISOString()}).eq("chave","custos");
  const r3 = await sb.from("precos_hist").insert({minimos, custos});
  if (r1.error || r2.error || r3.error) { er.textContent = "Não deu pra salvar. Confira a internet."; return; }
  editandoTabela = null; await carregar(); render();
}

/* ---------- foto da entrega ---------- */
async function tirarFoto(k){
  const [id,i] = k.split("|"), c = acharCarga(id), el = () => document.getElementById("foto-"+k);
  try {
    const f = await Camera.getPhoto({quality:60, width:1280, resultType:"base64", source:"CAMERA", saveToGallery:false});
    const bin = atob(f.base64String), bytes = new Uint8Array(bin.length); for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
    const caminho = id+"/"+i+"-"+Date.now()+".jpg";
    if (el()) el().textContent = "Enviando a foto…";
    const up = await sb.storage.from("entregas").upload(caminho, new Blob([bytes],{type:"image/jpeg"}), {contentType:"image/jpeg"});
    if (up.error) throw up.error;
    c.entregas[+i].foto = caminho;
    const r = await sb.from("cargas").update({entregas:c.entregas}).eq("id",id); if (r.error) throw r.error;
    fotos[k] = "data:image/jpeg;base64,"+f.base64String; render();
  } catch(e) { if (!/cancel/i.test(String(e && e.message)) && el()) el().textContent = "Não deu pra salvar a foto. Confira a internet."; }
}
async function verFoto(k){
  if (fotos[k]) { delete fotos[k]; render(); return; }
  const [id,i] = k.split("|"), c = acharCarga(id);
  const r = await sb.storage.from("entregas").createSignedUrl(c.entregas[+i].foto, 3600);
  if (r.error) { const el = document.getElementById("foto-"+k); if (el) el.textContent = "Não deu pra abrir a foto."; return; }
  fotos[k] = r.data.signedUrl; render();
}

/* ---------- sessão ---------- */
async function entrarComSessao(user){
  const {data, error} = await sb.from("profiles").select("*").eq("id",user.id).single();
  if (error || !data) { await sb.auth.signOut(); D.perfil = null; render(); return; }
  D.perfil = data;
  const cache = ler("tt-cache", null);
  if (cache && cache.perfil && cache.perfil.id === data.id) { D = Object.assign(cache, {perfil:data}); render(); }
  await carregar(); D.perfil = data;
  if (!["pedido","agenda","clientes","ferramentas","painel"].includes(L.tab)) L.tab = data.admin ? "agenda" : "pedido";
  render(); ouvirMudancas();
  if (NATIVO) { await pedirPermissoesCelular(); sincronizarCelular(); if (L.tab === "agenda") avisoAgendaCelular(); }
}
async function iniciar(){
  const {data} = await sb.auth.getSession();
  if (data.session) await entrarComSessao(data.session.user); else render();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && D.perfil) { HOJE = ymd(new Date()); recarregarLogo(); } });

/* ---------- eventos ---------- */
document.getElementById("tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; L.tab = b.dataset.tab; confirmar = null; aviso = ""; cadastrando = null; salvarLocal(); render(); window.scrollTo(0,0); if (L.tab === "agenda") avisoAgendaCelular(); });
document.getElementById("userbtn").addEventListener("click", async () => {
  if (canal) sb.removeChannel(canal);
  await sb.auth.signOut();
  D = {perfil:null,cargas:[],marcas:[],admin:{},clientes:[],cfg:{minimos:{},custos:null,empresa:{}},hist:[]};
  gravar("tt-cache", null); L = localNovo(); salvarLocal(); render(); window.scrollTo(0,0);
});
// links externos (WhatsApp, Maps) abrem fora do app
document.addEventListener("click", e => { const a = e.target.closest('a[target="_blank"]'); if (a && NATIVO) { e.preventDefault(); window.location.href = a.href; } });

main.addEventListener("input", e => {
  const t = e.target, id = t.id, v = t.value;
  if (id.startsWith("f-")) { L.form[id.slice(2)] = v;
    if (id === "f-cliente") { const cl = acharCli(v); if (cl && CIDADES[cl.cidade]) { L.form.cidade = cl.cidade; document.getElementById("f-cidade").value = cl.cidade; } }
    salvarLocal(); updHint(); avisoErro("f-err",""); }
  else if (t.dataset.tel != null) { const c = acharCarga(L.pedido.cargaId), g = gruposCliente(c)[+t.dataset.tel]; g.idx.forEach(i => { c.entregas[i].tel = v; }); salvarEntregasDepois(c);
    const a = document.querySelector('[data-wa="'+t.dataset.tel+'"]'); if (a) a.href = waHref(v, waTexto(c,g)); }
  else if (id === "busca") { buscaCli = v; const pos = t.selectionStart; render(); const b = document.getElementById("busca"); if (b) { b.focus(); b.setSelectionRange(pos,pos); } }
  else if (id === "c-mil") avisoErro("calc-err","");
  else if (id === "lg-senha") avisoErro("login-err","");
});
let timerEmpresa = null;
main.addEventListener("change", e => {
  const t = e.target, v = t.value;
  if (t.id === "ceramica") { L.rascunho.ceramica = v; salvarLocal(); render(); }
  else if (t.id.startsWith("em-")) { D.cfg.empresa[t.id.slice(3)] = v.trim(); clearTimeout(timerEmpresa); timerEmpresa = setTimeout(() => sb.from("config").update({dados:D.cfg.empresa}).eq("chave","empresa"), 300); }
  else if (t.dataset.status) { const c = acharCarga(t.dataset.status); if (c) { c.status = v; render(); sb.from("cargas").update({status:v}).eq("id",c.id).then(() => sincronizarCelular()); } }
  else if (t.dataset.pag) { const [cid,i] = t.dataset.pag.split("|"), c = acharCarga(cid); if (!c) return;
    const a = D.admin[cid] = D.admin[cid] || {carga_id:cid,custos:[],pags:[]}; const pags = c.entregas.map((x,j) => (a.pags||[])[j] || "A receber"); pags[+i] = v; a.pags = pags;
    sb.from("carga_admin").update({pags}).eq("carga_id",cid); if (L.tab === "painel") render(); }
});
async function fazerLogin(){
  const n = document.getElementById("lg-nome").value, p = document.getElementById("lg-senha").value, b = main.querySelector('[data-act="login"]');
  if (!p) { avisoErro("login-err","Digite a senha."); return; }
  b.disabled = true; b.textContent = "Entrando…";
  const {data, error} = await sb.auth.signInWithPassword({email:LOGINS[n], password:p});
  if (error) { b.disabled = false; b.textContent = "Entrar"; avisoErro("login-err", /invalid/i.test(error.message) ? "Senha errada. Confira e tente de novo." : "Sem conexão. Confira a internet."); return; }
  gravar("tt-ultimo", n); L = localNovo(); L.tab = n === "Bruno" ? "agenda" : "pedido"; salvarLocal();
  await entrarComSessao(data.user);
}
main.addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return; const a = b.dataset.act;
  if (a === "login") fazerLogin();
  else if (a === "add") {
    const F = L.form, mil = parseMil(F.mil), preco = parseNum(F.preco);
    if (!(mil > 0)) { avisoErro("f-err","Coloque quantos milheiros vão nessa entrega."); return; }
    if (!(preco > 0)) { avisoErro("f-err","Coloque o preço de venda do milheiro."); return; }
    const cl = acharCli(F.cliente);
    L.rascunho.entregas.push({cliente:F.cliente.trim(),cidade:F.cidade,medida:F.medida,mil,preco,tel:cl?cl.tel||"":"",cpf:cl?cl.cpf||"":"",endc:cl?cl.endereco||"":""});
    L.form = {...F,cliente:"",mil:"",preco:""}; aviso = ""; salvarLocal(); render();
  }
  else if (a === "rm") { L.rascunho.entregas.splice(+b.dataset.i,1); salvarLocal(); render(); }
  else if (a === "ir-agendar") { if (!L.rascunho.entregas.length) { avisoErro("p-err","Adicione pelo menos uma entrega."); return; } L.pedido.step = 2; L.pedido.dia = null; L.calPedido = HOJE.slice(0,7); aviso = ""; salvarLocal(); render(); window.scrollTo(0,0); }
  else if (a === "voltar-pedido") { L.pedido.step = 1; salvarLocal(); render(); window.scrollTo(0,0); }
  else if (a === "pc-prev" || a === "pc-next") { L.calPedido = addMes(L.calPedido, a.endsWith("next") ? 1 : -1); salvarLocal(); render(); }
  else if (a === "pc-dia") { if (b.dataset.d < HOJE) return; L.pedido.dia = b.dataset.d; salvarLocal(); render(); }
  else if (a === "agendar") {
    if (!L.pedido.dia) { avisoErro("a-err","Toque no dia da entrega no calendário."); return; }
    b.disabled = true; b.textContent = "Agendando…";
    const c = {id:uid(), vendedor_id:D.perfil.id, vendedor:D.perfil.nome, ceramica:L.rascunho.ceramica, data:L.pedido.dia, status:"Agendada", entregas:L.rascunho.entregas};
    const {error} = await sb.from("cargas").insert(c);
    if (error) { b.disabled = false; b.textContent = "Agendar para "+diaLabel(L.pedido.dia); avisoErro("a-err","Não deu pra agendar. Confira a internet e tente de novo."); return; }
    D.cargas.push(c); D.marcas.push({id:c.id,data:c.data,vendedor:c.vendedor,cidades:c.entregas.map(x => x.cidade),milheiros:c.entregas.reduce((s,x) => s+x.mil,0)});
    L.rascunho = {ceramica:L.rascunho.ceramica, entregas:[]}; L.pedido = {step:3,dia:null,cargaId:c.id}; salvarLocal(); render(); window.scrollTo(0,0);
    sincronizarCelular(); recarregarLogo();
  }
  else if (a === "comp") { comp = {gi:+b.dataset.g, tipo:b.dataset.tipo}; render(); }
  else if (a === "comp-x") { comp = null; render(); }
  else if (a === "pdf") gerarPdf(+b.dataset.g, b.dataset.tipo);
  else if (a === "concluir") { comp = null; L.pedido = {step:1,dia:null,cargaId:null}; aviso = "Atendimento concluído. A carga já está na agenda."; salvarLocal(); render(); window.scrollTo(0,0); }
  else if (a === "ac-prev" || a === "ac-next") { L.calAgenda = addMes(L.calAgenda, a.endsWith("next") ? 1 : -1); salvarLocal(); render(); }
  else if (a === "ac-dia") { L.diaAgenda = b.dataset.d; confirmar = null; salvarLocal(); render(); avisoAgendaCelular(); }
  else if (a === "liberar-agenda") { try { const r = await Agenda.pedirPermissao(); if (r.ok) { document.getElementById("agenda-aviso").innerHTML = ""; sincronizarAgenda(); } } catch(err) {} }
  else if (a === "del") {
    if (confirmar !== b.dataset.id) { confirmar = b.dataset.id; render(); return; }
    const id = b.dataset.id; confirmar = null;
    const {error} = await sb.from("cargas").delete().eq("id",id);
    if (!error) { D.cargas = D.cargas.filter(c => c.id !== id); D.marcas = D.marcas.filter(m => m.id !== id); sincronizarCelular(); }
    render();
  }
  else if (a === "ir-pedido") { L.tab = "pedido"; salvarLocal(); render(); }
  else if (a === "tirar-foto") tirarFoto(b.dataset.k);
  else if (a === "ver-foto") verFoto(b.dataset.k);
  else if (a === "cad-abrir") { cadastrando = +b.dataset.i; render(); }
  else if (a === "cad-cancel") { cadastrando = null; render(); }
  else if (a === "cad-salvar") {
    const n = document.getElementById("cn").value.trim(); if (!n) { avisoErro("c-err","Coloque o nome do cliente."); return; }
    if (acharCli(n)) { avisoErro("c-err","Já tem um cliente com esse nome."); return; }
    const novo = {nome:n, tel:document.getElementById("ct").value.trim(), cidade:document.getElementById("cc").value, cpf:document.getElementById("cpfc").value.trim(), endereco:document.getElementById("ce").value.trim()};
    const {data, error} = await sb.from("clientes").insert(novo).select().single();
    if (error) { avisoErro("c-err", /duplicate|unique/i.test(error.message) ? "Já tem um cliente com esse nome." : "Não deu pra salvar. Confira a internet."); return; }
    D.clientes.push(data); cadastrando = null; render();
  }
  else if (a === "cadd") { const mil = parseMil(document.getElementById("c-mil").value); if (!(mil > 0)) { avisoErro("calc-err","Coloque a quantidade de milheiros."); return; } L.calc.push({mil, medida:document.getElementById("c-medida").value}); salvarLocal(); render(); }
  else if (a === "crm") { L.calc.splice(+b.dataset.i,1); salvarLocal(); render(); }
  else if (a === "climpar") { L.calc = []; salvarLocal(); render(); }
  else if (a === "rm-prev" || a === "rm-next") { L.mesResumo = addMes(L.mesResumo, a.endsWith("next") ? 1 : -1); salvarLocal(); render(); }
  else if (a === "tp-editar") { editandoTabela = {minimos:JSON.parse(JSON.stringify(D.cfg.minimos)), custos:JSON.parse(JSON.stringify(D.cfg.custos||{anapolina:{},regiao:{}}))}; editandoTabela.custos.anapolina = editandoTabela.custos.anapolina || {}; editandoTabela.custos.regiao = editandoTabela.custos.regiao || {}; render(); }
  else if (a === "tp-usar") { const h = D.hist[+b.dataset.i]; editandoTabela = {minimos:JSON.parse(JSON.stringify(h.minimos)), custos:{anapolina:{...(h.custos.anapolina||{})}, regiao:{...(h.custos.regiao||{})}}}; render(); }
  else if (a === "tp-cancel") { editandoTabela = null; render(); }
  else if (a === "tp-salvar") salvarTabela();
});

iniciar();
