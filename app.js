/* Secran Gestão · Conciliação Financeira · multi-empresa */

// =================== STATE ===================
const STORE_KEY = 'secran-conciliacao-v2';
const state = load() || freshState();

function freshState() {
  return {
    empresas: [],         // { id, nome, fantasia, cnpj, consultorIds:[], createdAt }
    consultores: [],      // { id, nome, email, telefone, cargo, createdAt }
    empresaAtivaId: '',
    data: {},             // { [empresaId]: { plano:[], rules:[], transactions:[], fornecedores:[], centros:[] } }
  };
}

function save() { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
}

function ensureBucket(empresaId) {
  if (!state.data[empresaId]) {
    state.data[empresaId] = { plano:[], rules:[], transactions:[], fornecedores:[], centros:[] };
  }
  return state.data[empresaId];
}
function bucket() {
  if (!state.empresaAtivaId) return null;
  return ensureBucket(state.empresaAtivaId);
}

// =================== HELPERS ===================
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const fmtMoney = v => (Number(v)||0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' });

function parseDate(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toLocaleDateString('pt-BR');
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${String(d.d).padStart(2,'0')}/${String(d.m).padStart(2,'0')}/${d.y}`;
  }
  return String(v);
}

function toast(msg, kind='') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast ' + kind; }, 2800);
}

function normalizeStr(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function requireEmpresa(action) {
  if (!state.empresaAtivaId) {
    toast('Selecione uma empresa primeiro', 'error');
    return false;
  }
  return true;
}

function empresaById(id) { return state.empresas.find(e => e.id === id); }
function consultorById(id) { return state.consultores.find(c => c.id === id); }

// =================== TAB NAV ===================
$$('.nav-btn').forEach(b => b.addEventListener('click', () => {
  const tab = b.dataset.tab;
  if (b.dataset.needsEmpresa !== undefined && !requireEmpresa()) return;
  $$('.nav-btn').forEach(x => x.classList.toggle('active', x === b));
  $$('.tab').forEach(x => x.classList.toggle('hidden', x.dataset.tab !== tab));
  renderTab(tab);
}));

function renderTab(tab) {
  if (tab === 'dashboard')   renderDashboard();
  if (tab === 'empresas')    renderEmpresas();
  if (tab === 'consultores') renderConsultores();
  if (tab === 'plano')       renderPlano();
  if (tab === 'rules')       renderRules();
  if (tab === 'conciliar')   renderConciliar();
  if (tab === 'historico')   renderHistorico();
}

// =================== EMPRESA SELECTOR ===================
function renderEmpresaSelector() {
  const sel = $('#empresa-active');
  sel.innerHTML = '<option value="">— selecione —</option>' +
    state.empresas.map(e => `<option value="${e.id}" ${e.id===state.empresaAtivaId?'selected':''}>${escapeHtml(e.fantasia || e.nome)}</option>`).join('');

  // habilita/desabilita nav
  const hasEmp = !!state.empresaAtivaId;
  $$('.nav-btn[data-needs-empresa]').forEach(b => b.disabled = !hasEmp);
}

$('#empresa-active').addEventListener('change', e => {
  state.empresaAtivaId = e.target.value;
  if (state.empresaAtivaId) ensureBucket(state.empresaAtivaId);
  save();
  renderEmpresaSelector();
  renderDashboard();
  // se aba atual depende de empresa e não tem empresa, volta pro dashboard
  const activeTab = $$('.nav-btn.active')[0]?.dataset.tab;
  if (!state.empresaAtivaId && $$('.nav-btn.active')[0]?.dataset.needsEmpresa !== undefined) {
    $$('.nav-btn').forEach(x => x.classList.toggle('active', x.dataset.tab === 'dashboard'));
    $$('.tab').forEach(x => x.classList.toggle('hidden', x.dataset.tab !== 'dashboard'));
    renderDashboard();
  } else if (activeTab) {
    renderTab(activeTab);
  }
});

// =================== TEMPLATES ===================
const TPL_PLANO = [
  { Grupo:'Receitas operacionais', Categoria:'Receita com serviços', Subgrupo:1, 'nivel 1':'(+) Receitas operacionais', KEY:1, Tipo:'Entrada' },
  { Grupo:'Receitas operacionais', Categoria:'Multas Recebidas',     Subgrupo:2, 'nivel 1':'(+) Receitas operacionais', KEY:1, Tipo:'Entrada' },
  { Grupo:'Receitas operacionais', Categoria:'Juros Recebidos',      Subgrupo:3, 'nivel 1':'(+) Receitas operacionais', KEY:1, Tipo:'Entrada' },
  { Grupo:'Receitas operacionais', Categoria:'Descontos Concedidos', Subgrupo:4, 'nivel 1':'(+) Receitas operacionais', KEY:1, Tipo:'Saída' },
  { Grupo:'Receitas operacionais', Categoria:'Outras receitas',      Subgrupo:5, 'nivel 1':'(+) Receitas operacionais', KEY:1, Tipo:'Entrada' },
  { Grupo:'Custos operacionais',   Categoria:'Custo serviço prestado', Subgrupo:6, 'nivel 1':'(-) Custo do Serviço prestado', KEY:3, Tipo:'Saída' },
  { Grupo:'Custos operacionais',   Categoria:'Salários, encargos e benefícios', Subgrupo:16, 'nivel 1':'(-) Despesas com Pessoal', KEY:5, Tipo:'Saída' },
  { Grupo:'Custos operacionais',   Categoria:'Prolabore', Subgrupo:17, 'nivel 1':'(-) Despesas com Pessoal', KEY:5, Tipo:'Saída' },
  { Grupo:'Despesas operacionais e outras receitas', Categoria:'Aluguel e condomínio', Subgrupo:18, 'nivel 1':'(-) Despesas de Ocupação', KEY:7, Tipo:'Saída' },
  { Grupo:'Despesas operacionais e outras receitas', Categoria:'Luz', Subgrupo:19, 'nivel 1':'(-) Despesas de Ocupação', KEY:7, Tipo:'Saída' },
  { Grupo:'Despesas operacionais e outras receitas', Categoria:'Material de escritório', Subgrupo:20, 'nivel 1':'(-) Despesas Operacionais', KEY:4, Tipo:'Saída' },
  { Grupo:'Despesas operacionais e outras receitas', Categoria:'Serviços contratados', Subgrupo:21, 'nivel 1':'(-) Despesas Operacionais', KEY:4, Tipo:'Saída' },
  { Grupo:'Despesas operacionais e outras receitas', Categoria:'Despesas com comunicação', Subgrupo:22, 'nivel 1':'(-) Despesas Operacionais', KEY:4, Tipo:'Saída' },
  { Grupo:'Despesas operacionais e outras receitas', Categoria:'Telefone e Internet', Subgrupo:27, 'nivel 1':'(-) Despesas de Ocupação', KEY:7, Tipo:'Saída' },
  { Grupo:'Despesas operacionais e outras receitas', Categoria:'Tarifa bancária', Subgrupo:26, 'nivel 1':'(-/-) Resultado Financeiro', KEY:10, Tipo:'Saída' },
];
const TPL_RECEBIDAS = [{
  Id:1, Vencimento:'01/04/2026', 'Competência':'01/04/2026', 'Previsto para':'01/04/2026',
  'Data de pagamento':'01/04/2026', 'CPF/CNPJ':'', Nome:'EXEMPLO CLIENTE LTDA',
  'Descrição':'Pix recebido referente serviço prestado',
  'Referência':'', Categoria:'Receita com serviços / Service Revenue', Detalhamento:'',
  'Centro de Custo':'OPERAÇÃO', 'Valor categoria/centro de custo':1500.00,
  Identificador:'Sem identificador', Banco:'Banco C6', 'Número NFS-e':''
}];
const TPL_PAGAS = [{
  Id:1, Vencimento:'01/04/2026', 'Competência':'01/04/2026', 'Previsto para':'01/04/2026',
  'Data de pagamento':'01/04/2026', 'CPF/CNPJ':'', Nome:'CLARO S.A',
  'Descrição':'Internet fibra empresarial - mensalidade',
  'Referência':'', Categoria:'Telefone e Internet / Telecommunications Expense', Detalhamento:'',
  'Centro de Custo':'OPERAÇÃO', 'Valor categoria/centro de custo':-249.90,
  Identificador:'Sem identificador', Banco:'Banco C6'
}];

function downloadTemplate(kind) {
  let rows, name;
  if (kind === 'plano')      { rows = TPL_PLANO;      name = 'modelo_plano_de_contas.xlsx'; }
  else if (kind === 'recebidas') { rows = TPL_RECEBIDAS; name = 'modelo_contas_recebidas.xlsx'; }
  else if (kind === 'pagas') { rows = TPL_PAGAS;      name = 'modelo_contas_pagas.xlsx'; }
  else return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
  XLSX.writeFile(wb, name);
  toast('Modelo baixado: ' + name, 'success');
}
$$('[data-download]').forEach(b => b.addEventListener('click', () => downloadTemplate(b.dataset.download)));

// =================== IMPORTERS ===================
function readSheet(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => { try {
      const wb = XLSX.read(e.target.result, { type:'array' });
      resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'' }));
    } catch (err) { reject(err); } };
    r.onerror = () => reject(new Error('Falha ao ler arquivo'));
    r.readAsArrayBuffer(file);
  });
}
function readText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = () => reject(new Error('Falha ao ler OFX'));
    r.readAsText(file, 'ISO-8859-1');
  });
}

function importPlano(rows) {
  const b = bucket(); if (!b) return;
  b.plano = rows.map(r => ({
    grupo:    r['Grupo'] || '',
    categoria:r['Categoria'] || '',
    subgrupo: r['Subgrupo'] || '',
    nivel1:   r['nivel 1'] || r['Nivel 1'] || r['nível 1'] || r['Nível 1'] || '',
    key:      r['KEY'] || r['Key'] || r['key'] || '',
    tipo:     r['Tipo'] || '',
  })).filter(r => r.categoria);
  save();
}

function importTransactions(rows, source) {
  const b = bucket(); if (!b) return;
  const tx = rows.map((r, idx) => normalizeTxFromXlsx(r, source, idx)).filter(Boolean);
  for (const t of tx) {
    if (t.fornecedor && !b.fornecedores.includes(t.fornecedor)) b.fornecedores.push(t.fornecedor);
    if (t.centroCusto && !b.centros.includes(t.centroCusto)) b.centros.push(t.centroCusto);
  }
  b.transactions = b.transactions.concat(tx);
  applySuggestions();
  save();
}

function normalizeTxFromXlsx(r, source, idx) {
  const valor = Number(r['Valor categoria/centro de custo'] ?? r['Valor'] ?? 0) || 0;
  const data  = parseDate(r['Data de pagamento'] || r['Vencimento'] || r['Competência']);
  const desc  = String(r['Descrição'] || r['Descricao'] || '');
  const nome  = String(r['Nome'] || '');
  if (!desc && !nome && !valor) return null;
  let tipo;
  if (source === 'recebidas') tipo = 'recebimento';
  else if (source === 'pagas') tipo = 'pagamento';
  else tipo = valor >= 0 ? 'recebimento' : 'pagamento';
  return {
    id: uid(), source,
    extId: r['Id'] || r['Identificador'] || `${source}-${idx}`,
    data, fornecedor: nome, descricao: desc, valor,
    categoriaOriginal: String(r['Categoria'] || ''),
    centroCusto: String(r['Centro de Custo'] || ''),
    banco: String(r['Banco'] || ''),
    cpfCnpj: String(r['CPF/CNPJ'] || ''),
    tipo, status: 'pending',
    sugCategoria: '', sugFornecedor: '', sugCentro: '', sugTipo: tipo, sugReason: '',
  };
}

function parseOFX(text) {
  const body = text.replace(/^[\s\S]*?<OFX>/i, '<OFX>');
  const blocks = body.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  const get = (b, tag) => {
    const m = b.match(new RegExp('<' + tag + '>([^<\\r\\n]+)', 'i'));
    return m ? m[1].trim() : '';
  };
  return blocks.map(b => {
    const dt = get(b,'DTPOSTED').slice(0,8);
    const data = dt.length >= 8 ? `${dt.slice(6,8)}/${dt.slice(4,6)}/${dt.slice(0,4)}` : '';
    return {
      tipo:  get(b,'TRNTYPE'),
      data,
      valor: Number(get(b,'TRNAMT').replace(',', '.')) || 0,
      memo:  get(b,'MEMO'),
      name:  get(b,'NAME'),
      fitid: get(b,'FITID'),
    };
  });
}

function importOFX(rows) {
  const b = bucket(); if (!b) return;
  const tx = rows.map((r, idx) => {
    const valor = Number(r.valor) || 0;
    const desc = r.memo || r.name || '';
    return {
      id: uid(), source: 'ofx',
      extId: r.fitid || `ofx-${idx}`,
      data: r.data, fornecedor: r.name || '', descricao: desc,
      valor, categoriaOriginal: '', centroCusto: '', banco: '', cpfCnpj: '',
      tipo: valor >= 0 ? 'recebimento' : 'pagamento',
      status: 'pending',
      sugCategoria: '', sugFornecedor: '', sugCentro: '',
      sugTipo: valor >= 0 ? 'recebimento' : 'pagamento', sugReason: '',
    };
  });
  b.transactions = b.transactions.concat(tx);
  applySuggestions();
  save();
}

$$('[data-import]').forEach(inp => inp.addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  if (!requireEmpresa()) { e.target.value = ''; return; }
  const kind = inp.dataset.import;
  try {
    if (kind === 'plano') {
      importPlano(await readSheet(file));
      toast(`Plano: ${bucket().plano.length} categorias importadas`, 'success');
    } else if (kind === 'recebidas' || kind === 'pagas') {
      const before = bucket().transactions.length;
      importTransactions(await readSheet(file), kind);
      toast(`${kind === 'recebidas' ? 'Recebidas' : 'Pagas'}: ${bucket().transactions.length - before} lançamentos`, 'success');
    } else if (kind === 'ofx') {
      const parsed = parseOFX(await readText(file));
      if (!parsed.length) { toast('OFX vazio ou inválido', 'error'); return; }
      const before = bucket().transactions.length;
      importOFX(parsed);
      toast(`OFX: ${bucket().transactions.length - before} lançamentos`, 'success');
    }
    e.target.value = '';
    renderDashboard();
  } catch (err) {
    console.error(err);
    toast('Erro: ' + err.message, 'error');
  }
}));

// =================== SUGGESTIONS ===================
function findCategoriaInPlano(needle) {
  const b = bucket(); if (!b) return '';
  const n = normalizeStr(needle); if (!n) return '';
  const exact = b.plano.find(p => normalizeStr(p.categoria) === n);
  if (exact) return exact.categoria;
  const inc = b.plano.find(p => n.includes(normalizeStr(p.categoria)) || normalizeStr(p.categoria).includes(n));
  return inc ? inc.categoria : '';
}

function applySuggestions() {
  const b = bucket(); if (!b) return;
  const fieldMap = { descricao:'descricao', nome:'fornecedor', categoriaOriginal:'categoriaOriginal' };
  for (const t of b.transactions) {
    if (t.status !== 'pending') continue;
    let sug = '', reason = '';

    for (const r of b.rules) {
      const prop = fieldMap[r.field] || r.field;
      const target = normalizeStr(t[prop] || '');
      if (target && target.includes(normalizeStr(r.keyword))) {
        sug = r.categoria;
        reason = `Regra: "${r.keyword}" em ${({descricao:'descrição',nome:'nome',categoriaOriginal:'categoria do relatório'}[r.field]) || r.field}`;
        if (r.tipo) t.sugTipo = r.tipo;
        break;
      }
    }
    if (!sug && t.categoriaOriginal) {
      const head = t.categoriaOriginal.split('/')[0].trim();
      const m = findCategoriaInPlano(head);
      if (m) { sug = m; reason = 'Casado pela categoria do relatório'; }
    }
    t.sugCategoria = sug;
    t.sugReason = reason;
    t.sugFornecedor = t.sugFornecedor || t.fornecedor;
    t.sugCentro = t.sugCentro || t.centroCusto;
  }
}

// =================== EMPRESAS CRUD ===================
$('#btn-add-empresa').addEventListener('click', () => openEmpresaForm());

function openEmpresaForm(empresaId) {
  const f = $('#empresa-form');
  f.classList.remove('hidden');
  f.dataset.editId = empresaId || '';
  f.reset();

  // popula consultores em checkboxes
  const stack = $('#empresa-form-consultores');
  if (!state.consultores.length) {
    stack.innerHTML = '<div style="color:var(--gray-600);font-size:12px;padding:6px;">Cadastre consultores primeiro na aba "Consultores".</div>';
  } else {
    stack.innerHTML = state.consultores.map(c =>
      `<label><input type="checkbox" value="${c.id}"><span>${escapeHtml(c.nome)}${c.cargo?` <em style="color:var(--gray-600);">— ${escapeHtml(c.cargo)}</em>`:''}</span></label>`
    ).join('');
  }

  if (empresaId) {
    const e = empresaById(empresaId);
    if (!e) return;
    f.querySelector('[name=nome]').value = e.nome;
    f.querySelector('[name=cnpj]').value = e.cnpj || '';
    f.querySelector('[name=fantasia]').value = e.fantasia || '';
    stack.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.checked = (e.consultorIds || []).includes(cb.value);
    });
  }
}

$('[data-close-form="empresa"]').addEventListener('click', () => $('#empresa-form').classList.add('hidden'));

$('#empresa-form').addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const editId = e.target.dataset.editId;
  const consultorIds = Array.from(e.target.querySelectorAll('#empresa-form-consultores input:checked')).map(x => x.value);
  const payload = {
    nome: String(fd.get('nome')).trim(),
    fantasia: String(fd.get('fantasia') || '').trim(),
    cnpj: String(fd.get('cnpj') || '').trim(),
    consultorIds,
  };

  if (editId) {
    const e2 = empresaById(editId);
    Object.assign(e2, payload);
    toast('Empresa atualizada', 'success');
  } else {
    const newE = { id: uid(), ...payload, createdAt: Date.now() };
    state.empresas.push(newE);
    ensureBucket(newE.id);
    if (!state.empresaAtivaId) state.empresaAtivaId = newE.id;
    toast('Empresa cadastrada', 'success');
  }
  save();
  $('#empresa-form').classList.add('hidden');
  renderEmpresaSelector();
  renderEmpresas();
  renderDashboard();
});

function renderEmpresas() {
  const tb = $('#table-empresas tbody');
  tb.innerHTML = '';
  if (!state.empresas.length) {
    tb.innerHTML = `<tr><td colspan="7" style="padding:40px;text-align:center;color:var(--gray-600);">Nenhuma empresa cadastrada. Clique em "+ Nova empresa".</td></tr>`;
    return;
  }
  for (const e of state.empresas) {
    const b = state.data[e.id] || { plano:[], transactions:[] };
    const tr = document.createElement('tr');
    const consultorNomes = (e.consultorIds || []).map(id => consultorById(id)?.nome).filter(Boolean);
    tr.innerHTML = `
      <td><strong>${escapeHtml(e.nome)}</strong></td>
      <td>${escapeHtml(e.fantasia || '—')}</td>
      <td>${escapeHtml(e.cnpj || '—')}</td>
      <td>${consultorNomes.length ? consultorNomes.map(n => `<span class="tag-pill">${escapeHtml(n)}</span>`).join(' ') : '<span class="tag-pill muted">nenhum</span>'}</td>
      <td>${b.transactions.length}</td>
      <td>${b.plano.length}</td>
      <td>
        <button class="btn btn-ghost" data-action="select" style="padding:5px 10px;font-size:11px;">Ativar</button>
        <button class="btn btn-ghost" data-action="edit" style="padding:5px 10px;font-size:11px;">Editar</button>
        <button class="row-action" data-action="delete" title="Excluir">×</button>
      </td>
    `;
    tr.querySelector('[data-action=select]').addEventListener('click', () => {
      state.empresaAtivaId = e.id; save();
      renderEmpresaSelector(); renderDashboard();
      toast(`Empresa ativa: ${e.fantasia || e.nome}`, 'success');
    });
    tr.querySelector('[data-action=edit]').addEventListener('click', () => openEmpresaForm(e.id));
    tr.querySelector('[data-action=delete]').addEventListener('click', () => {
      if (!confirm(`Excluir "${e.nome}" e TODOS os seus dados (plano, regras, lançamentos)?`)) return;
      delete state.data[e.id];
      state.empresas = state.empresas.filter(x => x.id !== e.id);
      if (state.empresaAtivaId === e.id) state.empresaAtivaId = state.empresas[0]?.id || '';
      save();
      renderEmpresaSelector(); renderEmpresas(); renderDashboard();
      toast('Empresa excluída');
    });
    tb.appendChild(tr);
  }
}

// =================== CONSULTORES CRUD ===================
$('#btn-add-consultor').addEventListener('click', () => openConsultorForm());

function openConsultorForm(consultorId) {
  const f = $('#consultor-form');
  f.classList.remove('hidden');
  f.dataset.editId = consultorId || '';
  f.reset();
  if (consultorId) {
    const c = consultorById(consultorId);
    if (!c) return;
    f.querySelector('[name=nome]').value = c.nome;
    f.querySelector('[name=email]').value = c.email || '';
    f.querySelector('[name=telefone]').value = c.telefone || '';
    f.querySelector('[name=cargo]').value = c.cargo || '';
  }
}

$('[data-close-form="consultor"]').addEventListener('click', () => $('#consultor-form').classList.add('hidden'));

$('#consultor-form').addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const editId = e.target.dataset.editId;
  const payload = {
    nome: String(fd.get('nome')).trim(),
    email: String(fd.get('email') || '').trim(),
    telefone: String(fd.get('telefone') || '').trim(),
    cargo: String(fd.get('cargo') || '').trim(),
  };
  if (editId) {
    Object.assign(consultorById(editId), payload);
    toast('Consultor atualizado', 'success');
  } else {
    state.consultores.push({ id: uid(), ...payload, createdAt: Date.now() });
    toast('Consultor cadastrado', 'success');
  }
  save();
  $('#consultor-form').classList.add('hidden');
  renderConsultores();
});

function renderConsultores() {
  const tb = $('#table-consultores tbody');
  tb.innerHTML = '';
  if (!state.consultores.length) {
    tb.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--gray-600);">Nenhum consultor cadastrado.</td></tr>`;
    return;
  }
  for (const c of state.consultores) {
    const empresasVinc = state.empresas.filter(e => (e.consultorIds || []).includes(c.id));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(c.nome)}</strong></td>
      <td>${escapeHtml(c.email || '—')}</td>
      <td>${escapeHtml(c.telefone || '—')}</td>
      <td>${escapeHtml(c.cargo || '—')}</td>
      <td>${empresasVinc.length ? empresasVinc.map(e => `<span class="tag-pill">${escapeHtml(e.fantasia || e.nome)}</span>`).join(' ') : '<span class="tag-pill muted">nenhuma</span>'}</td>
      <td>
        <button class="btn btn-ghost" data-action="edit" style="padding:5px 10px;font-size:11px;">Editar</button>
        <button class="row-action" data-action="delete" title="Excluir">×</button>
      </td>
    `;
    tr.querySelector('[data-action=edit]').addEventListener('click', () => openConsultorForm(c.id));
    tr.querySelector('[data-action=delete]').addEventListener('click', () => {
      if (!confirm(`Excluir "${c.nome}"?`)) return;
      state.consultores = state.consultores.filter(x => x.id !== c.id);
      // remove dos vínculos
      for (const e of state.empresas) {
        e.consultorIds = (e.consultorIds || []).filter(id => id !== c.id);
      }
      save();
      renderConsultores(); renderEmpresas();
      toast('Consultor excluído');
    });
    tb.appendChild(tr);
  }
}

// =================== PLANO ===================
function renderPlano() {
  const b = bucket();
  $('#plano-empresa-tag').textContent = empresaAtivaLabel();
  const tb = $('#table-plano tbody');
  tb.innerHTML = '';
  if (!b || !b.plano.length) {
    tb.innerHTML = `<tr><td colspan="7" style="padding:40px;border:0;text-align:center;color:var(--gray-600);">Nenhuma categoria. Importe via planilha ou clique em "+ Nova categoria".</td></tr>`;
    return;
  }
  b.plano.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="cell" data-field="grupo" value="${escapeHtml(p.grupo)}"></td>
      <td><input class="cell" data-field="categoria" value="${escapeHtml(p.categoria)}"></td>
      <td><input class="cell" data-field="subgrupo" value="${escapeHtml(p.subgrupo)}" style="max-width:80px"></td>
      <td><input class="cell" data-field="nivel1" value="${escapeHtml(p.nivel1)}"></td>
      <td><input class="cell" data-field="key" value="${escapeHtml(p.key)}" style="max-width:60px"></td>
      <td>
        <select class="cell" data-field="tipo">
          <option ${p.tipo==='Entrada'?'selected':''}>Entrada</option>
          <option ${p.tipo==='Saída'?'selected':''}>Saída</option>
        </select>
      </td>
      <td><button class="row-action" title="Excluir">×</button></td>
    `;
    tr.querySelectorAll('.cell').forEach(inp => inp.addEventListener('change', () => {
      p[inp.dataset.field] = inp.value;
      save();
    }));
    tr.querySelector('.row-action').addEventListener('click', () => {
      if (confirm(`Excluir "${p.categoria}"?`)) { b.plano.splice(i,1); save(); renderPlano(); renderDashboard(); }
    });
    tb.appendChild(tr);
  });
}

