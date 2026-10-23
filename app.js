// Casa Du Vovô · controle interno.
// Fluxo: na ENTRADA anota quantos adultos e crianças entraram e qual comanda de papel recebeu;
// na SAÍDA a pessoa entrega a comanda e paga; na CONFERÊNCIA confere se todo mundo que entrou pagou.
// Interface em JavaScript puro: cada tela é uma função que devolve HTML,
// e os botões chamam ações pelo atributo data-acao.
'use strict';

const S = {
  token: lerLocal('token'),
  usuario: JSON.parse(lerLocal('usuario') || 'null'),
  data: null,
  estado: null,
  aba: lerLocal('aba') || 'entrada',
  subMais: 'ocorrencias',
  filtro: 'todas',
  busca: '',
  online: true,
  vouchers: [],
  config: null,
  historico: [],
  relatorio: '',
  modal: null,
  tmp: {},
  entrada: novaEntrada(),
  login: { usuario: null, pin: '' },
};

function novaEntrada() {
  return { numero: '', adultos: 2, criancas: 0, menores: 0, nome: '', reserva_id: null, mesas: [] };
}

// ---------- utilidades ----------
function lerLocal(k) { try { return localStorage.getItem(k); } catch { return null; } }
function gravarLocal(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem armazenamento */ } }
const $ = sel => document.querySelector(sel);
const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reais = c => 'R$ ' + (c / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
function centavos(txt) {
  const s = String(txt || '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Math.round(parseFloat(s) * 100);
  return Number.isFinite(n) ? n : 0;
}
const paraCampo = c => (c / 100).toFixed(2).replace('.', ',');
const dataBr = d => d.split('-').reverse().join('/');
const hora = iso => iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
const pode = (...papeis) => S.usuario && papeis.includes(S.usuario.papel);
const CAIXA = ['dono', 'atendente'];
const totalPessoas = x => x.adultos + x.criancas + x.menores;
const pessoas = (x, suf = '') => {
  const a = x['adultos' + suf], c = x['criancas' + suf], m = x['menores' + suf];
  const p = [`${a} adulto${a === 1 ? '' : 's'}`];
  if (c) p.push(`${c} criança${c === 1 ? '' : 's'} 6–10`);
  if (m) p.push(`${m} menor${m === 1 ? '' : 'es'} de 6`);
  return p.join(' · ');
};
const SITUACAO = { livre: 'Livre', reservada: 'Reservada', ocupada: 'Ocupada', limpando: 'Limpando' };
const FORMA = { pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro' };
const telaLarga = () => matchMedia('(min-width: 1100px)').matches;
const PAPEL = { dono: 'Dono', atendente: 'Recepção e caixa', patio: 'Pátio e porta' };

// Ícones no estilo Lucide (traço), desenhados em SVG para não depender de internet.
const ICONES = {
  entrada: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>',
  saida: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  conferencia: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  mesas: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  vouchers: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
  mais: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  busca: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
};
const icone = nome => `<svg class="icone" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome]}</svg>`;
const TITULOS = {
  entrada: ['Quem está chegando', 'Entrada'],
  saida: ['Na hora de ir embora', 'Saída e caixa'],
  conferencia: ['Fim do dia', 'Conferência'],
  mesas: ['Salão', 'Mesas'],
  vouchers: ['Cortesias e descontos', 'Vouchers'],
  mais: ['Outros', 'Mais'],
};
const diaPorExtenso = d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const saudacao = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
// Valor grande com os centavos apagados: R$ 1.240,00
const valorGrande = c => { const [r, cent] = reais(c).split(','); return `${r}<span class="cent">,${cent}</span>`; };

function kpi(rotulo, valorHtml, { icon, rodape = '', classe = '' } = {}) {
  return `<div class="kpi ${classe}">
    <div class="topo-kpi">${icon ? `<span class="bola">${icone(icon)}</span>` : ''}<span class="rotulo">${rotulo}</span></div>
    <div class="grande-num">${valorHtml}</div>
    ${rodape ? `<div class="rodape-kpi">${rodape}</div>` : ''}
  </div>`;
}

// Quantas pessoas entraram em cada hora do dia (barras listradas; a hora de pico em laranja).
function graficoHoras() {
  const porHora = new Map();
  for (const c of S.estado.comandas) {
    const h = new Date(c.aberta_em).getHours();
    porHora.set(h, (porHora.get(h) || 0) + c.adultos_entrada + c.criancas_entrada + c.menores_entrada);
  }
  const horas = porHora.size ? [...porHora.keys()] : [8];
  const ini = Math.min(8, ...horas), fim = Math.max(12, ...horas);
  const max = Math.max(1, ...porHora.values());
  const pico = porHora.size ? [...porHora.entries()].sort((a, b) => b[1] - a[1])[0][0] : -1;
  const cols = [];
  for (let h = ini; h <= fim; h++) {
    const v = porHora.get(h) || 0;
    cols.push(`<div class="col"><div class="bar ${h === pico ? 'top' : ''}" style="height:${Math.max(6, (v / max) * 100)}%">${v ? `<span class="v">${v}</span>` : ''}</div><span class="h">${h}h</span></div>`);
  }
  return `<div class="card"><div class="cab" style="margin-bottom:0"><h3>Entradas por hora</h3><span class="rotulo">pessoas</span></div>
    <div class="grafico">${cols.join('')}</div></div>`;
}

function avisar(msg, erro = false) {
  const d = document.createElement('div');
  d.textContent = msg;
  if (erro) d.className = 'erro';
  $('#aviso').appendChild(d);
  setTimeout(() => d.remove(), erro ? 5000 : 2500);
}

// ---------- comunicação com o servidor ----------
async function api(metodo, url, corpo) {
  const sep = url.includes('?') ? '&' : '?';
  const comData = S.data && !url.includes('data=') ? `${url}${sep}data=${S.data}` : url;
  let r;
  try {
    r = await fetch(comData, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
      body: corpo ? JSON.stringify({ data: S.data, ...corpo }) : undefined,
    });
  } catch {
    S.online = false; render();
    throw new Error('Sem conexão com o sistema.');
  }
  const json = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token) { sair(); throw new Error(json.erro || 'Entre novamente.'); }
  if (!r.ok) throw new Error(json.erro || 'Algo deu errado.');
  if (metodo !== 'GET' && S.token) carregarLogo();
  return json;
}

// Junta vários pedidos de atualização seguidos (ação local + aviso do servidor) numa busca só.
let esperaCarregar = null;
function carregarLogo() {
  clearTimeout(esperaCarregar);
  esperaCarregar = setTimeout(carregar, 80);
}

// Executa uma ação; mostra o erro se der problema.
async function fazer(fn, ok) {
  try { const r = await fn(); if (ok) avisar(ok); return r; }
  catch (err) { avisar(err.message, true); return undefined; }
}
// Igual, mas fecha a janela quando dá certo.
async function fazerEFechar(fn, ok) {
  const r = await fazer(fn, ok);
  if (r) fecharModal();
  return r;
}

async function carregar() {
  try {
    S.estado = await api('GET', '/api/estado');
    S.data = S.estado.data;
    S.online = true;
  } catch { /* a faixa de "sem conexão" já avisa */ }
  render();
}

let fonte = null;
function conectarTempoReal() {
  if (fonte) fonte.close();
  fonte = new EventSource('/api/eventos?token=' + encodeURIComponent(S.token));
  fonte.onmessage = ev => {
    const { data } = JSON.parse(ev.data);
    if (data === S.data) carregarLogo();
    if (S.aba === 'vouchers') carregarVouchers();
  };
  fonte.onopen = () => { if (!S.online) { S.online = true; carregar(); } };
  fonte.onerror = () => { S.online = false; render(); };
}

function sair() {
  S.token = null; S.usuario = null; S.estado = null;
  gravarLocal('token', null); gravarLocal('usuario', null);
  if (fonte) fonte.close();
  fecharModal();
  render();
}

// ---------- tela de entrada no sistema (PIN) ----------
let usuariosLogin = [];
async function telaLogin() {
  if (!usuariosLogin.length) {
    try { usuariosLogin = await (await fetch('/api/usuarios-login')).json(); } catch { usuariosLogin = []; }
  }
  const u = S.login.usuario;
  const pontos = Math.max(4, S.login.pin.length);
  $('#app').innerHTML = `
    <div class="login">
      <div class="login-foto"><div class="frase"><b>Café, comida e prosa.</b><span>Controle do domingo da Casa Du Vovô</span></div></div>
      <div class="login-caixa"><div class="login-cartao">
        <img src="logo.png" alt="Casa Du Vovô">
        <h1>${u ? `Olá, ${e(u.nome)}` : 'Bem-vindo'}</h1>
        <div class="sub">${u ? 'Digite sua senha' : 'Quem vai usar agora?'}</div>
        ${!u ? `
          <div class="usuarios">
            ${usuariosLogin.map(x => `<button class="usuario-btn" data-acao="login-usuario" data-id="${x.id}">
              <span class="avatar">${e(x.nome[0] || '?')}</span><span>${e(x.nome)}<small>${PAPEL[x.papel] || ''}</small></span></button>`).join('')
              || '<div class="vazio">Não foi possível falar com o sistema. Confira a conexão.</div>'}
          </div>` : `
          <div class="pin-pontos">${Array.from({ length: pontos }, (_, i) => `<i class="${i < S.login.pin.length ? 'cheio' : ''}"></i>`).join('')}</div>
          <div class="teclado">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-acao="pin" data-d="${n}">${n}</button>`).join('')}
            <button data-acao="login-voltar" aria-label="voltar">←</button>
            <button data-acao="pin" data-d="0">0</button>
            <button class="ok" data-acao="login-entrar">Entrar</button>
          </div>`}
      </div></div>
    </div>`;
}

// ---------- estrutura geral ----------
function abas() {
  const lista = [['entrada', 'Entrada']];
  if (pode(...CAIXA)) lista.push(['saida', 'Saída'], ['conferencia', 'Conferência']);
  lista.push(['mesas', 'Mesas']);
  if (pode(...CAIXA)) lista.push(['vouchers', 'Vouchers']);
  lista.push(['mais', pode(...CAIXA) ? 'Mais' : 'Ocorrências']);
  return lista;
}

function render() {
  if (!S.token) return telaLogin();
  if (!S.estado) { $('#app').innerHTML = '<div class="vazio">Carregando…</div>'; return; }
  if (!abas().some(([id]) => id === S.aba)) S.aba = 'entrada';
  const st = S.estado;
  const ehHoje = st.data === st.hoje;

  // Guarda o campo em que a pessoa está digitando, para devolver o foco depois de redesenhar.
  const ativo = document.activeElement;
  const foco = ativo && $('#app').contains(ativo) && ativo.dataset?.mudar
    ? { chave: ativo.dataset.mudar, ini: ativo.selectionStart, fim: ativo.selectionEnd } : null;

  const telas = { entrada: telaEntrada, saida: telaSaida, conferencia: telaConferencia, mesas: telaMesas, vouchers: telaVouchers, mais: telaMais };
  const [, titulo] = TITULOS[S.aba];
  $('#app').innerHTML = `
    <div class="casca">
      <aside class="menu">
        <div class="marca"><img src="logo.png" alt=""><div><b>Casa Du Vovô</b><span>Café, Comida e Prosa</span></div></div>
        <nav>${abas().map(([id, nome]) => `<button class="${S.aba === id ? 'ativa' : ''}" data-acao="aba" data-id="${id}">${icone(id)}<span>${nome}</span></button>`).join('')}</nav>
        <div class="menu-pe">
          <span class="avatar">${e(S.usuario.nome[0] || '?')}</span>
          <div><b>${e(S.usuario.nome)}</b><span>${PAPEL[S.usuario.papel]}</span></div>
          <button class="sair" data-acao="sair" aria-label="Sair" title="Sair">${icone('sair')}</button>
        </div>
      </aside>
      <div class="conteudo">
        <div class="topo-mobile"><img src="logo.png" alt=""><b>Casa Du Vovô</b>
          <span>${e(S.usuario.nome)}</span><button class="sair" data-acao="sair">sair</button></div>
        <header class="topo">
          <div><div class="sobre">${saudacao()}, ${e(S.usuario.nome)} · ${diaPorExtenso(st.data)}</div><h1>${titulo}</h1></div>
          <div class="topo-acoes">
            ${pode(...CAIXA) ? `<input type="date" class="dia" value="${st.data}" data-trocar="dia" aria-label="Escolher dia">` : ''}
            <div class="quem"><span class="avatar">${e(S.usuario.nome[0] || '?')}</span><div><b>${e(S.usuario.nome)}</b><small>${PAPEL[S.usuario.papel]}</small></div></div>
          </div>
        </header>
        ${S.online ? '' : '<div class="faixa offline">Sem conexão com o sistema. As telas podem estar desatualizadas.</div>'}
        ${!ehHoje ? `<div class="faixa info">Você está vendo o dia ${dataBr(st.data)} · <a href="#" data-acao="ir-hoje">voltar para hoje</a></div>` : ''}
        ${st.dia.fechado_em ? '<div class="faixa info">O caixa deste dia já foi fechado.</div>' : ''}
        <main>${telas[S.aba]()}</main>
      </div>
    </div>
    <div class="so-impressao">${placasImpressao()}</div>`;

  if (foco) {
    const i = $(`#app [data-mudar="${foco.chave}"]`);
    if (i) { i.focus(); try { i.setSelectionRange(foco.ini, foco.fim); } catch { /* campo sem seleção */ } }
  }
  renderModal();
}

