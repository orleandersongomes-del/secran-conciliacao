'use client';
import { useEffect, useState, useMemo } from 'react';
import { useEmpresaAtiva } from '@/lib/useEmpresaAtiva';
import { toast } from '@/components/Toast';
import { notifyRefresh, useRefreshListener } from '@/lib/refresh';

type Tx = {
  id: string;
  source: string;
  data: string | null;
  fornecedor: string | null;
  descricao: string | null;
  valor: number;
  banco: string | null;
  categoriaOriginal: string | null;
  status: string;
  sugCategoria: string | null;
  sugFornecedor: string | null;
  sugCentro: string | null;
  sugTipo: string | null;
  sugReason: string | null;
};

function fmtMoney(v: number) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ConciliarPage() {
  const empresaId = useEmpresaAtiva();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [plano, setPlano] = useState<{ id: string; categoria: string }[]>([]);
  const [empresaNome, setEmpresaNome] = useState('');
  const [filters, setFilters] = useState({ status: 'pending', source: 'all', q: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function reload() {
    if (!empresaId) return;
    const params = new URLSearchParams();
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.source !== 'all') params.set('source', filters.source);
    if (filters.q) params.set('q', filters.q);
    const [t, p, e] = await Promise.all([
      fetch(`/api/empresas/${empresaId}/transactions?${params}`).then((r) => r.json()),
      fetch(`/api/empresas/${empresaId}/plano`).then((r) => r.json()),
      fetch(`/api/empresas/${empresaId}`).then((r) => r.json()),
    ]);
    setTxs(t.transactions || []);
    setPlano(p.plano || []);
    setEmpresaNome(e.empresa?.fantasia || e.empresa?.nome || '');
    setSelected(new Set());
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [empresaId, filters.status, filters.source]);
  useRefreshListener(['transactions', 'plano', 'regras', 'dados', 'all'], reload);

  async function patchTx(id: string, patch: Partial<Tx>) {
    setTxs((arr) => arr.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    await fetch(`/api/empresas/${empresaId}/transactions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
  }

  async function approve(t: Tx) {
    if (!t.sugCategoria) return toast('Selecione uma categoria antes', 'error');
    await patchTx(t.id, { status: 'approved' });
    toast('Conciliado', 'success');
    notifyRefresh('transactions');
    reload();
  }

  async function reject(t: Tx) {
    await patchTx(t.id, { status: 'rejected' });
    toast('Rejeitado');
    notifyRefresh('transactions');
    reload();
  }

  async function batch(action: 'approve' | 'reject') {
    const ids = [...selected];
    if (!ids.length) return toast('Selecione lançamentos', 'error');
    const res = await fetch(`/api/empresas/${empresaId}/transactions/batch`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, action }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'Erro', 'error');
    toast(action === 'approve' ? `Aprovados: ${data.approved}${data.skipped ? ` · sem categoria: ${data.skipped}` : ''}` : `${data.rejected} rejeitados`, 'success');
    notifyRefresh('transactions');
    reload();
  }

  const filteredBySearch = useMemo(() => {
    if (!filters.q) return txs;
    const q = filters.q.toLowerCase();
    return txs.filter((t) => (t.descricao + ' ' + t.fornecedor + ' ' + (t.categoriaOriginal || '')).toLowerCase().includes(q));
  }, [txs, filters.q]);

  if (!empresaId) return <div className="empty"><div className="empty-icon">▦</div>Selecione uma empresa.</div>;

  return (
    <>
      <div className="row-between">
        <div>
          <h2>Conciliação <span className="tag-pill">{empresaNome}</span></h2>
          <p className="muted">Aceite ou ajuste cada sugestão. Selecione múltiplas linhas para aprovar em lote.</p>
        </div>
        <div className="row-gap">
          <select className="select-thin" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="all">Todas</option>
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovadas</option>
            <option value="rejected">Rejeitadas</option>
          </select>
          <select className="select-thin" value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
            <option value="all">Todas as fontes</option>
            <option value="recebidas">Contas recebidas</option>
            <option value="pagas">Contas pagas</option>
            <option value="ofx">OFX</option>
          </select>
          <input className="input-thin" placeholder="Buscar…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        </div>
      </div>

      <div className="batch-bar">
        <label className="check">
          <input type="checkbox" checked={selected.size > 0 && selected.size === filteredBySearch.filter((t) => t.status !== 'approved').length} onChange={(e) => {
            if (e.target.checked) setSelected(new Set(filteredBySearch.filter((t) => t.status !== 'approved').map((t) => t.id)));
            else setSelected(new Set());
          }} />
          <span>{selected.size} selecionado{selected.size === 1 ? '' : 's'}</span>
        </label>
        <div className="row-gap">
          <button className="btn btn-secondary" onClick={() => batch('approve')}>Aceitar em lote</button>
          <button className="btn btn-ghost" onClick={() => batch('reject')}>Rejeitar selecionados</button>
        </div>
      </div>

      <div className="conciliar-list">
        {filteredBySearch.length === 0 && <div className="empty"><div className="empty-icon">✓</div>Nada para conciliar com esses filtros.</div>}
        {filteredBySearch.map((t) => {
          const valor = Number(t.valor);
          const cls = valor >= 0 ? 'pos' : 'neg';
          return (
            <div key={t.id} className={`conciliar-item${t.status === 'approved' ? ' approved' : t.status === 'rejected' ? ' rejected' : ''}`}>
              <div className="ci-check">
                <input type="checkbox" disabled={t.status === 'approved'} checked={selected.has(t.id)} onChange={(e) => {
                  const s = new Set(selected); e.target.checked ? s.add(t.id) : s.delete(t.id); setSelected(s);
                }} />
              </div>
              <div className="ci-tx">
                <div className="ci-tx-head">Transação <span className={`ci-tx-amount ${cls}`}>{fmtMoney(Math.abs(valor))}</span></div>
                <div className="ci-tx-date">{t.data} {t.banco ? '· ' + t.banco : ''} {t.source === 'ofx' ? '· OFX' : ''}</div>
                <div className="ci-tx-desc">{t.descricao || t.fornecedor || '—'}</div>
                <div className="ci-tx-meta">
                  {t.fornecedor ? 'Fornecedor: ' + t.fornecedor : ''}
                  {t.categoriaOriginal ? ' · Cat. relatório: ' + t.categoriaOriginal : ''}
                </div>
              </div>
              <div className="ci-sug">
                {t.sugCategoria && <div className="palpite-tag">palpite</div>}
                <div className="ci-sug-tabs">
                  {(['recebimento', 'pagamento', 'transferencia'] as const).map((tp) => (
                    <button key={tp} className={`ci-tab${t.sugTipo === tp ? ' active' : ''}`} onClick={() => patchTx(t.id, { sugTipo: tp })}>
                      {tp.charAt(0).toUpperCase() + tp.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="ci-fields">
                  <div className="full">
                    <input placeholder="Fornecedor / Cliente" defaultValue={t.sugFornecedor || ''} onBlur={(e) => patchTx(t.id, { sugFornecedor: e.target.value })} />
                  </div>
                  <div className="full">
                    <div className="ci-row-2">
                      <select value={t.sugCategoria || ''} onChange={(e) => patchTx(t.id, { sugCategoria: e.target.value })}>
                        <option value="">Categoria</option>
                        {plano.map((p) => <option key={p.id} value={p.categoria}>{p.categoria}</option>)}
                      </select>
                      <input placeholder="Centro de custo" defaultValue={t.sugCentro || ''} onBlur={(e) => patchTx(t.id, { sugCentro: e.target.value })} />
                    </div>
                  </div>
                  {t.sugReason && <div className="full" style={{ fontSize: 11, color: 'var(--gray-600)' }}>▸ {t.sugReason}</div>}
                </div>
              </div>
              <div className="ci-actions">
                <button className={`ci-ok${t.status === 'approved' ? ' approved' : ''}`} onClick={() => approve(t)}>{t.status === 'approved' ? '✓' : 'OK'}</button>
                <button className="ci-reject" onClick={() => reject(t)}>rejeitar</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