$('#btn-add-plano').addEventListener('click', () => {
  if (!requireEmpresa()) return;
  bucket().plano.push({ grupo:'', categoria:'Nova categoria', subgrupo:'', nivel1:'', key:'', tipo:'Saída' });
  save(); renderPlano();
});

// =================== RULES ===================
function renderRules() {
  const b = bucket();
  $('#rules-empresa-tag').textContent = empresaAtivaLabel();
  const sel = $('#rule-categoria');
  sel.innerHTML = (b && b.plano.length)
    ? b.plano.map(p => `<option value="${escapeHtml(p.categoria)}">${escapeHtml(p.categoria)}</option>`).join('')
    : '<option value="">— importe o plano de contas primeiro —</option>';

  const tb = $('#table-rules tbody');
  tb.innerHTML = '';
  if (!b || !b.rules.length) {
    tb.innerHTML = `<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--gray-600);">Nenhuma regra cadastrada.</td></tr>`;
    return;
  }
  b.rules.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${({descricao:'Descrição', nome:'Nome / Fornecedor', categoriaOriginal:'Categoria do relatório'}[r.field]) || r.field}</td>
      <td><strong>${escapeHtml(r.keyword)}</strong></td>
      <td>${escapeHtml(r.categoria)}</td>
      <td>${r.tipo ? r.tipo : '—'}</td>
      <td><button class="row-action" title="Excluir">×</button></td>
    `;
    tr.querySelector('.row-action').addEventListener('click', () => {
      b.rules.splice(i,1); save(); applySuggestions(); save(); renderRules();
    });
    tb.appendChild(tr);
  });
}

$('#btn-add-rule').addEventListener('click', () => {
  if (!requireEmpresa()) return;
  if (!bucket().plano.length) { toast('Importe o plano de contas antes de criar regras', 'error'); return; }
  $('#rule-form').classList.remove('hidden');
});
$('[data-close-form="rule"]').addEventListener('click', () => { $('#rule-form').classList.add('hidden'); $('#rule-form').reset(); });
$('#rule-form').addEventListener('submit', e => {
  e.preventDefault();
  const b = bucket(); if (!b) return;
  const fd = new FormData(e.target);
  b.rules.push({
    id: uid(),
    field: fd.get('field'),
    keyword: String(fd.get('keyword')).trim(),
    categoria: fd.get('categoria'),
    tipo: fd.get('tipo') || '',
  });
  save();
  applySuggestions();
  save();
  e.target.reset();
  $('#rule-form').classList.add('hidden');
  renderRules();
  toast('Regra criada · sugestões atualizadas', 'success');
});

// =================== CONCILIAR ===================
function getFiltered() {
  const b = bucket(); if (!b) return [];
  const status = $('#filter-status').value;
  const source = $('#filter-source').value;
  const q = normalizeStr($('#filter-search').value);
  return b.transactions.filter(t => {
    if (status !== 'all' && t.status !== status) return false;
    if (source !== 'all' && t.source !== source) return false;
    if (q) {
      const hay = normalizeStr(t.descricao + ' ' + t.fornecedor + ' ' + t.categoriaOriginal);
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderConciliar() {
  const b = bucket();
  $('#conciliar-empresa-tag').textContent = empresaAtivaLabel();
  const list = $('#conciliar-list');
  list.innerHTML = '';
  if (!b || !b.transactions.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">▦</div>Importe um relatório (recebidas, pagas) ou um arquivo OFX para começar.</div>`;
    updateBatchCount();
    return;
  }
  const txs = getFiltered();
  if (!txs.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">✓</div>Nada para conciliar com esses filtros.</div>`;
    updateBatchCount();
    return;
  }
  for (const t of txs) list.appendChild(renderItem(t));
  updateBatchCount();
}

