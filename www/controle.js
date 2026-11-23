"use strict";
/* Meu Controle: área de cada funcionário dentro do app da Tijolos Tavares.
   Mostra o que ele ganhou e recebeu (do cadastro dele no Financeiro), o saldo, a presença por turno
   (vendedor), o que ele mesmo anota (descarga, carregada, motorista, outros) e o resumo da semana.
   O Bruno (administrador) abre o Meu Controle de qualquer um pelo Painel.
   Usa as funções e o estado do app.js (D, L, esc, brl...). */

const EQ = window.Equipe;
let mcMsg = "", mcErro = "", mcConfirm = null, mcCarregando = false, loginMsg = "", loginEditando = null, loginNovo = null;

/* ---------- quem pode o quê ---------- */
const funcoesDe = p => (p && Array.isArray(p.funcoes) ? p.funcoes : ["vendedor"]);
const FUNCS = () => funcoesDe(D.perfil);
const VENDE = () => ADM() || FUNCS().includes("vendedor");
const TEM_CONTROLE = () => !!(D.perfil && D.perfil.pessoa_id);
const loginEmail = n => norm(n).replace(/[^a-z0-9]+/g, "") + "@tijolostavares.app";
const nomeFuncoes = fs => fs.map(f => EQ.FUNCOES[f] || f).join(" + ");

/* ---------- dados ---------- */
const alvoControle = () => (ADM() ? L.verPessoa || D.perfil.pessoa_id : D.perfil.pessoa_id) || null;
async function carregarControle() {
  const pid = alvoControle(); if (!pid) { D.mc = null; return; }
  mcCarregando = true;
  const r = await sb.rpc("meu_controle", ADM() ? { p_pessoa: pid } : {});
  mcCarregando = false;
  if (r.error) { mcErro = "Não deu pra abrir o controle agora. Confira a internet."; return; }
  mcErro = ""; D.mc = r.data || null;
}
function ctxControle() {
  const m = D.mc || {}, d = x => Object.assign({}, x, { dia: String(x.dia).slice(0, 10) });
  return { cargas: (m.cargas || []).map(c => Object.assign({}, c, { data: String(c.data).slice(0, 10) })), viag: m.viag || [], ajudantes: m.ajudantes || [],
    faltas: (m.faltas || []).map(d), presencas: (m.presencas || []).map(d), movs: m.movs || [], lancamentos: (m.lancamentos || []).map(d) };
}
const pessoaMc = () => (D.mc && D.mc.pessoa) || null;
const semanaMc = () => { const s = EQ.semana(L.mcSemana || HOJE); L.mcSemana = s.de; return s; };