// ---------- ENTRADA ----------
const mesaPorId = id => S.estado.mesas.find(m => m.id === id);
const reservaPorId = id => S.estado.reservas.find(r => r.id === id);
const comandaPorId = id => S.estado.comandas.find(c => c.id === id);
const numeros = ids => ids.map(id => mesaPorId(id)?.numero ?? '?').join(', ');
const valorDe = x => x.adultos * S.estado.precos.adulto + x.criancas * S.estado.precos.crianca + x.menores * S.estado.precos.menor;

function contador(acao, campo, rot, sub, valor, extra = '') {
  return `
    <div class="contador">
      <div class="rot">${rot}<small>${sub}</small></div>
      <div class="ctl">
        <button type="button" data-acao="${acao}" data-campo="${campo}" data-d="-1" ${extra} aria-label="menos ${rot}">−</button>
        <span>${valor}</span>
        <button type="button" data-acao="${acao}" data-campo="${campo}" data-d="1" ${extra} aria-label="mais ${rot}">+</button>
      </div>
    </div>`;
}

function telaEntrada() {
  const t = S.entrada;
  const p = S.estado.precos;
  const numero = t.numero || S.estado.proximoNumero;
  const r = t.reserva_id ? reservaPorId(t.reserva_id) : null;
  const form = `
    <form class="card entrada" data-form="entrada">
      <div class="cab" style="margin-bottom:0"><h2>Nova entrada</h2>
        ${r ? `<span class="pill evento">reserva: ${e(r.nome)}</span><button type="button" class="btn sec peq" data-acao="entrada-limpar">limpar</button>` : ''}</div>
      <label for="ent-num">Nº da comanda entregue</label>
      <input id="ent-num" class="numero-comanda" name="numero" value="${e(numero)}" data-mudar="entrada-numero" inputmode="numeric" autocomplete="off">
      ${contador('entrada-conta', 'adultos', 'Adultos', `11 anos ou mais · ${reais(p.adulto)}`, t.adultos)}
      ${contador('entrada-conta', 'criancas', 'Crianças', `6 a 10 anos · ${reais(p.crianca)}`, t.criancas)}
      ${contador('entrada-conta', 'menores', 'Menores de 6', `até 5 anos${p.menor ? ' · ' + reais(p.menor) : ' · não paga'}`, t.menores)}
      <div class="grade2" style="margin-top:6px">
        <div><label for="ent-nome">Nome (opcional)</label>
          <input id="ent-nome" name="nome" value="${e(t.nome)}" data-mudar="entrada-nome" autocomplete="off"></div>
        <div><label>Mesa (opcional)</label>
          <button type="button" class="btn sec bloco" data-acao="entrada-mesa">${t.mesas.length ? 'Mesa ' + numeros(t.mesas) : 'Escolher mesa'}</button></div>
      </div>
      <button class="btn bloco grande" type="submit" style="margin-top:12px">
        Registrar entrada · ${totalPessoas(t)} pessoa${totalPessoas(t) === 1 ? '' : 's'} · ${reais(valorDe(t))}</button>
    </form>`;

  const ultimas = [...S.estado.comandas].reverse().slice(0, 8);
  const listaUltimas = `
    <div class="secao" style="margin-top:14px">
      <div class="cab"><h3>Últimas entradas</h3></div>
      <div class="lista">${ultimas.map(c => `
        <div class="item" data-acao="abrir-comanda" data-id="${c.id}" style="cursor:pointer">
          <div class="num-comanda">${e(c.numero)}</div>
          <div class="info"><div class="nome">${e(c.nome) || 'Sem nome'} ${seloComanda(c)}</div>
            <div class="det">${pessoas(c, '_entrada')} · ${hora(c.aberta_em)}${c.mesas.length ? ' · mesa ' + numeros(c.mesas) : ''}</div></div>
        </div>`).join('') || '<div class="vazio">Ninguém entrou ainda.</div>'}</div>
    </div>`;

  const st = S.estado;
  const dentro = st.comandas.filter(c => c.status === 'aberta');
  const somaPessoas = (l, suf = '') => l.reduce((s, c) => s + c['adultos' + suf] + c['criancas' + suf] + c['menores' + suf], 0);
  const kpis = `<div class="kpis">
    ${kpi('Lá dentro agora', somaPessoas(dentro), { icon: 'mesas', classe: 'destaque', rodape: `${dentro.length} comanda${dentro.length === 1 ? '' : 's'} abertas` })}
    ${kpi('Entraram hoje', somaPessoas(st.comandas, '_entrada'), { icon: 'entrada', rodape: `${st.comandas.length} grupo${st.comandas.length === 1 ? '' : 's'}` })}
    ${kpi('A receber lá dentro', valorGrande(dentro.reduce((s, c) => s + c.total, 0)), { icon: 'saida', rodape: 'quando as comandas voltarem' })}
    ${kpi('Reservas aguardando', st.reservas.filter(r => r.status === 'aguardando').length, { icon: 'vouchers', rodape: `${st.reservas.filter(r => r.status === 'chegou').length} já chegaram` })}
  </div>`;

  const reservas = blocoReservas();
  if (telaLarga()) {
    return `${kpis}<div class="duas-col"><div>${form}<div style="margin-top:16px">${listaUltimas}</div></div>
      <div class="lateral">${graficoHoras()}<div class="card" style="margin-top:16px">${reservas}</div></div></div>`;
  }
  return kpis + form + `<div class="card" style="margin-top:16px">${reservas}</div>` + `<div style="margin-top:16px">${listaUltimas}</div>`;
}

function seloComanda(c) {
  if (c.status === 'fechada') return '<span class="pill ok">pago</span>';
  if (c.status === 'nao_pago') return '<span class="pill alerta">saiu sem pagar</span>';
  return '<span class="pill laranja">lá dentro</span>';
}

function blocoReservas() {
  const busca = S.busca.trim().toLowerCase();
  const ordem = { aguardando: 0, chegou: 1, faltou: 2, cancelada: 3 };
  const reservas = S.estado.reservas
    .filter(r => !busca || r.nome.toLowerCase().includes(busca))
    .sort((a, b) => ordem[a.status] - ordem[b.status]);
  const aguard = S.estado.reservas.filter(r => r.status === 'aguardando');
  return `
    <div class="cab"><h3>Reservas do dia · ${aguard.length} aguardando</h3></div>
    ${pode(...CAIXA) ? `<div class="linha-btns" style="margin-bottom:8px">
      <button class="btn sec peq" data-acao="nova-reserva">+ Reserva</button>
      <button class="btn sec peq" data-acao="colar">Colar lista</button>
      <button class="btn sec peq" data-acao="imprimir">Imprimir nomes das mesas</button>
    </div>` : ''}
    <div class="busca" style="margin-bottom:6px">${icone('busca')}
      <input type="search" placeholder="Buscar reserva pelo nome…" value="${e(S.busca)}" data-mudar="busca" autocomplete="off">
    </div>
    <div class="atalho">Digite o nome e aperte <kbd>Enter</kbd> para puxar a reserva para a entrada.</div>
    <div class="lista">
      ${reservas.map(r => `
        <div class="item ${['faltou', 'cancelada'].includes(r.status) ? 'apagado' : ''}">
          <div class="info" ${pode(...CAIXA) ? `data-acao="editar-reserva" data-id="${r.id}" style="cursor:pointer"` : ''}>
            <div class="nome">${e(r.nome)} ${r.tipo === 'evento' ? '<span class="pill evento">evento</span>' : ''}
              ${r.status === 'chegou' ? `<span class="pill ok">entrou ${hora(r.chegou_em)}</span>` : ''}
              ${r.status === 'faltou' ? '<span class="pill alerta">faltou</span>' : ''}
              ${r.status === 'cancelada' ? '<span class="pill neutro">cancelada</span>' : ''}</div>
            <div class="det">${pessoas(r)}${r.mesas.length ? ' · mesa ' + numeros(r.mesas) : ''}${r.obs ? ' · ' + e(r.obs) : ''}</div>
          </div>
          ${r.status === 'aguardando' ? `<button class="btn verde" data-acao="chegou" data-id="${r.id}">Chegou</button>` : ''}
        </div>`).join('') || `<div class="vazio">${S.estado.reservas.length ? 'Ninguém com esse nome.' : 'Nenhuma reserva neste dia.'}</div>`}
    </div>`;
}

function placasImpressao() {
  const placas = [];
  for (const r of S.estado.reservas.filter(x => x.status === 'aguardando')) {
    for (const mid of r.mesas) placas.push({ nome: r.nome, mesa: mesaPorId(mid)?.numero });
  }
  return placas.map(p => `<div class="placa"><img src="logo.png" alt=""><div class="r">Reservado</div>
    <div class="n">${e(p.nome)}</div><div class="m">Mesa ${e(p.mesa)}</div></div>`).join('');
}