function renderItem(t) {
  const b = bucket();
  const el = document.createElement('div');
  el.className = 'conciliar-item' + (t.status === 'approved' ? ' approved' : t.status === 'rejected' ? ' rejected' : '');
  el.dataset.id = t.id;

  const valorClass = t.valor >= 0 ? 'pos' : 'neg';
  const valorAbs = fmtMoney(Math.abs(t.valor));
  const palpite = t.sugCategoria ? `<div class="palpite-tag">palpite</div>` : '';

  const catOpts = ['<option value="">Categoria</option>']
    .concat(b.plano.map(p => `<option value="${escapeHtml(p.categoria)}" ${p.categoria===t.sugCategoria?'selected':''}>${escapeHtml(p.categoria)}</option>`))
    .join('');
  const fornOpts = b.fornecedores.map(f => `<option value="${escapeHtml(f)}">`).join('');
  const cdcOpts = ['<option value="">Centro de custo</option>']
    .concat(b.centros.map(c => `<option value="${escapeHtml(c)}" ${c===t.sugCentro?'selected':''}>${escapeHtml(c)}</option>`))
    .join('');

  el.innerHTML = `
    <div class="ci-check"><input type="checkbox" class="ci-cb" ${t.status==='approved'?'disabled':''}></div>
    <div class="ci-tx">
      <div class="ci-tx-head">
        Transação
        <span class="ci-tx-amount ${valorClass}">${valorAbs}</span>
      </div>
      <div class="ci-tx-date">${escapeHtml(t.data)} ${t.banco ? '· ' + escapeHtml(t.banco) : ''} ${t.source==='ofx' ? '· OFX' : ''}</div>
      <div class="ci-tx-desc">${escapeHtml(t.descricao || t.fornecedor || '—')}</div>
      <div class="ci-tx-meta">${t.fornecedor ? 'Fornecedor original: ' + escapeHtml(t.fornecedor) : ''}${t.categoriaOriginal ? ' · Cat. relatório: ' + escapeHtml(t.categoriaOriginal) : ''}</div>
    </div>
    <div class="ci-sug">
      ${palpite}
      <div class="ci-sug-tabs">
        <button class="ci-tab ${t.sugTipo==='recebimento'?'active':''}" data-tipo="recebimento">Recebimento</button>
        <button class="ci-tab ${t.sugTipo==='pagamento'?'active':''}" data-tipo="pagamento">Pagamento</button>
        <button class="ci-tab ${t.sugTipo==='transferencia'?'active':''}" data-tipo="transferencia">Transferência</button>
      </div>
      <div class="ci-fields">
        <div class="full">
          <input list="forn-list-${t.id}" class="ci-fornecedor" placeholder="Fornecedor / Cliente" value="${escapeHtml(t.sugFornecedor || '')}">
          <datalist id="forn-list-${t.id}">${fornOpts}</datalist>
        </div>
        <div class="full">
          <div class="ci-row-2">
            <select class="ci-categoria">${catOpts}</select>
            <select class="ci-centro">${cdcOpts}</select>
          </div>
        </div>
        ${t.sugReason ? `<div class="full" style="font-size:11px;color:var(--gray-600);">▸ ${escapeHtml(t.sugReason)}</div>` : ''}
      </div>
    </div>
    <div class="ci-actions">
      <button class="ci-ok ${t.status==='approved'?'approved':''}" title="Aprovar">${t.status==='approved'?'✓':'OK'}</button>
      <button class="ci-reject">rejeitar</button>
    </div>
  `;

  el.querySelectorAll('.ci-tab').forEach(tab => tab.addEventListener('click', () => {
    el.querySelectorAll('.ci-tab').forEach(x => x.classList.remove('active'));
    tab.classList.add('active');
    t.sugTipo = tab.dataset.tipo; save();
  }));
  el.querySelector('.ci-fornecedor').addEventListener('change', e => { t.sugFornecedor = e.target.value; save(); });
  el.querySelector('.ci-categoria').addEventListener('change', e => { t.sugCategoria = e.target.value; save(); });
  el.querySelector('.ci-centro').addEventListener('change', e => { t.sugCentro = e.target.value; save(); });
  el.querySelector('.ci-ok').addEventListener('click', () => approveOne(t));
  el.querySelector('.ci-reject').addEventListener('click', () => {
    t.status = 'rejected'; save(); renderConciliar(); toast('Lançamento rejeitado');
  });
  el.querySelector('.ci-cb').addEventListener('change', updateBatchCount);
  return el;
}