/* ---------- tela ---------- */
function vControle() {
  const topo = '<div class="mc-top"><img src="' + (window.LOGO_ORC || "icon.png") + '" alt="Tijolos Tavares" width="56" height="56"><div><h1>Meu Controle</h1><p class="hint">Tijolos Tavares</p></div></div>';
  const voltar = ADM() ? '<button class="btn small ghost" data-act="mc-voltar">‹ Painel</button>' : "";
  if (!alvoControle()) return voltar + topo + '<section class="card"><p>' + (ADM() ? "Escolha um funcionário no Painel." : "Seu login ainda não está ligado a um cadastro. Peça pro Bruno ligar em Configurações > Equipe e logins.") + "</p></section>";
  const p = pessoaMc();
  if (!p || p.id !== alvoControle()) { if (!mcCarregando) carregarControle().then(render); return voltar + topo + (mcErro ? '<p class="err">' + esc(mcErro) + "</p>" : '<div class="carregando">Abrindo…</div>'); }
  const ctx = ctxControle(), s = semanaMc(), f = EQ.ficha(ctx, p, s.de, s.ate), cf = EQ.conferir(f, ctx.lancamentos, s.de, s.ate);
  const sem = s.de === EQ.semana(HOJE).de ? "Esta semana" : "Semana de " + diaCurto(s.de) + " a " + diaCurto(s.ate);
  const saldoCls = f.saldo > 0 ? "pos" : f.saldo < 0 ? "neg" : "";
  const novos = (D.mc.avisos || []).filter(a => !a.lido_em);
  return voltar + topo + (ADM() ? '<p class="hint">Você está vendo o Meu Controle de <b>' + esc(p.nome) + "</b>, igual ele vê no celular dele.</p>" : "") +
    (mcMsg ? '<div class="okmsg" role="status">' + esc(mcMsg) + "</div>" : "") + (mcErro ? '<p class="err">' + esc(mcErro) + "</p>" : "") +
    novos.slice(0, 1).map(a => '<section class="card aviso"><h2>' + esc(a.titulo) + '</h2><pre class="mc-txt">' + esc(a.texto) + "</pre>" + (ADM() ? "" : '<button class="btn small" data-act="mc-lido" data-id="' + a.id + '">Já vi</button>') + "</section>").join("") +
    '<section class="card"><div class="row"><div><div class="t">' + esc(p.nome) + '</div><div class="s">' + (p.tipo === "vendedor" ? "Vendedor · " + brl(p.salario_mes) + " por mês (" + brl2((+p.salario_mes || 0) / EQ.DIAS_MES) + " por dia)" : "Carga, descarga e serviços") + "</div></div></div>" +
    '<div class="stats"><div class="stat"><div class="l">Saldo geral</div><div class="v ' + saldoCls + '">' + brl2(Math.abs(f.saldo)) + '</div></div><div class="stat"><div class="l">Situação</div><div class="v" style="font-size:16px">' + (f.saldo > 0 ? "Bruno te deve" : f.saldo < 0 ? "Você está devendo" : "Tudo acertado") + "</div></div></div>" +
    '<p class="hint">' + (f.saldo > 0 ? "A Tijolos Tavares ainda vai te pagar esse valor." : f.saldo < 0 ? "Você recebeu esse valor adiantado; ele desconta dos próximos serviços." : "O que você ganhou e o que recebeu estão iguais.") + "</p></section>" +
    '<div class="calhead"><button class="btn small ghost" data-act="mc-sem" data-n="-7" aria-label="Semana anterior">‹</button><h2>' + esc(sem) + '</h2><button class="btn small ghost" data-act="mc-sem" data-n="7" aria-label="Próxima semana">›</button></div>' +
    (p.tipo === "vendedor" ? presencaHtml(p, s, f) : "") +
    '<section class="card"><h2>Ganhou</h2>' + ganhosHtml(p, f) + '<div class="row"><b>Total da semana</b><b>' + brl2(f.ganhou) + "</b></div></section>" +
    '<section class="card"><h2>Recebeu</h2>' + (f.pix.length ? f.pix.map(m => '<div class="row"><span>' + esc(diaCurto(String(m.quando).slice(0, 10)) + (m.banco ? " · " + m.banco : "")) + "</span><b>" + brl2(m.valor) + "</b></div>").join("") : '<p class="hint">Nenhum pagamento nesta semana.</p>') +
    '<div class="row"><b>Total da semana</b><b>' + brl2(f.recebeu) + "</b></div></section>" +
    anotarHtml(p, ctx, s) + conferirHtml(cf) + (ADM() ? enviarHtml(p, ctx, s) : "") + avisosHtml();
}
function ganhosHtml(p, f) {
  const l = [];
  if (p.tipo === "vendedor") l.push('<div class="row"><span>Diárias (' + String(f.diasTrab).replace(".", ",") + " dia(s))</span><b>" + brl2(f.diarias) + "</b></div>");
  f.ajud.forEach(o => l.push('<div class="row"><span>Descarga · ' + esc(diaCurto(o.c.data)) + "</span><b>" + brl2(o.x.valor) + "</b></div>"));
  f.carreg.forEach(o => l.push('<div class="row"><span>Carregada · ' + esc(diaCurto(o.dia)) + (o.com > 1 ? " (dividido por " + o.com + ")" : "") + "</span><b>" + brl2(o.valor) + "</b></div>"));
  f.motor.forEach(m => l.push('<div class="row"><span>Motorista na ' + esc(m.papel) + " · " + esc(diaCurto(m.dia)) + "</span><b>" + brl2(m.valor) + "</b></div>"));
  if (p.tipo === "vendedor" && f.vendas.length) l.push('<div class="row"><span class="s">Vendeu ' + f.vendas.length + " carga(s)</span><span class=\"s\">" + brl(f.vendido) + "</span></div>");
  return l.join("") || '<p class="hint">Nada anotado pelo Bruno nesta semana ainda.</p>';
}
function presencaHtml(p, s, f) {
  const hoje = HOJE, limite = addDias(HOJE, -7);
  return '<section class="card"><h2>Presença</h2><p class="hint">Marque o turno de cada dia. Meio turno vale meia diária. Dá pra mudar até 7 dias pra trás.</p>' +
    EQ.diasUteis(s.de, addDias(s.de, 4)).map(d => {
      const t = f.turnos[d], falta = f.faltas.includes(d), pode = ADM() || (d <= hoje && d >= limite);
      return '<div class="mc-dia"><div class="t">' + esc(cap(diaLabel(d))) + (falta ? ' <span class="chip red">Falta marcada pelo Bruno</span>' : !t && d <= hoje ? ' <span class="chip">Sem marcar (conta dia todo)</span>' : "") + '</div><div class="seg">' +
        Object.keys(EQ.TURNOS).map(k => '<button class="btn small' + (t === k ? " primary" : "") + '" data-act="mc-turno" data-d="' + d + '" data-t="' + k + '"' + (pode ? "" : " disabled") + ' aria-pressed="' + (t === k) + '">' + esc(EQ.TURNOS[k].nome) + "</button>").join("") + "</div></div>";
    }).join("") + "</section>";
}
function tiposPermitidos() {
  if (ADM()) return Object.keys(EQ.TIPOS);
  const fs = FUNCS(), t = [];
  if (fs.includes("carga")) t.push("descarga", "carregada");
  if (fs.includes("motorista")) t.push("motorista");
  t.push("outro"); return t;
}
function anotarHtml(p, ctx, s) {
  const meus = ctx.lancamentos.filter(l => l.dia >= s.de && l.dia <= s.ate), tipos = tiposPermitidos();
  return '<section class="card"><h2>Minhas anotações</h2><p class="hint">Anote cada serviço que você fez. Serve pra conferir com o controle do Bruno no fim da semana.</p>' +
    '<div class="grid2"><div class="field"><label for="mc-dia">Dia</label><input type="date" id="mc-dia" value="' + (HOJE >= s.de && HOJE <= s.ate ? HOJE : s.de) + '"></div>' +
    '<div class="field"><label for="mc-tipo">Serviço</label><select id="mc-tipo">' + optsObj(tipos.map(t => [t, EQ.TIPOS[t]]), tipos[0]) + "</select></div>" +
    '<div class="field"><label for="mc-valor">Valor (R$)</label><input id="mc-valor" inputmode="decimal" placeholder="150"></div>' +
    '<div class="field"><label for="mc-obs">O que foi (opcional)</label><input id="mc-obs" placeholder="Ex.: descarga em Goiânia, 5 mil"></div></div>' +
    '<p class="err" id="mc-err"></p><button class="btn primary full" data-act="mc-anotar">Anotar</button>' +
    (meus.length ? "<div style=\"margin-top:10px\">" + meus.map(l => '<div class="row"><div style="min-width:0"><div class="t">' + esc(EQ.TIPOS[l.tipo] || l.tipo) + " · " + esc(diaCurto(l.dia)) + (l.conferido ? ' <span class="chip green">Conferido</span>' : "") + '</div><div class="s">' + esc(l.obs || "") + "</div></div><div style=\"text-align:right\"><b>" + brl2(l.valor) + "</b><br>" +
      (ADM() ? '<button class="btn small" data-act="mc-conf" data-id="' + l.id + '" data-v="' + (l.conferido ? "0" : "1") + '">' + (l.conferido ? "Desconferir" : "Conferir") + "</button>" : "") +
      ((ADM() || !l.conferido) ? '<button class="btn small ghost" data-act="mc-del" data-id="' + l.id + '">' + (mcConfirm === "del" + l.id ? "Toque de novo" : "Apagar") + "</button>" : "") + "</div></div>").join("") + "</div>" : '<p class="hint" style="margin-top:10px">Nenhuma anotação nesta semana.</p>') + "</section>";
}
function conferirHtml(cf) {
  if (!cf.length) return "";
  return '<section class="card"><h2>Conferência da semana</h2><div class="tbl"><table><thead><tr><th>Serviço</th><th>Você</th><th>Bruno</th><th>Dif.</th></tr></thead><tbody>' +
    cf.map(x => "<tr><td>" + esc(x.nome) + "</td><td>" + x.eleQtd + " · " + brl2(x.ele) + "</td><td>" + x.brunoQtd + " · " + brl2(x.bruno) + '</td><td class="' + (Math.abs(x.dif) < 0.01 ? "" : x.dif > 0 ? "neg" : "pos") + '">' + (Math.abs(x.dif) < 0.01 ? "Igual" : brl2(x.dif)) + "</td></tr>").join("") +
    '</tbody></table></div><p class="hint">Se tiver diferença, fale com o Bruno. "Outro serviço" não está no controle dele até ele lançar.</p></section>';
}
function enviarHtml(p, ctx, s) {
  const r = EQ.resumoSemana(ctx, p, s.de, s.ate), tel = p.telefone || "";
  return '<section class="card"><h2>Resumo pra ' + esc(p.nome) + '</h2><pre class="mc-txt">' + esc(r.texto) + "</pre>" +
    '<div class="btns" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="mc-enviar">Mandar no app dele</button>' +
    (tel ? '<a class="btn wa" target="_blank" rel="noopener" href="' + esc(waHref(tel, r.texto)) + '">Mandar no WhatsApp</a>' : "") + "</div>" +
    '<p class="hint">Toda sexta, a partir das 17h, o resumo sai sozinho no app dele. Aqui você manda na hora que quiser.</p></section>';
}
function avisosHtml() {
  const av = (D.mc.avisos || []).filter(a => a.lido_em || ADM());
  if (!av.length) return "";
  return '<section class="card"><details><summary>Resumos anteriores (' + av.length + ")</summary>" + av.map(a => '<div class="row" style="flex-direction:column;align-items:stretch"><div class="t">' + esc(a.titulo) + (a.lido_em ? ' <span class="chip green">Visto</span>' : ' <span class="chip amber">Não visto</span>') + '</div><pre class="mc-txt">' + esc(a.texto) + "</pre></div>").join("") + "</details></section>";
}