function modalReserva(id) {
  const r = id ? reservaPorId(id) : null;
  if (S.tmp.reserva?.id !== (id || null)) S.tmp.reserva = { id: id || null, mesas: r ? [...r.mesas] : [] };
  const t = S.tmp.reserva;
  const v = (campo, padrao = '') => e(r ? r[campo] ?? padrao : padrao);
  return janela(r ? 'Editar reserva' : 'Nova reserva', `
    <form data-form="reserva">
      <label>Nome</label><input name="nome" value="${v('nome')}" required autocomplete="off">
      <div class="grade3">
        <div><label>Adultos</label><input name="adultos" type="number" min="0" inputmode="numeric" value="${v('adultos', 2)}"></div>
        <div><label>Crianças 6–10</label><input name="criancas" type="number" min="0" inputmode="numeric" value="${v('criancas', 0)}"></div>
        <div><label>Menores de 6</label><input name="menores" type="number" min="0" inputmode="numeric" value="${v('menores', 0)}"></div>
      </div>
      <div class="grade2">
        <div><label>Tipo</label><select name="tipo">
          <option value="familia" ${r?.tipo !== 'evento' ? 'selected' : ''}>Família / mesa</option>
          <option value="evento" ${r?.tipo === 'evento' ? 'selected' : ''}>Evento (aniversário, chá…)</option></select></div>
        <div><label>Telefone</label><input name="telefone" value="${v('telefone')}" inputmode="tel"></div>
      </div>
      <label>Observação</label><input name="obs" value="${v('obs')}" placeholder="ex.: quer sombra, cadeira de bebê">
      <label>Mesas ${t.mesas.length ? `(${numeros(t.mesas)})` : '(opcional, toque para escolher)'}</label>
      ${gradeMesas(S.estado.mesas, { acao: 'reserva-mesa', selecionadas: t.mesas })}
      <button class="btn bloco grande" type="submit">Salvar</button>
    </form>
    ${r && r.status !== 'chegou' ? `<div class="linha-btns" style="margin-top:8px">
      ${r.status === 'aguardando'
        ? `<button class="btn sec" data-acao="reserva-status" data-id="${r.id}" data-status="faltou">Faltou</button>
           <button class="btn sec" data-acao="reserva-status" data-id="${r.id}" data-status="cancelada">Cancelou</button>`
        : `<button class="btn sec" data-acao="reserva-status" data-id="${r.id}" data-status="aguardando">Voltar para aguardando</button>`}
      <button class="btn perigo" data-acao="apagar-reserva" data-id="${r.id}">Apagar</button></div>` : ''}`);
}

function modalColar() {
  return janela('Colar lista de reservas', `
    <p style="margin-top:0;color:var(--mudo);font-size:.9rem">Uma reserva por linha, separando com ponto e vírgula:<br>
    <b>Nome; adultos; crianças 6–10; menores de 6; mesas; observação</b><br>
    Ex.: <code>Família Silva; 4; 1; 0; 12; quer sombra</code><br>
    Só o nome é obrigatório. Também dá para colar direto de uma planilha.</p>
    <form data-form="colar">
      <textarea name="texto" placeholder="Cole aqui…" required></textarea>
      <button class="btn bloco grande" type="submit" style="margin-top:10px">Importar</button>
    </form>`);
}

// ---------- SAÍDA (pagamento) ----------
const ordemNumero = (a, b) => (Number(a.numero) || 1e9) - (Number(b.numero) || 1e9) || a.numero.localeCompare(b.numero);

function resultadosBusca() {
  const busca = S.busca.trim().toLowerCase();
  if (!busca) return [];
  if (S.aba === 'entrada') {
    return S.estado.reservas.filter(r => r.status === 'aguardando' && r.nome.toLowerCase().includes(busca));
  }
  if (S.aba === 'saida') {
    const abertas = S.estado.comandas.filter(c => c.status === 'aberta');
    const exata = abertas.filter(c => c.numero.toLowerCase() === busca);
    return exata.length ? exata : abertas.filter(c => c.nome.toLowerCase().includes(busca));
  }
  return [];
}

function telaSaida() {
  const st = S.estado;
  const c = st.caixa;
  const busca = S.busca.trim().toLowerCase();
  const abertas = st.comandas.filter(x => x.status === 'aberta')
    .filter(x => !busca || x.numero.toLowerCase().startsWith(busca) || x.nome.toLowerCase().includes(busca))
    .sort(ordemNumero);
  const encerradas = st.comandas.filter(x => x.status !== 'aberta').reverse();

  const abertasHtml = `
    <div class="busca" style="margin-bottom:6px">${icone('busca')}
      <input type="search" class="busca-grande" placeholder="Número da comanda…" value="${e(S.busca)}" data-mudar="busca" inputmode="numeric" autocomplete="off">
    </div>
    <div class="atalho">Digite o número da comanda e aperte <kbd>Enter</kbd>.</div>
    <div class="secao">
      <div class="cab"><h3>Comandas lá dentro (${st.comandas.filter(x => x.status === 'aberta').length})</h3></div>
      <div class="lista">
        ${abertas.map(x => `
          <div class="item" data-acao="abrir-comanda" data-id="${x.id}" style="cursor:pointer">
            <div class="num-comanda">${e(x.numero)}</div>
            <div class="info"><div class="nome">${e(x.nome) || 'Sem nome'}</div>
              <div class="det">${pessoas(x)} · entrou ${hora(x.aberta_em)}${x.vouchers.length ? ' · <span class="pill ok">voucher</span>' : ''}</div></div>
            <div style="text-align:right"><b>${reais(x.total)}</b>${x.pago ? `<div class="det">falta ${reais(Math.max(x.falta, 0))}</div>` : ''}</div>
          </div>`).join('') || `<div class="vazio">${busca ? 'Nenhuma comanda com esse número lá dentro.' : 'Ninguém lá dentro.'}</div>`}
      </div>
    </div>`;

  const maxForma = Math.max(1, c.porForma.pix, c.porForma.cartao, c.porForma.dinheiro);
  const barra = (forma, nome) => `<div class="barra-forma ${forma}"><span>${nome}</span>
    <div class="trilho-b"><i style="width:${(c.porForma[forma] / maxForma) * 100}%"></i></div><b>${reais(c.porForma[forma])}</b></div>`;
  const caixaHtml = `
    <div class="secao">
      <div class="kpi destaque" style="margin-bottom:14px">
        <div class="topo-kpi"><span class="bola">${icone('saida')}</span><span class="rotulo">Recebido hoje</span></div>
        <div class="grande-num">${valorGrande(c.recebido)}</div>
        <div class="rodape-kpi">${st.comandas.filter(x => x.status === 'fechada').length} comandas pagas</div>
      </div>
      <div class="card" style="margin-bottom:14px">
        <div class="cab"><h3>Por forma de pagamento</h3></div>
        <div class="barras-forma">${barra('pix', 'Pix')}${barra('cartao', 'Cartão')}${barra('dinheiro', 'Dinheiro')}</div>
      </div>
      <div class="card">
        <div class="cab" style="margin-bottom:4px"><h3>Potinho (dinheiro)</h3></div>
        <table class="conta">
          <tr><td>Troco inicial <button class="btn sec peq" data-acao="troco" style="margin-left:6px">alterar</button></td><td>${reais(st.dia.troco_inicial)}</td></tr>
          <tr><td>+ Recebido em dinheiro</td><td>${reais(c.porForma.dinheiro)}</td></tr>
          ${st.movimentos.map(m => `<tr><td>${m.tipo === 'retirada' ? '− Retirada' : '+ Reposição'} · ${e(m.quem)} · ${e(m.motivo)}
            <span style="color:var(--mudo);font-size:.8rem">${hora(m.em)}</span>
            ${pode('dono') ? `<button class="btn perigo peq" data-acao="apagar-movimento" data-id="${m.id}">apagar</button>` : ''}</td>
            <td>${m.tipo === 'retirada' ? '−' : ''}${reais(m.valor)}</td></tr>`).join('')}
          <tr class="total"><td>Deve ter no potinho</td><td>${reais(c.dinheiroEsperado)}</td></tr>
        </table>
        <div class="linha-btns" style="margin-top:10px">
          <button class="btn sec" data-acao="movimento" data-tipo="retirada">Registrar retirada</button>
          <button class="btn sec" data-acao="movimento" data-tipo="reposicao">Registrar reposição</button>
        </div>
      </div>
    </div>`;

  const encerradasHtml = encerradas.length ? `<div class="secao"><div class="cab"><h3>Já saíram (${encerradas.length})</h3></div><div class="lista">
    ${encerradas.map(x => `<div class="item" data-acao="abrir-comanda" data-id="${x.id}" style="cursor:pointer">
      <div class="num-comanda">${e(x.numero)}</div>
      <div class="info"><div class="nome">${e(x.nome) || 'Sem nome'} ${seloComanda(x)}</div>
      <div class="det">${pessoas(x)} · ${x.pagamentos.map(p => FORMA[p.forma]).join(' + ') || (x.status === 'nao_pago' ? e(x.motivo_nao_pago) : 'sem pagamento')} · ${hora(x.fechada_em)}</div></div>
      <b>${x.status === 'nao_pago' ? '—' : reais(x.total)}</b></div>`).join('')}</div></div>` : '';

  return telaLarga()
    ? `<div class="duas-col"><div>${abertasHtml}${encerradasHtml}</div><div class="lateral">${caixaHtml}</div></div>`
    : abertasHtml + caixaHtml + encerradasHtml;
}