function approveOne(t) {
  const b = bucket();
  if (!t.sugCategoria) { toast('Selecione uma categoria antes de aprovar', 'error'); return; }
  t.status = 'approved';
  if (t.sugFornecedor && !b.fornecedores.includes(t.sugFornecedor)) b.fornecedores.push(t.sugFornecedor);
  if (t.sugCentro && !b.centros.includes(t.sugCentro)) b.centros.push(t.sugCentro);
  save();
  renderConciliar();
  toast('Conciliado', 'success');
}

function updateBatchCount() {
  const n = $$('.ci-cb:checked').length;
  $('#batch-count').textContent = `${n} selecionado${n===1?'':'s'}`;
}

$('#check-all').addEventListener('change', e => {
  $$('.ci-cb:not(:disabled)').forEach(cb => cb.checked = e.target.checked);
  updateBatchCount();
});
$('#btn-batch-accept').addEventListener('click', () => {
  const b = bucket(); if (!b) return;
  const ids = $$('.ci-cb:checked').map(cb => cb.closest('.conciliar-item').dataset.id);
  if (!ids.length) { toast('Selecione lançamentos primeiro', 'error'); return; }
  let ok = 0, fail = 0;
  for (const id of ids) {
    const t = b.transactions.find(x => x.id === id);
    if (!t) continue;
    if (!t.sugCategoria) { fail++; continue; }
    t.status = 'approved';
    if (t.sugFornecedor && !b.fornecedores.includes(t.sugFornecedor)) b.fornecedores.push(t.sugFornecedor);
    if (t.sugCentro && !b.centros.includes(t.sugCentro)) b.centros.push(t.sugCentro);
    ok++;
  }
  save(); renderConciliar();
  toast(`Aprovados: ${ok}${fail?` · sem categoria: ${fail}`:''}`, ok ? 'success' : 'error');
});
$('#btn-batch-reject').addEventListener('click', () => {
  const b = bucket(); if (!b) return;
  const ids = $$('.ci-cb:checked').map(cb => cb.closest('.conciliar-item').dataset.id);
  if (!ids.length) { toast('Selecione lançamentos primeiro', 'error'); return; }
  for (const id of ids) {
    const t = b.transactions.find(x => x.id === id);
    if (t) t.status = 'rejected';
  }
  save(); renderConciliar();
  toast(`${ids.length} rejeitado${ids.length===1?'':'s'}`);
});
['#filter-status','#filter-source','#filter-search'].forEach(s => $(s).addEventListener('input', renderConciliar));