/* ---------- painel do administrador: escolher funcionário ---------- */
function equipePainelHtml() {
  const ps = (D.fin.pessoas || []).filter(p => p.ativo !== false);
  if (!ps.length) return "";
  const comLogin = new Set((D.perfis || []).map(x => x.pessoa_id).filter(Boolean));
  return '<section class="card"><h2>Equipe · Meu Controle</h2><p class="hint">Toque pra ver o app de cada um do jeito que ele vê.</p><div class="mc-pessoas">' +
    ps.map(p => '<button class="btn small" data-act="mc-ver" data-p="' + p.id + '">' + esc(p.nome) + (comLogin.has(p.id) ? " ✓" : "") + "</button>").join("") +
    '</div><p class="hint">✓ = já tem login no app.</p></section>';
}

/* ---------- configurações: logins da equipe (só o administrador) ---------- */
function loginsHtml() {
  const ps = D.fin.pessoas || [], perfis = (D.perfis || []).filter(x => !x.admin);
  const form = (x) => {
    const fs = x ? funcoesDe(x) : [], id = x ? x.id : "novo";
    return '<div class="mc-login">' + (x ? "" : '<div class="field"><label for="lg-n-' + id + '">Nome do login</label><input id="lg-n-' + id + '" placeholder="Ex.: Fabinho"></div>') +
      '<div class="field"><label for="lg-s-' + id + '">' + (x ? "Senha nova (deixe vazio pra manter a atual)" : "Senha") + '</label><div class="mc-senha"><input id="lg-s-' + id + '" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn small" data-act="lg-gerar" data-id="' + id + '">Gerar</button></div></div>' +
      '<div class="field"><span class="lbl">Funções</span>' + Object.keys(EQ.FUNCOES).map(f => '<label class="chk"><input type="checkbox" id="lg-f-' + id + "-" + f + '"' + (fs.includes(f) ? " checked" : "") + "> " + esc(EQ.FUNCOES[f]) + "</label>").join("") + "</div>" +
      '<div class="field"><label for="lg-p-' + id + '">Cadastro no Financeiro (de onde sai o controle dele)</label><select id="lg-p-' + id + '"><option value="">Nenhum</option>' + optsObj(ps.map(p => [p.id, p.nome + (p.tipo === "vendedor" ? " (vendedor)" : "")]), x ? x.pessoa_id || "" : "") + "</select></div>" +
      '<p class="err" id="lg-e-' + id + '"></p><button class="btn primary" data-act="lg-salvar" data-id="' + id + '">' + (x ? "Salvar" : "Criar login") + "</button>" + (x ? ' <button class="btn ghost" data-act="lg-x">Cancelar</button>' : "") + "</div>";
  };
  return '<section class="card"><h2>Equipe e logins</h2><p class="hint">Cada funcionário entra com o nome e a senha dele e só vê o que a função libera. Vendedor vê pedidos, agenda e clientes; carga, descarga e motorista veem o Meu Controle e as Ferramentas. Pra pôr alguém como vendedor com salário, mude o cadastro dele no Financeiro.</p>' +
    (loginMsg ? '<div class="okmsg" role="status">' + esc(loginMsg) + "</div>" : "") + loginNovoHtml() +
    '<p class="hint">A senha atual de ninguém aparece: o sistema guarda ela embaralhada e ninguém consegue ler, nem você. Se alguém esquecer, toque em <b>Senha</b>, gere ou digite uma nova e salve. Ela aparece aqui uma vez pra você passar pro funcionário.</p>' +
    perfis.map(x => { const pe = ps.find(p => p.id === x.pessoa_id);
      return '<div class="row"><div style="min-width:0"><div class="t">' + esc(x.nome) + '</div><div class="s">Usuário: <b>' + esc(x.nome) + "</b> · " + esc(nomeFuncoes(funcoesDe(x)) || "Sem função") + " · " + (pe ? "controle: " + esc(pe.nome) : "sem cadastro ligado") + '</div></div><button class="btn small" data-act="lg-editar" data-id="' + x.id + '">Senha / mudar</button></div>' + (loginEditando === x.id ? form(x) : ""); }).join("") +
    "<details" + (loginEditando === "novo" ? " open" : "") + '><summary>Criar login novo</summary>' + form(null) + "</details></section>";
}