function modalComanda(id) {
  const c = comandaPorId(id);
  if (!c) return fecharModal();
  const p = S.estado.precos;
  const aberta = c.status === 'aberta';
  const cobraMenos = c.adultos < c.adultos_entrada || c.criancas < c.criancas_entrada || c.menores < c.menores_entrada;
  const linhas = [
    `<tr><td>${c.adultos} adulto(s) × ${reais(p.adulto)}</td><td>${reais(c.adultos * p.adulto)}</td></tr>`,
    c.criancas ? `<tr><td>${c.criancas} criança(s) 6–10 × ${reais(p.crianca)}</td><td>${reais(c.criancas * p.crianca)}</td></tr>` : '',
    c.menores ? `<tr><td>${c.menores} menor(es) de 6${p.menor ? ' × ' + reais(p.menor) : ''}</td><td>${reais(c.menores * p.menor)}</td></tr>` : '',
    ...c.vouchers.map(v => `<tr class="desc"><td>Voucher ${e(v.codigo)} · ${e(v.cliente)}
      ${aberta && pode(...CAIXA) ? `<button class="btn perigo peq" data-acao="tirar-voucher" data-comanda="${c.id}" data-id="${v.id}">tirar</button>` : ''}</td><td>−${reais(v.abatido)}</td></tr>`),
    c.desconto ? `<tr class="desc"><td>Desconto · ${e(c.desconto_motivo)} (autorizado: ${e(c.desconto_autorizado_por)})</td><td>−${reais(c.desconto)}</td></tr>` : '',
    `<tr class="total"><td>Total</td><td>${reais(c.total)}</td></tr>`,
    ...c.pagamentos.map(pg => `<tr><td>${FORMA[pg.forma]} · ${hora(pg.em)}
      ${aberta && pode(...CAIXA) ? `<button class="btn perigo peq" data-acao="tirar-pagamento" data-comanda="${c.id}" data-id="${pg.id}">tirar</button>` : ''}</td><td>${reais(pg.valor)}</td></tr>`),
    c.pago && c.falta > 0 ? `<tr class="falta"><td>Falta receber</td><td>${reais(c.falta)}</td></tr>` : '',
    c.falta < 0 ? `<tr class="falta"><td>Pago a mais · devolver ao cliente</td><td>${reais(-c.falta)}</td></tr>` : '',
  ].join('');

  let acoesHtml = '';
  if (aberta && pode(...CAIXA)) {
    acoesHtml = `
      ${c.falta > 0 ? `<div class="grade3" style="margin-top:10px">
        <button class="btn grande" data-acao="pagar" data-comanda="${c.id}" data-forma="pix">Pix</button>
        <button class="btn grande" data-acao="pagar" data-comanda="${c.id}" data-forma="cartao">Cartão</button>
        <button class="btn grande" data-acao="pagar" data-comanda="${c.id}" data-forma="dinheiro">Dinheiro</button>
      </div>` : c.falta < 0
        ? `<div class="card" style="margin-top:10px;border-color:var(--vermelho);color:var(--vermelho)">
            Recebeu ${reais(-c.falta)} a mais. Devolva ao cliente, toque em “tirar” no pagamento e registre o valor certo.</div>`
        : `<button class="btn verde bloco grande" style="margin-top:10px" data-acao="fechar-comanda" data-id="${c.id}">Pago · liberar comanda ${e(c.numero)}</button>`}
      <form data-form="voucher" data-comanda="${c.id}" class="grade2" style="margin-top:10px;grid-template-columns:1fr auto">
        <input name="codigo" placeholder="Código do voucher (VOVO-…)" autocomplete="off" style="text-transform:uppercase">
        <button class="btn sec" type="submit">Aplicar</button>
      </form>
      <div class="linha-btns" style="margin-top:8px">
        <button class="btn sec" data-acao="desconto" data-comanda="${c.id}">Desconto (dono)</button>
        ${c.pago ? '' : `<button class="btn perigo" data-acao="nao-pago" data-id="${c.id}">Saiu sem pagar</button>`}
      </div>`;
  } else if (!aberta && pode(...CAIXA)) {
    acoesHtml = `<button class="btn sec bloco" style="margin-top:10px" data-acao="reabrir-comanda" data-id="${c.id}">Reabrir (dono)</button>`;
  }

  return janela(`Comanda ${e(c.numero)}${c.nome ? ' · ' + e(c.nome) : ''} ${seloComanda(c)}`, `
    <div class="card" style="margin-bottom:10px">
      <div style="font-size:.9rem;color:var(--mudo)">Na entrada (${hora(c.aberta_em)}, por ${e(c.registrada_por)}):</div>
      <div style="font-weight:700;color:var(--tinta)">${pessoas(c, '_entrada')}${c.mesas.length ? ` · mesa ${numeros(c.mesas)}` : ''}</div>
      ${c.status === 'nao_pago' ? `<div style="color:var(--vermelho);margin-top:4px">Saiu sem pagar: ${e(c.motivo_nao_pago)}</div>` : ''}
    </div>
    ${aberta ? `<div class="card">
      <div style="font-weight:700;color:var(--tinta);margin-bottom:2px">Cobrar</div>
      ${contador('pessoa', 'adultos', 'Adultos', reais(p.adulto), c.adultos, `data-comanda="${c.id}"`)}
      ${contador('pessoa', 'criancas', 'Crianças 6–10', reais(p.crianca), c.criancas, `data-comanda="${c.id}"`)}
      ${contador('pessoa', 'menores', 'Menores de 6', p.menor ? reais(p.menor) : 'não paga', c.menores, `data-comanda="${c.id}"`)}
      ${cobraMenos ? '<div class="pill alerta" style="margin-top:6px">Cobrando menos gente do que entrou. Vai aparecer na conferência.</div>' : ''}
      <button class="btn sec peq" style="margin-top:8px" data-acao="corrigir-entrada" data-id="${c.id}">Erro na porta? Corrigir a entrada para esses números</button>
    </div>` : ''}
    <div class="card" style="margin-top:10px"><table class="conta">${linhas}</table></div>
    ${acoesHtml}`);
}

function modalPagar() {
  const t = S.tmp.pagar;
  const c = comandaPorId(t.comanda);
  if (!c) return fecharModal();
  const dinheiro = t.forma === 'dinheiro';
  return janela(`${FORMA[t.forma]} · Comanda ${e(c.numero)}`, `
    <div style="font-size:1.1rem">Falta receber: <b>${reais(c.falta)}</b></div>
    <form data-form="pagar">
      <label>${dinheiro ? 'Quanto o cliente entregou' : 'Valor'} (pode ser parte, para dividir a conta)</label>
      <input name="valor" inputmode="decimal" value="${paraCampo(c.falta)}" data-mudar="pagar-valor" required autofocus>
      ${dinheiro ? '<div id="troco" style="margin-top:8px;font-size:1.2rem;font-weight:700;color:var(--verde)"></div>' : ''}
      <button class="btn bloco grande" type="submit" style="margin-top:12px">Confirmar ${FORMA[t.forma]}</button>
    </form>`);
}

function modalNaoPago() {
  const c = comandaPorId(S.tmp.naoPago);
  return janela(`Comanda ${e(c.numero)} saiu sem pagar`, `
    <p style="margin-top:0">${pessoas(c, '_entrada')} · ${reais(valorDe({ adultos: c.adultos_entrada, criancas: c.criancas_entrada, menores: c.menores_entrada }))}
    vai aparecer como perda na conferência.</p>
    <form data-form="nao-pago">
      <label>O que aconteceu</label>
      <input name="motivo" required placeholder="ex.: foi embora sem passar no caixa, comanda perdida" autofocus>
      <button class="btn perigo bloco grande" type="submit" style="margin-top:12px">Confirmar</button>
    </form>`);
}