// =================== HISTÓRICO ===================
function renderHistorico() {
  const b = bucket();
  $('#historico-empresa-tag').textContent = empresaAtivaLabel();
  const tb = $('#table-historico tbody');
  tb.innerHTML = '';
  const items = (b?.transactions || []).filter(t => t.status === 'approved');
  if (!items.length) {
    tb.innerHTML = `<tr><td colspan="8" style="padding:40px;text-align:center;color:var(--gray-600);">Ainda não há conciliações aprovadas.</td></tr>`;
    return;
  }
  for (const t of items) {
    const tr = document.createElement('tr');
    const cls = t.valor >= 0 ? 'pos' : 'neg';
    tr.innerHTML = `
      <td>${escapeHtml(t.data)}</td>
      <td>${({recebimento:'Recebimento',pagamento:'Pagamento',transferencia:'Transferência'}[t.sugTipo]) || '—'}</td>
      <td>${escapeHtml(t.sugFornecedor || t.fornecedor || '—')}</td>
      <td>${escapeHtml(t.descricao)}</td>
      <td>${escapeHtml(t.sugCategoria)}</td>
      <td>${escapeHtml(t.sugCentro || '—')}</td>
      <td class="num ${cls}">${fmtMoney(t.valor)}</td>
      <td><span class="tag-pill success">aprovado</span></td>
    `;
    tb.appendChild(tr);
  }
}