/* login e senha nova que o Bruno acabou de pôr: mostra uma vez (some ao sair da tela), com botão pro WhatsApp */
function loginNovoHtml() {
  if (!loginNovo) return "";
  const txt = "Seu login no app da Tijolos Tavares:\nUsuário: " + loginNovo.nome + "\nSenha: " + loginNovo.senha;
  return '<div class="card aviso" role="status"><div class="t">Passe pro ' + esc(loginNovo.nome) + '</div><p>Usuário: <b>' + esc(loginNovo.nome) + '</b><br>Senha: <b>' + esc(loginNovo.senha) + '</b></p>' +
    '<a class="btn primary" target="_blank" rel="noopener" href="' + esc(waHref(loginNovo.tel, txt)) + '">Mandar no WhatsApp</a> <button class="btn ghost" data-act="lg-ok">Já passei</button>' +
    '<p class="hint">Depois que sair desta tela, a senha não aparece mais.</p></div>';
}
const gerarSenha = () => { const a = new Uint32Array(1); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : (a[0] = Math.random() * 1e9); return String(1000 + a[0] % 9000); };

/* ---------- ações ---------- */
async function mcClique(a, b) {
  if (a === "mc-ver") { L.verPessoa = b.dataset.p; L.tab = "controle"; L.mcSemana = EQ.semana(HOJE).de; D.mc = null; mcMsg = ""; salvarLocal(); render(); window.scrollTo(0, 0); return; }
  if (a === "mc-voltar") { L.tab = "painel"; L.verPessoa = null; D.mc = null; mcMsg = ""; salvarLocal(); render(); window.scrollTo(0, 0); return; }
  if (a === "mc-sem") { L.mcSemana = addDias(semanaMc().de, +b.dataset.n); mcMsg = ""; salvarLocal(); render(); return; }
  const p = pessoaMc(); if (!p) return;
  if (a === "mc-turno") {
    const d = b.dataset.d, t = b.dataset.t, atual = (D.mc.presencas || []).find(x => x.dia.slice(0, 10) === d);
    b.disabled = true;
    const r = atual && atual.turno === t ? await sb.from("func_presenca").delete().eq("pessoa_id", p.id).eq("dia", d)
      : await sb.from("func_presenca").upsert({ pessoa_id: p.id, dia: d, turno: t, atualizado_em: new Date().toISOString() });
    mcErro = r.error ? "Não salvou a presença. Confira a internet." : ""; await carregarControle(); render(); return;
  }
  if (a === "mc-anotar") {
    const dia = document.getElementById("mc-dia").value, tipo = document.getElementById("mc-tipo").value, v = parseNum(document.getElementById("mc-valor").value || "0"), obs = document.getElementById("mc-obs").value.trim();
    if (!dia) { avisoErro("mc-err", "Escolha o dia."); return; }
    if (!isFinite(v) || v < 0) { avisoErro("mc-err", "Valor inválido."); return; }
    if (!v && !obs) { avisoErro("mc-err", "Coloque o valor ou escreva o que foi."); return; }
    b.disabled = true; b.textContent = "Anotando…";
    const r = await sb.from("func_lancamentos").insert({ pessoa_id: p.id, dia, tipo, valor: r2(v), obs });
    if (r.error) { b.disabled = false; b.textContent = "Anotar"; avisoErro("mc-err", "Não salvou. Confira a internet."); return; }
    L.mcSemana = EQ.semana(dia).de; mcMsg = "Anotado: " + EQ.TIPOS[tipo] + " de " + diaCurto(dia) + "."; salvarLocal(); await carregarControle(); render(); return;
  }
  if (a === "mc-del") { const id = b.dataset.id; if (mcConfirm !== "del" + id) { mcConfirm = "del" + id; render(); return; } mcConfirm = null;
    const r = await sb.from("func_lancamentos").delete().eq("id", id); mcErro = r.error ? "Não apagou." : ""; mcMsg = r.error ? "" : "Anotação apagada."; await carregarControle(); render(); return; }
  if (a === "mc-conf") { await sb.from("func_lancamentos").update({ conferido: b.dataset.v === "1" }).eq("id", b.dataset.id); await carregarControle(); render(); return; }
  if (a === "mc-lido") { await sb.from("func_avisos").update({ lido_em: new Date().toISOString() }).eq("id", b.dataset.id); await carregarControle(); render(); return; }
  if (a === "mc-enviar") {
    const s = semanaMc(), rs = EQ.resumoSemana(ctxControle(), p, s.de, s.ate); b.disabled = true;
    const r = await sb.from("func_avisos").insert({ pessoa_id: p.id, semana: s.de, titulo: rs.titulo, texto: rs.texto });
    mcMsg = r.error ? "" : "Resumo mandado. Aparece no app do " + p.nome + " e vira notificação no celular dele."; mcErro = r.error ? "Não mandou. Confira a internet." : ""; await carregarControle(); render(); window.scrollTo(0, 0); return;
  }
}
async function loginClique(a, b) {
  if (a === "lg-editar") { loginEditando = loginEditando === b.dataset.id ? null : b.dataset.id; loginMsg = ""; render(); return true; }
  if (a === "lg-x") { loginEditando = null; render(); return true; }
  if (a === "lg-ok") { loginNovo = null; render(); return true; }
  if (a === "lg-gerar") { const i = document.getElementById("lg-s-" + b.dataset.id); if (i) i.value = gerarSenha(); return true; }
  if (a !== "lg-salvar") return false;
  const id = b.dataset.id, val = k => (document.getElementById("lg-" + k + "-" + id) || {}).value || "";
  const fs = Object.keys(EQ.FUNCOES).filter(f => (document.getElementById("lg-f-" + id + "-" + f) || {}).checked), pessoa = val("p") || null, senha = val("s");
  if (!fs.length) { avisoErro("lg-e-" + id, "Marque pelo menos uma função."); return true; }
  if (senha && senha.length < 4) { avisoErro("lg-e-" + id, "A senha precisa ter pelo menos 4 números ou letras."); return true; }
  b.disabled = true;
  let r;
  if (id === "novo") {
    const nome = val("n").trim(); if (!nome) { b.disabled = false; avisoErro("lg-e-" + id, "Digite o nome."); return true; }
    if (!senha) { b.disabled = false; avisoErro("lg-e-" + id, "Digite a senha."); return true; }
    r = await sb.rpc("criar_login", { p_nome: nome, p_senha: senha, p_funcoes: fs, p_pessoa: pessoa });
    if (!r.error) { loginMsg = "Login criado."; loginNovo = { nome, senha, tel: telDe(pessoa) }; lembrarNome(nome); }
  } else {
    r = await sb.rpc("mudar_login", { p_id: id, p_senha: senha || null, p_funcoes: fs, p_pessoa: pessoa });
    if (!r.error) { const x = (D.perfis || []).find(y => y.id === id); loginMsg = "Login atualizado." + (senha ? " Senha nova valendo." : ""); loginNovo = senha && x ? { nome: x.nome, senha, tel: telDe(pessoa) } : null; }
  }
  if (r.error) { b.disabled = false; avisoErro("lg-e-" + id, /existe/i.test(r.error.message) ? "Já existe um login com esse nome." : "Não deu certo: " + r.error.message); return true; }
  loginEditando = null; await carregar(); render(); return true;
}
const telDe = id => ((D.fin.pessoas || []).find(p => p.id === id) || {}).telefone || "";
const lembrarNome = n => { const l = ler("tt-nomes", []); if (!l.some(x => norm(x) === norm(n))) { l.push(n); gravar("tt-nomes", l); } };