// Teclado de PIN para um dono autorizar (desconto, reabrir).
function modalPinDono() {
  const t = S.tmp.pinDono;
  return janela('Autorização do dono', `
    <p style="margin-top:0">${t.texto}</p>
    <div class="pin-pontos">${'<i></i>'.repeat(t.pin.length)}</div>
    <div class="teclado">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-acao="pin-dono" data-d="${n}">${n}</button>`).join('')}
      <button data-acao="pin-dono" data-d="apagar">←</button>
      <button data-acao="pin-dono" data-d="0">0</button>
      <button data-acao="pin-dono" data-d="ok" style="background:var(--laranja);color:#fff;border:0">OK</button>
    </div>`);
}

function modalDesconto() {
  const c = comandaPorId(S.tmp.desconto.comanda);
  return janela('Desconto', `
    <form data-form="desconto">
      <label>Valor do desconto (R$)</label><input name="valor" inputmode="decimal" placeholder="0,00" value="${c.desconto ? paraCampo(c.desconto) : ''}" required>
      <label>Motivo</label><input name="motivo" placeholder="ex.: cliente reclamou da demora" value="${e(c.desconto_motivo || '')}" required>
      <p style="color:var(--mudo);font-size:.9rem">${pode('dono') ? '' : 'Depois de confirmar, um dono digita a senha para autorizar.'}</p>
      <button class="btn bloco grande" type="submit">Confirmar desconto</button>
    </form>
    ${c.desconto ? `<button class="btn perigo bloco" style="margin-top:8px" data-acao="tirar-desconto" data-comanda="${c.id}">Tirar desconto</button>` : ''}`);
}

function modalMovimento() {
  const tipo = S.tmp.movimento;
  const nomes = [...new Set((S.usuariosNomes || []).concat(S.usuario.nome))];
  return janela(tipo === 'retirada' ? 'Retirada do potinho' : 'Reposição no potinho', `
    <form data-form="movimento">
      <label>Valor (R$)</label><input name="valor" inputmode="decimal" placeholder="0,00" required autofocus>
      <label>Quem ${tipo === 'retirada' ? 'tirou' : 'colocou'}</label>
      <input name="quem" list="quem-lista" value="${tipo === 'retirada' ? '' : e(S.usuario.nome)}" required autocomplete="off">
      <datalist id="quem-lista">${nomes.map(n => `<option value="${e(n)}">`).join('')}</datalist>
      <label>Para quê</label><input name="motivo" placeholder="${tipo === 'retirada' ? 'ex.: pagar o rapaz das cadeiras' : 'ex.: troco'}" required>
      <button class="btn bloco grande" type="submit" style="margin-top:12px">Registrar</button>
    </form>`);
}

// ---------- CONFERÊNCIA ----------
function telaConferencia() {
  const st = S.estado;
  const cf = st.conferencia;
  const c = st.caixa;
  const tot = x => x.adultos + x.criancas + x.menores;
  const linhaPessoas = (rot, x) => `<tr><td>${rot}</td><td>${x.adultos}</td><td>${x.criancas}</td><td>${x.menores}</td><td><b>${tot(x)}</b></td></tr>`;
  const tudoCerto = !cf.abertas.length && !cf.naoPagas.length && !cf.amenos.length;
  const lista = (titulo, itens, cor, valor) => itens.length ? `
    <div class="secao"><div class="cab"><h3 style="color:${cor}">${titulo} (${itens.length})</h3></div>
      <div class="lista">${itens.map(x => `
        <div class="item" data-acao="abrir-comanda" data-id="${x.id}" style="cursor:pointer">
          <div class="num-comanda">${e(x.numero)}</div>
          <div class="info"><div class="nome">${e(x.nome) || 'Sem nome'}</div>${x.motivo ? `<div class="det">${e(x.motivo)}</div>` : ''}</div>
          <b>${reais(valor(x))}</b></div>`).join('')}</div></div>` : '';

  const fechamento = st.dia.fechado_em ? `
    <div class="card">
      <table class="conta">
        <tr><td>Dinheiro esperado no potinho</td><td>${reais(c.dinheiroEsperado)}</td></tr>
        <tr><td>Dinheiro contado</td><td>${reais(st.dia.dinheiro_contado)}</td></tr>
        <tr class="${c.diferencaDinheiro ? 'falta' : 'desc'}"><td>Diferença no dinheiro</td><td>${reais(c.diferencaDinheiro)}</td></tr>
        <tr><td>Cartão no sistema</td><td>${reais(c.porForma.cartao)}</td></tr>
        <tr><td>Relatório da maquininha</td><td>${reais(st.dia.maquininha_informado)}</td></tr>
        <tr class="${c.diferencaCartao ? 'falta' : 'desc'}"><td>Diferença no cartão</td><td>${reais(c.diferencaCartao)}</td></tr>
      </table>
      <div style="color:var(--mudo);font-size:.85rem;margin-top:6px">Fechado por ${e(st.dia.fechado_por)} às ${hora(st.dia.fechado_em)}</div>
      <div class="linha-btns" style="margin-top:10px">
        <button class="btn" data-acao="aba" data-id="mais" data-sub="relatorio">Ver relatório para o WhatsApp</button>
        ${pode('dono') ? '<button class="btn sec" data-acao="reabrir-caixa">Reabrir caixa</button>' : ''}
      </div>
    </div>` : `
    <form class="card" data-form="fechar-caixa">
      ${cf.abertas.length ? `<div class="pill alerta" style="margin-bottom:6px">Ainda há ${cf.abertas.length} comanda(s) lá dentro</div>` : ''}
      <div class="grade2">
        <div><label>Total do relatório da maquininha</label><input name="maquininha" inputmode="decimal" placeholder="0,00" required></div>
        <div><label>Dinheiro contado no potinho</label><input name="dinheiro_contado" inputmode="decimal" placeholder="0,00" required></div>
      </div>
      <button class="btn bloco grande" type="submit" style="margin-top:10px" ${cf.abertas.length ? 'disabled' : ''}>Fechar caixa do dia</button>
    </form>`;

  const perda = cf.perdaNaoPagas + cf.perdaAMenos;
  const kpis = `<div class="kpis">
    ${kpi('Entraram', tot(cf.entraram), { icon: 'entrada', rodape: `${cf.grupos} comanda${cf.grupos === 1 ? '' : 's'}` })}
    ${kpi('Pagaram', tot(cf.pagaram), { icon: 'saida', rodape: `${cf.gruposPagos} de ${cf.grupos} comandas pagas` })}
    ${kpi('Ainda lá dentro', cf.abertas.length, { icon: 'mesas', rodape: 'comandas que não voltaram', classe: cf.abertas.length ? '' : 'ok' })}
    ${kpi('Deixou de entrar', valorGrande(perda), { icon: 'conferencia', classe: perda ? 'alerta' : 'ok',
      rodape: perda ? 'saiu sem pagar ou cobrado a menos' : (cf.grupos && tudoCerto ? '✓ todo mundo que entrou pagou' : 'nada até agora') })}
  </div>`;
  const detalhe = `
    <div class="card" style="margin-bottom:16px">
      <div class="cab"><h3>Entraram × pagaram</h3></div>
      <table class="tab conf">
        <tr><th></th><th>Adultos</th><th>Crianças</th><th>Menores</th><th>Total</th></tr>
        ${linhaPessoas('Entraram', cf.entraram)}
        ${linhaPessoas('Pagaram', cf.pagaram)}
      </table>
    </div>
    ${lista('Ainda lá dentro (comanda não voltou)', cf.abertas, 'var(--laranja-esc)', x => x.valor)}
    ${lista('Saíram sem pagar', cf.naoPagas, 'var(--vermelho)', x => x.valor)}
    ${lista('Cobradas com menos gente do que entrou', cf.amenos, 'var(--vermelho)', x => x.diferenca)}`;
  const fech = `<div class="secao"><div class="cab"><h3>Fechamento do caixa</h3></div>${fechamento}</div>`;
  return kpis + (telaLarga()
    ? `<div class="duas-col"><div>${detalhe}</div><div class="lateral">${fech}</div></div>`
    : detalhe + fech);
}

// ---------- MESAS ----------
function textoMesa(m) {
  if (m.situacao === 'ocupada') { const c = comandaPorId(m.comanda_id); return `cmd ${e(c.numero)} · ${totalPessoas(c)}`; }
  if (m.situacao === 'reservada') return e(m.reservas.map(id => reservaPorId(id)?.nome).join(' / '));
  if (m.situacao === 'limpando') return 'limpando';
  return `${m.lugares} lugares`;
}

function gradeMesas(mesas, { acao = 'mesa', selecionadas = [] } = {}) {
  return S.estado.espacos.map(esp => {
    const doEspaco = mesas.filter(m => m.espaco_id === esp.id);
    if (!doEspaco.length) return '';
    return `<div class="espaco"><h3>${e(esp.nome)}</h3><div class="mesas">
      ${doEspaco.map(m => `
        <div class="mesa ${m.situacao} ${m.alerta ? 'com-alerta' : ''} ${selecionadas.includes(m.id) ? 'sel' : ''}"
             data-acao="${acao}" data-id="${m.id}" role="button" tabindex="0">
          <div class="num">${e(m.numero)}</div>
          <div class="sub">${textoMesa(m)}</div>
        </div>`).join('')}
    </div></div>`;
  }).join('');
}

function telaMesas() {
  const mesas = S.estado.mesas;
  const conta = s => mesas.filter(m => m.situacao === s).length;
  const alertas = mesas.filter(m => m.alerta).length;
  const filtradas = S.filtro === 'todas' ? mesas
    : S.filtro === 'alerta' ? mesas.filter(m => m.alerta) : mesas.filter(m => m.situacao === S.filtro);
  const filtro = (id, nome, n) => `<button class="${S.filtro === id ? 'ativo' : ''}" data-acao="filtro" data-id="${id}">${nome} ${n ?? ''}</button>`;
  return `
    <div class="filtros">
      ${filtro('todas', 'Todas', mesas.length)}
      ${filtro('livre', 'Livres', conta('livre'))}
      ${filtro('reservada', 'Reservadas', conta('reservada'))}
      ${filtro('ocupada', 'Ocupadas', conta('ocupada'))}
      ${filtro('limpando', 'Limpando', conta('limpando'))}
      ${alertas ? filtro('alerta', '⚠ Alertas', alertas) : ''}
    </div>
    <div class="legenda">
      <span><i style="background:var(--verde-claro);border:1px solid #BFD9C4"></i>livre</span>
      <span><i style="background:var(--azul-claro);border:1px solid #C3D5E3"></i>reservada</span>
      <span><i style="background:var(--laranja-claro);border:1px solid #F6C899"></i>ocupada</span>
      <span><i style="background:var(--cinza);border:1px dashed var(--mudo)"></i>limpando</span>
    </div>
    ${filtradas.length ? gradeMesas(filtradas) : '<div class="vazio">Nenhuma mesa aqui.</div>'}`;
}

function modalMesa(id) {
  const m = mesaPorId(id);
  if (!m) return fecharModal();
  const esp = S.estado.espacos.find(x => x.id === m.espaco_id)?.nome || '';
  let corpo = '';
  if (m.alerta) {
    corpo += `<div class="card" style="border-color:var(--vermelho);margin-bottom:10px">
      <b style="color:var(--vermelho)">⚠ ${e(m.alerta)}</b>
      <div class="linha-btns" style="margin-top:8px"><button class="btn sec" data-acao="alerta-resolver" data-id="${m.id}">Resolvido</button></div></div>`;
  }
  if (m.situacao === 'ocupada') {
    const c = comandaPorId(m.comanda_id);
    corpo += `<div class="card"><div style="font-weight:700">Comanda ${e(c.numero)}${c.nome ? ' · ' + e(c.nome) : ''}</div>
      <div style="color:var(--mudo)">${pessoas(c, '_entrada')} · entrou ${hora(c.aberta_em)}</div></div>
      <div class="linha-btns" style="margin-top:10px">
        <button class="btn sec" data-acao="mover-escolher" data-comanda="${c.id}" data-de="${m.id}">Trocou de mesa</button>
        <button class="btn sec" data-acao="juntar-escolher" data-comanda="${c.id}">Juntou outra mesa</button>
        ${c.mesas.length > 1 ? `<button class="btn sec" data-acao="separar-mesa" data-comanda="${c.id}" data-mesa="${m.id}">Liberar esta mesa</button>` : ''}
      </div>
      <button class="btn bloco" style="margin-top:8px" data-acao="abrir-comanda" data-id="${c.id}">Ver comanda</button>`;
  } else if (m.situacao === 'reservada') {
    for (const rid of m.reservas) {
      const r = reservaPorId(rid);
      corpo += `<div class="card" style="margin-bottom:8px">
        <div style="font-weight:700">${e(r.nome)} ${r.tipo === 'evento' ? '<span class="pill evento">evento</span>' : ''}</div>
        <div style="color:var(--mudo);font-size:.9rem">${pessoas(r)} · mesas ${numeros(r.mesas)}</div>
        ${r.obs ? `<div style="font-size:.9rem">${e(r.obs)}</div>` : ''}
        <button class="btn verde bloco" style="margin-top:8px" data-acao="chegou" data-id="${r.id}">Chegou · registrar entrada</button>
      </div>`;
    }
    corpo += `<button class="btn sec bloco" data-acao="alerta" data-id="${m.id}" data-texto="Sentaram sem avisar">Sentou outra pessoa aqui</button>`;
  } else if (m.situacao === 'limpando') {
    corpo += `<button class="btn verde bloco grande" data-acao="limpa" data-id="${m.id}">Mesa limpa ✓</button>`;
  } else {
    corpo += `<button class="btn bloco grande" data-acao="entrada-com-mesa" data-mesa="${m.id}">Registrar entrada nesta mesa</button>
      <button class="btn sec bloco" style="margin-top:8px" data-acao="alerta" data-id="${m.id}" data-texto="Sentaram sem avisar">Sentaram sem avisar</button>`;
  }
  corpo += `<button class="btn sec bloco" style="margin-top:8px" data-acao="ocorrencia" data-mesa="${m.id}">Registrar ocorrência</button>`;
  return janela(`Mesa ${e(m.numero)} <span class="pill neutro">${SITUACAO[m.situacao]}</span>`, `
    <div style="color:var(--mudo);margin:-6px 0 10px">${e(esp)} · ${m.lugares} lugares</div>${corpo}`);
}

// Escolher mesa: para a entrada, para troca, para juntar.
function modalEscolherMesa() {
  const t = S.tmp.escolher;
  const mesas = S.estado.mesas.filter(m => m.situacao !== 'ocupada');
  return janela(t.titulo, `
    <p style="margin-top:0;color:var(--mudo)">${t.texto}</p>
    ${gradeMesas(mesas, { acao: 'escolher-mesa', selecionadas: t.mesas })}
    ${t.multiplas ? `<div class="linha-btns">
      ${t.limpar ? '<button class="btn sec" data-acao="escolher-limpar">Sem mesa</button>' : ''}
      <button class="btn" data-acao="escolher-confirmar">Confirmar</button></div>` : ''}`);
}

// ---------- VOUCHERS ----------
async function carregarVouchers() {
  try { S.vouchers = await api('GET', '/api/vouchers'); } catch { /* mantém a lista anterior */ }
  if (S.aba === 'vouchers') render();
}

function descreverVoucher(v) {
  if (v.tipo === 'cortesia') return `Cortesia para ${v.valor} pessoa${v.valor > 1 ? 's' : ''}`;
  if (v.tipo === 'percentual') return `${v.valor}% de desconto`;
  return `${reais(v.valor)} de desconto`;
}

function telaVouchers() {
  const busca = S.busca.trim().toLowerCase();
  const lista = S.vouchers.filter(v => !busca || v.codigo.toLowerCase().includes(busca) || v.cliente.toLowerCase().includes(busca));
  return `
    ${pode('dono') ? '<button class="btn bloco grande" style="margin-bottom:10px" data-acao="novo-voucher">+ Novo voucher</button>'
      : '<p style="color:var(--mudo);margin-top:0">Os vouchers são criados pelos donos. Para usar, abra a comanda na Saída e digite o código.</p>'}
    <div class="busca" style="margin-bottom:10px">${icone('busca')}<input type="search" placeholder="Buscar código ou nome…" value="${e(S.busca)}" data-mudar="busca" autocomplete="off"></div>
    <div class="lista">
      ${lista.map(v => {
        const vencido = v.validade && v.validade < S.estado.hoje;
        const usado = v.usos >= v.usos_max;
        const sit = !v.ativo ? '<span class="pill neutro">desativado</span>' : usado ? '<span class="pill neutro">usado</span>'
          : vencido ? '<span class="pill alerta">vencido</span>' : '<span class="pill ok">válido</span>';
        return `<div class="item ${!v.ativo || usado || vencido ? 'apagado' : ''}">
          <div class="info"><div class="nome">${e(v.codigo)} ${sit}</div>
            <div class="det">${e(v.cliente)} · ${descreverVoucher(v)} · usado ${v.usos}/${v.usos_max}
              ${v.validade ? ' · até ' + dataBr(v.validade) : ''}${v.motivo ? ' · ' + e(v.motivo) : ''} · por ${e(v.criado_por)}</div></div>
          ${pode('dono') ? `<a class="btn sec peq" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(mensagemVoucher(v))}">WhatsApp</a>
            <button class="btn sec peq" data-acao="voucher-ativo" data-id="${v.id}" data-ativo="${v.ativo ? 0 : 1}">${v.ativo ? 'desativar' : 'ativar'}</button>` : ''}
        </div>`;
      }).join('') || '<div class="vazio">Nenhum voucher.</div>'}
    </div>`;
}

function mensagemVoucher(v) {
  return `Olá, ${v.cliente}! Você ganhou um voucher na Casa Du Vovô ☕\n${descreverVoucher(v)}\nCódigo: ${v.codigo}`
    + (v.validade ? `\nVálido até ${dataBr(v.validade)}` : '') + '\nÉ só mostrar este código na hora de pagar.';
}

function modalNovoVoucher() {
  return janela('Novo voucher', `
    <form data-form="voucher-novo">
      <label>Para quem</label><input name="cliente" required autocomplete="off">
      <div class="grade2">
        <div><label>Tipo</label><select name="tipo">
          <option value="cortesia">Cortesia (pessoas)</option>
          <option value="percentual">Desconto em %</option>
          <option value="valor">Desconto em R$</option></select></div>
        <div><label>Quantidade</label><input name="valor" inputmode="decimal" placeholder="ex.: 2 pessoas / 10% / 50,00" required></div>
      </div>
      <div class="grade2">
        <div><label>Válido até</label><input name="validade" type="date"></div>
        <div><label>Quantas vezes pode usar</label><input name="usos_max" type="number" min="1" value="1"></div>
      </div>
      <label>Motivo</label><input name="motivo" placeholder="ex.: aniversário, influenciador, reclamação">
      <button class="btn bloco grande" type="submit" style="margin-top:12px">Criar voucher</button>
    </form>`);
}

// ---------- MAIS: ocorrências, relatório, histórico, configurações ----------
const CATEGORIAS = ['Mesa', 'Fila', 'Cliente', 'Comida', 'Material', 'Equipe', 'Outro'];

function telaMais() {
  const subs = [['ocorrencias', 'Ocorrências']];
  if (pode(...CAIXA)) subs.push(['relatorio', 'Relatório'], ['historico', 'Histórico']);
  if (pode('dono')) subs.push(['config', 'Configurações']);
  if (!subs.some(([id]) => id === S.subMais)) S.subMais = 'ocorrencias';
  const conteudo = { ocorrencias: telaOcorrencias, relatorio: telaRelatorio, historico: telaHistorico, config: telaConfig }[S.subMais]();
  return `${subs.length > 1 ? `<div class="filtros">${subs.map(([id, nome]) =>
    `<button class="${S.subMais === id ? 'ativo' : ''}" data-acao="sub" data-id="${id}">${nome}</button>`).join('')}</div>` : ''}${conteudo}`;
}

function telaOcorrencias() {
  return `
    <button class="btn bloco grande" style="margin-bottom:10px" data-acao="ocorrencia">+ Registrar ocorrência</button>
    <div class="lista">${S.estado.ocorrencias.map(o => `
      <div class="item"><div class="info"><div class="nome"><span class="pill laranja">${e(o.categoria)}</span>
        ${o.mesa_id ? `mesa ${numeros([o.mesa_id])}` : ''}</div>
        <div>${e(o.texto)}</div><div class="det">${e(o.por)} · ${hora(o.em)}</div></div></div>`).join('')
      || '<div class="vazio">Nada registrado hoje. Qualquer problema do dia, registre aqui para os donos verem.</div>'}</div>`;
}

function modalOcorrencia() {
  const t = S.tmp.ocorrencia;
  return janela('Registrar ocorrência', `
    <form data-form="ocorrencia">
      <label>Tipo</label>
      <div class="filtros">${CATEGORIAS.map(c => `<button type="button" class="${t.categoria === c ? 'ativo' : ''}" data-acao="ocorrencia-cat" data-id="${c}">${c}</button>`).join('')}</div>
      ${t.mesa ? `<div style="color:var(--mudo)">Mesa ${numeros([t.mesa])}</div>` : ''}
      <label>O que aconteceu</label><textarea name="texto" required style="font-family:inherit;min-height:90px"></textarea>
      <button class="btn bloco grande" type="submit" style="margin-top:10px">Registrar</button>
    </form>`);
}

function telaRelatorio() {
  if (!S.relatorio) { carregarRelatorio(); return '<div class="vazio">Carregando…</div>'; }
  return `
    <pre class="relatorio">${e(S.relatorio)}</pre>
    <div class="linha-btns">
      <button class="btn" data-acao="copiar-relatorio">Copiar</button>
      <a class="btn verde" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(S.relatorio)}">Enviar no WhatsApp</a>
      <button class="btn sec" data-acao="atualizar-relatorio">Atualizar</button>
    </div>`;
}
let relatorioCarregando = false;
async function carregarRelatorio() {
  if (relatorioCarregando) return;
  relatorioCarregando = true;
  const r = await fazer(() => api('GET', '/api/relatorio'));
  relatorioCarregando = false;
  S.relatorio = r?.texto || 'Não foi possível gerar o relatório.';
  render();
}

function telaHistorico() {
  if (!S.historicoCarregado) { S.historicoCarregado = true; fazer(async () => { S.historico = await api('GET', '/api/historico'); render(); }); }
  return `<div class="cab"><h3>Tudo o que foi feito no dia</h3><button class="btn sec peq" data-acao="atualizar-historico">Atualizar</button></div>
    <div class="lista">${S.historico.map(h => `<div class="item"><div class="info">
      <div class="nome">${e(h.acao)}</div><div class="det">${e(h.detalhe)}</div></div>
      <div class="det" style="text-align:right">${e(h.usuario)}<br>${hora(h.em)}</div></div>`).join('') || '<div class="vazio">Nada ainda.</div>'}</div>`;
}

function telaConfig() {
  if (!S.config) {
    if (!S.configCarregando) {
      S.configCarregando = true;
      fazer(async () => { S.config = await api('GET', '/api/config'); }).finally(() => { S.configCarregando = S.config ? false : 'erro'; render(); });
    }
    return S.configCarregando === 'erro'
      ? '<div class="vazio">Não foi possível carregar. <button class="btn sec peq" data-acao="sub" data-id="config">Tentar de novo</button></div>'
      : '<div class="vazio">Carregando…</div>';
  }
  const cf = S.config;
  const papeis = { dono: 'Dono', atendente: 'Recepção / caixa', patio: 'Pátio / porta' };
  return `
    <div class="secao"><div class="cab"><h3>Preços</h3></div>
      <form class="card" data-form="precos"><div class="grade3">
        <div><label>Adulto</label><input name="adulto" inputmode="decimal" value="${paraCampo(cf.precos.adulto)}"></div>
        <div><label>Criança 6–10</label><input name="crianca" inputmode="decimal" value="${paraCampo(cf.precos.crianca)}"></div>
        <div><label>Menor de 6</label><input name="menor" inputmode="decimal" value="${paraCampo(cf.precos.menor)}"></div>
      </div><button class="btn" type="submit" style="margin-top:10px">Salvar preços</button></form></div>

    <div class="secao"><div class="cab"><h3>Pessoas e senhas</h3></div>
      <div style="overflow-x:auto"><table class="tab">
        <tr><th>Nome</th><th>Função</th><th>Nova senha (números)</th><th>Ativo</th><th></th></tr>
        ${cf.usuarios.map(u => `<tr data-id="${u.id}">
          <td><input name="nome" value="${e(u.nome)}"></td>
          <td><select name="papel">${Object.entries(papeis).map(([k, n]) => `<option value="${k}" ${u.papel === k ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
          <td><input name="pin" inputmode="numeric" placeholder="manter" style="width:110px"></td>
          <td><input name="ativo" type="checkbox" ${u.ativo ? 'checked' : ''} style="width:24px;min-height:24px"></td>
          <td><button class="btn sec peq" data-acao="salvar-usuario" data-id="${u.id}">Salvar</button></td></tr>`).join('')}
        <tr>
          <td><input name="nome" placeholder="Nome"></td>
          <td><select name="papel">${Object.entries(papeis).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></td>
          <td><input name="pin" inputmode="numeric" placeholder="senha" style="width:110px"></td><td></td>
          <td><button class="btn peq" data-acao="novo-usuario">Adicionar</button></td></tr>
      </table></div></div>

    <div class="secao"><div class="cab"><h3>Espaços</h3></div>
      <div class="lista">${cf.espacos.map(s => `<form class="item" data-form="espaco" data-id="${s.id}">
        <input name="nome" value="${e(s.nome)}"><input name="ordem" type="number" value="${s.ordem}" style="width:80px" aria-label="ordem">
        <button class="btn sec peq" type="submit">Salvar</button></form>`).join('')}
        <form class="item" data-form="espaco-novo"><input name="nome" placeholder="Novo espaço" required><button class="btn peq" type="submit">Adicionar</button></form>
      </div></div>

    <div class="secao"><div class="cab"><h3>Mesas</h3></div>
      <div style="overflow-x:auto"><table class="tab">
        <tr><th>Número</th><th>Espaço</th><th>Lugares</th><th>Ativa</th><th></th></tr>
        ${cf.mesas.map(m => `<tr data-id="${m.id}">
          <td><input name="numero" value="${e(m.numero)}" style="width:80px"></td>
          <td><select name="espaco_id">${cf.espacos.map(s => `<option value="${s.id}" ${s.id === m.espaco_id ? 'selected' : ''}>${e(s.nome)}</option>`).join('')}</select></td>
          <td><input name="lugares" type="number" min="1" value="${m.lugares}" style="width:80px"></td>
          <td><input name="ativa" type="checkbox" ${m.ativa ? 'checked' : ''} style="width:24px;min-height:24px"></td>
          <td><button class="btn sec peq" data-acao="salvar-mesa" data-id="${m.id}">Salvar</button></td></tr>`).join('')}
        <tr>
          <td><input name="numero" placeholder="nº" style="width:80px"></td>
          <td><select name="espaco_id">${cf.espacos.map(s => `<option value="${s.id}">${e(s.nome)}</option>`).join('')}</select></td>
          <td><input name="lugares" type="number" min="1" value="6" style="width:80px"></td><td></td>
          <td><button class="btn peq" data-acao="nova-mesa">Adicionar</button></td></tr>
      </table></div></div>`;
}

const linhaForm = el => {
  const dados = {};
  el.closest('tr').querySelectorAll('input, select').forEach(i => { dados[i.name] = i.type === 'checkbox' ? i.checked : i.value; });
  return dados;
};

// ---------- modal genérico ----------
function janela(titulo, corpo) {
  return `<div class="fundo" data-acao="fundo"><div class="janela" role="dialog" aria-modal="true">
    <div class="cab-j"><h2>${titulo}</h2><button class="fechar-j" data-acao="fechar" aria-label="Fechar">✕</button></div>${corpo}</div></div>`;
}
function abrirModal(fn) { S.modal = fn; renderModal(true); }
function fecharModal() { S.modal = null; $('#modal-raiz').innerHTML = ''; }
function renderModal(forcar = false) {
  if (!S.modal) { $('#modal-raiz').innerHTML = ''; return; }
  // Não redesenha enquanto a pessoa está digitando, para não apagar o que foi escrito.
  const ativo = document.activeElement;
  if (!forcar && ativo && $('#modal-raiz').contains(ativo) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ativo.tagName)) return;
  const rolagem = $('#modal-raiz .janela')?.scrollTop || 0;
  const html = S.modal();
  if (html === undefined) return;
  $('#modal-raiz').innerHTML = html;
  const j = $('#modal-raiz .janela');
  if (j && !forcar) j.scrollTop = rolagem;
  const auto = $('#modal-raiz [autofocus]');
  if (auto && forcar) { auto.focus(); auto.select?.(); }
}

function pedirPinDono(texto, depois) {
  if (pode('dono')) return depois(null);
  S.tmp.pinDono = { texto, pin: '', depois };
  abrirModal(modalPinDono);
}

function escolherMesa(opcoes) {
  S.tmp.escolher = { mesas: [], multiplas: false, ...opcoes };
  abrirModal(modalEscolherMesa);
}

function irParaEntrada() {
  S.aba = 'entrada'; S.busca = ''; gravarLocal('aba', 'entrada');
  fecharModal(); render();
  $('#ent-num')?.focus();
  $('#ent-num')?.select();
}

// ---------- ações dos botões ----------
const acoes = {
  'login-usuario': d => { S.login.usuario = usuariosLogin.find(u => u.id === Number(d.id)); S.login.pin = ''; render(); },
  'login-voltar': () => { if (S.login.pin) S.login.pin = S.login.pin.slice(0, -1); else S.login.usuario = null; render(); },
  pin: d => { if (S.login.pin.length < 12) S.login.pin += d.d; render(); },
  'login-entrar': async () => {
    try {
      const r = await api('POST', '/api/login', { usuario_id: S.login.usuario.id, pin: S.login.pin });
      S.token = r.token; S.usuario = r.usuario;
      gravarLocal('token', r.token); gravarLocal('usuario', JSON.stringify(r.usuario));
      S.login = { usuario: null, pin: '' };
      iniciar();
    } catch (err) { S.login.pin = ''; render(); avisar(err.message, true); }
  },
  sair: async () => { await api('POST', '/api/sair', {}).catch(() => {}); sair(); },
  aba: d => {
    S.aba = d.id; S.busca = ''; gravarLocal('aba', d.id);
    if (d.sub) S.subMais = d.sub;
    if (d.id === 'vouchers') carregarVouchers();
    if (d.id === 'mais') { S.relatorio = ''; S.historicoCarregado = false; S.config = null; S.configCarregando = false; }
    fecharModal(); render();
  },
  sub: d => { S.subMais = d.id; S.relatorio = ''; S.historicoCarregado = false; S.config = null; S.configCarregando = false; render(); },
  'ir-hoje': () => { S.data = S.estado.hoje; carregar(); },
  filtro: d => { S.filtro = d.id; render(); },
  fundo: (d, el, ev) => { if (ev.target === el) fecharModal(); },
  fechar: () => fecharModal(),

  // entrada
  'entrada-conta': d => { const t = S.entrada; t[d.campo] = Math.max(0, t[d.campo] + Number(d.d)); render(); },
  'entrada-limpar': () => { S.entrada = novaEntrada(); render(); },
  'entrada-mesa': () => escolherMesa({
    titulo: 'Mesa (opcional)', texto: 'Escolha uma ou mais mesas para este grupo.', multiplas: true, limpar: true,
    mesas: [...S.entrada.mesas],
    aoEscolher: mesas => { S.entrada.mesas = mesas; fecharModal(); render(); },
  }),
  'entrada-com-mesa': d => { S.entrada.mesas = [Number(d.mesa)]; irParaEntrada(); },
  chegou: d => {
    const r = reservaPorId(Number(d.id));
    S.entrada = { numero: S.entrada.numero, adultos: r.adultos, criancas: r.criancas, menores: r.menores,
      nome: r.nome, reserva_id: r.id, mesas: r.mesas.filter(id => mesaPorId(id)?.situacao !== 'ocupada') };
    irParaEntrada();
    avisar(`${r.nome}: confira as pessoas e o número da comanda`);
  },

  // reservas
  'nova-reserva': () => { S.tmp.reserva = null; abrirModal(() => modalReserva(null)); },
  'editar-reserva': d => { S.tmp.reserva = null; abrirModal(() => modalReserva(Number(d.id))); },
  'reserva-mesa': d => {
    const t = S.tmp.reserva; const id = Number(d.id);
    const f = $('#modal-raiz form'); const rasc = f ? Object.fromEntries(new FormData(f)) : null;
    t.mesas = t.mesas.includes(id) ? t.mesas.filter(x => x !== id) : [...t.mesas, id];
    renderModal(true);
    if (rasc) for (const [k, v] of Object.entries(rasc)) { const i = $(`#modal-raiz [name="${k}"]`); if (i) i.value = v; }
  },
  'reserva-status': d => fazerEFechar(() => api('POST', `/api/reservas/${d.id}/status`, { status: d.status }), 'Reserva atualizada'),
  'apagar-reserva': d => {
    if (!confirmarDuasVezes(d, 'Toque de novo para apagar')) return;
    fazerEFechar(() => api('DELETE', `/api/reservas/${d.id}`), 'Reserva apagada');
  },
  colar: () => abrirModal(modalColar),
  imprimir: () => {
    if (!S.estado.reservas.some(r => r.status === 'aguardando' && r.mesas.length)) return avisar('Nenhuma reserva com mesa para imprimir.', true);
    window.print();
  },

  // mesas
  mesa: d => abrirModal(() => modalMesa(Number(d.id))),
  'mover-escolher': d => escolherMesa({
    titulo: 'Foi para qual mesa?', texto: `A comanda vai junto. A mesa ${numeros([Number(d.de)])} fica como “limpando”.`,
    aoEscolher: para => fazerEFechar(() => api('POST', `/api/comandas/${d.comanda}/mover`, { de: Number(d.de), para }), 'Mesa trocada'),
  }),
  'juntar-escolher': d => escolherMesa({
    titulo: 'Juntou qual mesa?', texto: 'A mesa escolhida passa a ser do mesmo grupo.',
    aoEscolher: m => fazerEFechar(() => api('POST', `/api/comandas/${d.comanda}/mesas`, { mesa_id: m }), 'Mesa juntada'),
  }),
  'separar-mesa': d => fazerEFechar(() => api('DELETE', `/api/comandas/${d.comanda}/mesas/${d.mesa}`), 'Mesa liberada'),
  'escolher-mesa': d => {
    const t = S.tmp.escolher; const id = Number(d.id);
    if (!t.multiplas) return t.aoEscolher(id);
    t.mesas = t.mesas.includes(id) ? t.mesas.filter(x => x !== id) : [...t.mesas, id];
    renderModal(true);
  },
  'escolher-confirmar': () => S.tmp.escolher.aoEscolher(S.tmp.escolher.mesas),
  'escolher-limpar': () => S.tmp.escolher.aoEscolher([]),
  limpa: d => fazerEFechar(() => api('POST', `/api/mesas/${d.id}/estado`, { limpando: false }), 'Mesa livre'),
  alerta: d => fazer(() => api('POST', `/api/mesas/${d.id}/estado`, { alerta: d.texto }), 'Alerta registrado'),
  'alerta-resolver': d => fazer(() => api('POST', `/api/mesas/${d.id}/estado`, { alerta: '' })),

  // saída
  'abrir-comanda': d => abrirModal(() => modalComanda(Number(d.id))),
  pessoa: d => {
    const c = comandaPorId(Number(d.comanda));
    fazer(() => api('PUT', `/api/comandas/${c.id}`, { [d.campo]: Math.max(0, c[d.campo] + Number(d.d)) }));
  },
  'corrigir-entrada': d => {
    const c = comandaPorId(Number(d.id));
    if (!confirmarDuasVezes(d, `Toque de novo: a entrada passa a ser ${pessoas(c)}`)) return;
    fazer(() => api('PUT', `/api/comandas/${c.id}`, { corrigir_entrada: true }), 'Entrada corrigida');
  },
  pagar: d => { S.tmp.pagar = { comanda: Number(d.comanda), forma: d.forma }; abrirModal(modalPagar); },
  'tirar-pagamento': d => fazer(() => api('DELETE', `/api/comandas/${d.comanda}/pagamentos/${d.id}`)),
  'tirar-voucher': d => fazer(() => api('DELETE', `/api/comandas/${d.comanda}/vouchers/${d.id}`)),
  'fechar-comanda': d => fazerEFechar(() => api('POST', `/api/comandas/${d.id}/fechar`), 'Pago ✓'),
  'nao-pago': d => { S.tmp.naoPago = Number(d.id); abrirModal(modalNaoPago); },
  'reabrir-comanda': d => pedirPinDono('Reabrir uma comanda já encerrada.', pin =>
    fazer(() => api('POST', `/api/comandas/${d.id}/reabrir`, { pin_dono: pin }), 'Comanda reaberta')
      .then(x => { if (x) abrirModal(() => modalComanda(Number(d.id))); })),
  desconto: d => { S.tmp.desconto = { comanda: Number(d.comanda) }; abrirModal(modalDesconto); },
  'tirar-desconto': d => fazer(() => api('POST', `/api/comandas/${d.comanda}/desconto`, { valor: 0 }), 'Desconto retirado')
    .then(() => abrirModal(() => modalComanda(Number(d.comanda)))),
  'pin-dono': d => {
    const t = S.tmp.pinDono;
    if (d.d === 'apagar') t.pin = t.pin.slice(0, -1);
    else if (d.d === 'ok') return t.depois(t.pin);
    else if (t.pin.length < 12) t.pin += d.d;
    renderModal(true);
  },
  troco: () => abrirModal(() => janela('Troco inicial', `
    <form data-form="troco">
      <label>Quanto tinha no potinho ao abrir (R$)</label>
      <input name="valor" inputmode="decimal" value="${paraCampo(S.estado.dia.troco_inicial)}" required autofocus>
      <button class="btn bloco grande" type="submit" style="margin-top:12px">Salvar</button>
    </form>`)),
  movimento: d => { S.tmp.movimento = d.tipo; abrirModal(modalMovimento); },
  'apagar-movimento': d => {
    if (!confirmarDuasVezes(d, 'Toque de novo para apagar')) return;
    fazer(() => api('DELETE', `/api/caixa/movimentos/${d.id}`), 'Movimento apagado');
  },
  'reabrir-caixa': () => fazer(() => api('POST', '/api/caixa/reabrir', {}), 'Caixa reaberto'),

  // vouchers
  'novo-voucher': () => abrirModal(modalNovoVoucher),
  'voucher-ativo': d => fazer(() => api('PUT', `/api/vouchers/${d.id}`, { ativo: d.ativo === '1' })).then(carregarVouchers),

  // mais
  ocorrencia: d => { S.tmp.ocorrencia = { categoria: d.mesa ? 'Mesa' : 'Outro', mesa: d.mesa ? Number(d.mesa) : null }; abrirModal(modalOcorrencia); },
  'ocorrencia-cat': d => {
    const txt = $('#modal-raiz textarea')?.value || '';
    S.tmp.ocorrencia.categoria = d.id; renderModal(true);
    const t = $('#modal-raiz textarea'); if (t) t.value = txt;
  },
  'copiar-relatorio': () => navigator.clipboard?.writeText(S.relatorio).then(() => avisar('Relatório copiado'), () => avisar('Não deu para copiar', true)),
  'atualizar-relatorio': () => { S.relatorio = ''; render(); },
  'atualizar-historico': () => { S.historicoCarregado = false; render(); },
  'salvar-mesa': (d, el) => {
    const x = linhaForm(el);
    fazer(() => api('PUT', `/api/config/mesas/${d.id}`, { numero: x.numero, espaco_id: Number(x.espaco_id), lugares: Number(x.lugares), ativa: x.ativa }), 'Mesa salva').then(recarregarConfig);
  },
  'nova-mesa': (d, el) => {
    const x = linhaForm(el);
    fazer(() => api('POST', '/api/config/mesas', { numero: x.numero, espaco_id: Number(x.espaco_id), lugares: Number(x.lugares) }), 'Mesa criada').then(recarregarConfig);
  },
  'salvar-usuario': (d, el) => {
    const x = linhaForm(el);
    fazer(() => api('PUT', `/api/config/usuarios/${d.id}`, { nome: x.nome, papel: x.papel, ativo: x.ativo, pin: x.pin || undefined }), 'Salvo').then(recarregarConfig);
  },
  'novo-usuario': (d, el) => {
    const x = linhaForm(el);
    fazer(() => api('POST', '/api/config/usuarios', { nome: x.nome, papel: x.papel, pin: x.pin }), 'Pessoa adicionada').then(recarregarConfig);
  },
};

function recarregarConfig() { S.config = null; S.configCarregando = false; usuariosLogin = []; render(); }

// Ações destrutivas pedem um segundo toque em vez de caixa de confirmação.
function confirmarDuasVezes(d, msg) {
  const chave = 'conf-' + JSON.stringify(d);
  if (S.tmp[chave] && Date.now() - S.tmp[chave] < 4000) { delete S.tmp[chave]; return true; }
  S.tmp[chave] = Date.now(); avisar(msg); return false;
}

// ---------- formulários ----------
const formularios = {
  entrada: async () => {
    const t = S.entrada;
    const numero = (t.numero || S.estado.proximoNumero).trim();
    const r = await fazer(() => api('POST', '/api/comandas', { ...t, numero }), `Comanda ${numero} · ${totalPessoas(t)} pessoa(s)`);
    if (!r) return;
    S.entrada = novaEntrada();
    S.busca = '';
    // depois do carregar, o número sugerido já será o próximo
    setTimeout(() => { $('#ent-num')?.focus(); $('#ent-num')?.select(); }, 250);
  },
  reserva: async f => {
    const t = S.tmp.reserva;
    const corpo = { ...f, adultos: Number(f.adultos), criancas: Number(f.criancas), menores: Number(f.menores), mesas: t.mesas };
    await fazerEFechar(() => t.id ? api('PUT', `/api/reservas/${t.id}`, corpo) : api('POST', '/api/reservas', corpo), 'Reserva salva');
  },
  colar: async f => {
    const r = await fazer(() => api('POST', '/api/reservas/importar', { texto: f.texto }));
    if (r) { avisar(`${r.criadas} reserva(s) importada(s)`); fecharModal(); }
  },
  pagar: async f => {
    const t = S.tmp.pagar;
    const c = comandaPorId(t.comanda);
    let valor = centavos(f.valor);
    if (valor <= 0) return avisar('Digite o valor.', true);
    let troco = 0;
    if (valor > c.falta) {
      if (t.forma !== 'dinheiro') return avisar(`O valor passa do que falta (${reais(c.falta)}).`, true);
      troco = valor - c.falta; valor = c.falta;
    }
    const r = await fazer(() => api('POST', `/api/comandas/${c.id}/pagamentos`, { forma: t.forma, valor }));
    if (!r) return;
    if (troco) avisar(`Troco: ${reais(troco)}`);
    abrirModal(() => modalComanda(c.id));
  },
  'nao-pago': f => fazerEFechar(() => api('POST', `/api/comandas/${S.tmp.naoPago}/nao-pago`, { motivo: f.motivo }), 'Registrado como não pago'),
  voucher: async (f, form) => {
    const r = await fazer(() => api('POST', `/api/comandas/${form.dataset.comanda}/vouchers`, { codigo: f.codigo }), 'Voucher aplicado');
    if (r) form.reset();
  },
  desconto: async f => {
    const id = S.tmp.desconto.comanda;
    const corpo = { valor: centavos(f.valor), motivo: f.motivo };
    const enviar = pin => fazer(() => api('POST', `/api/comandas/${id}/desconto`, { ...corpo, pin_dono: pin }), 'Desconto aplicado')
      .then(x => { if (x) abrirModal(() => modalComanda(id)); else if (pin !== null) { S.tmp.pinDono.pin = ''; renderModal(true); } });
    pedirPinDono(`Desconto de ${reais(corpo.valor)} · ${e(corpo.motivo)}`, enviar);
  },
  troco: f => fazerEFechar(() => api('POST', '/api/caixa/troco', { valor: centavos(f.valor) }), 'Troco salvo'),
  movimento: f => fazerEFechar(() => api('POST', '/api/caixa/movimentos',
    { tipo: S.tmp.movimento, valor: centavos(f.valor), quem: f.quem, motivo: f.motivo }), 'Registrado'),
  'fechar-caixa': f => fazer(() => api('POST', '/api/caixa/fechar',
    { maquininha: centavos(f.maquininha), dinheiro_contado: centavos(f.dinheiro_contado) }), 'Caixa fechado'),
  'voucher-novo': async f => {
    const valor = f.tipo === 'valor' ? centavos(f.valor) : parseInt(f.valor, 10);
    const r = await fazer(() => api('POST', '/api/vouchers', { ...f, valor, usos_max: Number(f.usos_max) }));
    if (!r) return;
    await carregarVouchers();
    const v = S.vouchers.find(x => x.codigo === r.codigo);
    abrirModal(() => janela('Voucher criado', `
      <div class="codigo-voucher">${e(r.codigo)}</div>
      <p style="text-align:center">${e(v.cliente)} · ${descreverVoucher(v)}</p>
      <a class="btn verde bloco grande" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(mensagemVoucher(v))}">Enviar pelo WhatsApp</a>`));
  },
  ocorrencia: f => {
    const t = S.tmp.ocorrencia;
    return fazerEFechar(() => api('POST', '/api/ocorrencias', { categoria: t.categoria, texto: f.texto, mesa_id: t.mesa }), 'Ocorrência registrada');
  },
  precos: async f => {
    await fazer(() => api('PUT', '/api/config/precos', { adulto: centavos(f.adulto), crianca: centavos(f.crianca), menor: centavos(f.menor) }), 'Preços salvos');
    recarregarConfig();
  },
  espaco: async (f, form) => {
    await fazer(() => api('PUT', `/api/config/espacos/${form.dataset.id}`, { nome: f.nome, ordem: Number(f.ordem) }), 'Espaço salvo');
    recarregarConfig();
  },
  'espaco-novo': async f => {
    await fazer(() => api('POST', '/api/config/espacos', { nome: f.nome }), 'Espaço criado');
    recarregarConfig();
  },
};

// ---------- eventos ----------
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-acao]');
  if (!el) return;
  const acao = acoes[el.dataset.acao];
  if (!acao) return;
  if (el.tagName === 'A' && el.getAttribute('href') === '#') ev.preventDefault();
  acao(el.dataset, el, ev);
});