$('#btn-export-aprovados').addEventListener('click', () => {
  const b = bucket();
  const items = (b?.transactions || []).filter(t => t.status === 'approved');
  if (!items.length) { toast('Nada aprovado para exportar', 'error'); return; }
  const empresa = empresaById(state.empresaAtivaId);
  const rows = items.map(t => ({
    Empresa: empresa?.fantasia || empresa?.nome || '',
    Data: t.data,
    Tipo: ({recebimento:'Recebimento',pagamento:'Pagamento',transferencia:'Transferência'}[t.sugTipo]) || '',
    Fornecedor: t.sugFornecedor || t.fornecedor,
    Descricao: t.descricao,
    Categoria: t.sugCategoria,
    'Centro de Custo': t.sugCentro,
    Valor: t.valor,
    Banco: t.banco,
    Fonte: t.source,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Conciliados');
  const safe = (empresa?.fantasia || empresa?.nome || 'empresa').replace(/[^a-z0-9]+/gi,'_').toLowerCase();
  XLSX.writeFile(wb, `conciliados_${safe}.xlsx`);
  toast('Arquivo exportado', 'success');
});

$('#btn-reset').addEventListener('click', () => {
  if (!confirm(`Apagar TODOS os dados desta empresa (plano, regras, lançamentos)?`)) return;
  if (state.empresaAtivaId) {
    state.data[state.empresaAtivaId] = { plano:[], rules:[], transactions:[], fornecedores:[], centros:[] };
    save();
  }
  renderDashboard(); renderPlano(); renderRules(); renderConciliar(); renderHistorico();
  toast('Dados da empresa limpos');
});

// =================== DASHBOARD ===================
function empresaAtivaLabel() {
  const e = empresaById(state.empresaAtivaId);
  return e ? (e.fantasia || e.nome) : '';
}

function renderDashboard() {
  const e = empresaById(state.empresaAtivaId);
  const b = bucket();
  $('#empresa-current-name').textContent = e ? (e.fantasia || e.nome) : 'Selecione uma empresa';

  const banner = $('#empresa-banner');
  if (!state.empresas.length) {
    banner.innerHTML = `
      <div class="empty-empresa-banner">
        <div class="icon">●</div>
        <div>
          <h3>Comece cadastrando uma empresa</h3>
          <p>Vá em "Empresas" no menu superior e clique em "+ Nova empresa". Cada empresa tem plano de contas, regras e conciliação independentes.</p>
        </div>
      </div>`;
  } else if (!state.empresaAtivaId) {
    banner.innerHTML = `
      <div class="empty-empresa-banner">
        <div class="icon">▸</div>
        <div>
          <h3>Selecione uma empresa</h3>
          <p>Use o seletor no topo da página para escolher com qual empresa trabalhar.</p>
        </div>
      </div>`;
  } else {
    banner.innerHTML = '';
  }

  $('#kpi-empresas').textContent    = state.empresas.length;
  $('#kpi-consultores').textContent = state.consultores.length;
  $('#kpi-pending').textContent     = (b?.transactions || []).filter(t=>t.status==='pending').length;
  $('#kpi-approved').textContent    = (b?.transactions || []).filter(t=>t.status==='approved').length;

  // status cards
  const setStatus = (id, n, label) => {
    const el = $(id);
    if (n) { el.textContent = `✓ ${n} ${label}`; el.classList.add('ok'); }
    else   { el.textContent = '— nenhum carregado —'; el.classList.remove('ok'); }
  };
  setStatus('#status-plano',     b?.plano.length || 0, 'categorias');
  setStatus('#status-recebidas', (b?.transactions || []).filter(t=>t.source==='recebidas').length, 'lançamentos');
  setStatus('#status-pagas',     (b?.transactions || []).filter(t=>t.source==='pagas').length, 'lançamentos');
  setStatus('#status-ofx',       (b?.transactions || []).filter(t=>t.source==='ofx').length, 'lançamentos OFX');
}

// =================== INIT ===================
renderEmpresaSelector();
renderDashboard();