/* ---------- avisos e notificações ---------- */
/* toda sexta a partir das 17h (ou sábado e domingo) o resumo da semana sai sozinho, uma vez */
async function resumoAutomatico() {
  if (ADM() || !TEM_CONTROLE() || !D.mc || !D.mc.pessoa) return;
  const agora = new Date(), w = agora.getDay(); if (!((w === 5 && agora.getHours() >= 17) || w === 6 || w === 0)) return;
  const s = EQ.semana(HOJE);
  if ((D.mc.avisos || []).some(a => String(a.semana).slice(0, 10) === s.de)) return;
  const rs = EQ.resumoSemana(ctxControle(), D.mc.pessoa, s.de, s.ate);
  const r = await sb.from("func_avisos").insert({ pessoa_id: D.mc.pessoa.id, semana: s.de, titulo: rs.titulo, texto: rs.texto });
  if (!r.error) await carregarControle();
}
/* resumo novo (mandado pelo Bruno ou o automático) vira notificação no celular */
async function notificarAvisos() {
  if (!Notif || ADM() || !D.mc) return;
  const vistos = ler("tt-avisos", []), novos = (D.mc.avisos || []).filter(a => !a.lido_em && !vistos.includes(a.id));
  if (!novos.length) return;
  try {
    const p = await Notif.checkPermissions(); if (p.display !== "granted") return;
    await Notif.schedule({ notifications: novos.slice(0, 3).map((a, i) => ({ id: 880000 + ((Date.now() / 1000 | 0) % 10000) * 3 + i, title: a.titulo, body: a.texto.split("\n").slice(1, 4).join(" · "), schedule: { at: new Date(Date.now() + 1500) } })) });
    gravar("tt-avisos", vistos.concat(novos.map(a => a.id)).slice(-60));
  } catch (e) {}
}
/* lembrete da sexta às 17h, mesmo com o app fechado */
function lembreteSexta() {
  if (ADM() || !TEM_CONTROLE()) return [];
  const d = new Date(); d.setHours(17, 0, 0, 0); while (d.getDay() !== 5 || d <= new Date()) d.setDate(d.getDate() + 1);
  const p = pessoaMc();
  return [{ id: 870000 + Number(ymd(d).replace(/-/g, "").slice(4)), title: "Meu Controle: resumo da semana", body: (p ? p.nome + ", " : "") + "seu resumo da semana está pronto. Abra o app e confira com o seu relatório.", schedule: { at: d } }];
}