document.addEventListener('submit', ev => {
  const form = ev.target.closest('[data-form]');
  if (!form) return;
  ev.preventDefault();
  const fn = formularios[form.dataset.form];
  if (fn) fn(Object.fromEntries(new FormData(form)), form);
});

document.addEventListener('input', ev => {
  const campo = ev.target.dataset?.mudar;
  if (campo === 'busca') { S.busca = ev.target.value; render(); }
  else if (campo === 'entrada-numero') S.entrada.numero = ev.target.value;
  else if (campo === 'entrada-nome') S.entrada.nome = ev.target.value;
  else if (campo === 'pagar-valor') {
    const c = comandaPorId(S.tmp.pagar.comanda);
    const troco = centavos(ev.target.value) - c.falta;
    const el = $('#troco'); if (el) el.textContent = troco > 0 ? `Troco: ${reais(troco)}` : '';
  }
});

document.addEventListener('change', ev => {
  if (ev.target.dataset?.trocar === 'dia' && ev.target.value) {
    S.data = ev.target.value; S.relatorio = ''; S.historicoCarregado = false; carregar();
  }
});

document.addEventListener('keydown', ev => {
  const naBusca = ev.target.matches?.('[data-mudar="busca"]');
  if (ev.key === 'Escape') {
    if (S.modal) return fecharModal();
    if (naBusca && S.busca) { S.busca = ''; render(); return; }
  }
  if (ev.key === 'Enter' && ev.target.matches('[role="button"][data-acao]')) return ev.target.click();

  // Enter na busca: se sobrou um resultado só, puxa a reserva (entrada) ou abre a comanda (saída).
  if (ev.key === 'Enter' && naBusca) {
    ev.preventDefault();
    if (!S.busca.trim()) return;
    const achados = resultadosBusca();
    if (achados.length !== 1) return avisar(achados.length ? `${achados.length} resultados. Clique no certo.` : 'Nada encontrado.', !achados.length);
    S.busca = '';
    if (S.aba === 'entrada') return acoes.chegou({ id: achados[0].id });
    render();
    acoes['abrir-comanda']({ id: achados[0].id });
    return;
  }

  // Na Saída, começar a digitar com nada em foco já vai para a busca do número.
  const digitando = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (!digitando && !S.modal && ['saida', 'vouchers'].includes(S.aba)
      && ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
    $('[data-mudar="busca"]')?.focus();
  }
});

// Ao mudar o tamanho da janela (ex.: PC ↔ tablet), refaz o layout.
let esperaTamanho = null;
window.addEventListener('resize', () => {
  clearTimeout(esperaTamanho);
  esperaTamanho = setTimeout(() => { if (S.estado) render(); }, 150);
});

// Ao voltar para o app (tablet que ficou bloqueado), atualiza.
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.token) carregar(); });

async function iniciar() {
  render();
  await carregar();
  conectarTempoReal();
  if (pode(...CAIXA)) {
    api('GET', '/api/vouchers').then(v => { S.vouchers = v; }).catch(() => {});
    fetch('/api/usuarios-login').then(r => r.json()).then(l => { S.usuariosNomes = l.map(u => u.nome); }).catch(() => {});
  }
}

if (S.token) iniciar(); else render();
