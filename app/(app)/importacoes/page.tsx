'use client';
import { useEffect, useState } from 'react';
import { useEmpresaAtiva } from '@/lib/useEmpresaAtiva';
import { toast } from '@/components/Toast';
import { notifyRefresh, useRefreshListener } from '@/lib/refresh';

type ImportLote = {
  source: string;
  day: string; // YYYY-MM-DD (UTC)
  total: number;
  totalValor: number;
  aprovados: number;
  pendentes: number;
  rejeitados: number;
  createdAt: string;
};

function fmtMoney(v: number) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDay(d: string) {
  const [y, m, dia] = d.split('-');
  return `${dia}/${m}/${y}`;
}
function fmtDateTime(s: string) {
  const d = new Date(s);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
const sourceLabel: Record<string, string> = {
  recebidas: 'Contas Recebidas',
  pagas: 'Contas Pagas',
  ofx: 'OFX Bancário',
};

export default function ImportacoesPage() {
  const empresaId = useEmpresaAtiva();
  const [lotes, setLotes] = useState<ImportLote[]>([]);
  const [empresaNome, setEmpresaNome] = useState('');
  const [planoCount, setPlanoCount] = useState(0);
  const [busy, setBusy] = useState(false);

  async function reload() {
    if (!empresaId) return;
    const [i, e] = await Promise.all([
      fetch(`/api/empresas/${empresaId}/imports`).then((r) => r.json()),
      fetch(`/api/empresas/${empresaId}`).then((r) => r.json()),
    ]);
    setLotes(i.imports || []);
    setEmpresaNome(e.empresa?.fantasia || e.empresa?.nome || '');
    setPlanoCount(e.empresa?._count?.plano || 0);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [empresaId]);
  useRefreshListener(['transactions', 'plano', 'dados', 'all'], reload);

  async function apagarLote(lote: ImportLote) {
    if (
      !confirm(
        `Apagar TODAS as ${lote.total} transações de "${sourceLabel[lote.source] || lote.source}" importadas em ${fmtDay(
          lote.day,
        )}?\n\nValor total: ${fmtMoney(lote.totalValor)}\n\nEsta ação não pode ser desfeita.`,
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/empresas/${empresaId}/transactions?source=${lote.source}&day=${lote.day}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return toast(data.error || 'Erro', 'error');
    toast(`${data.deleted} lançamentos removidos`, 'success');
    notifyRefresh('transactions');
    reload();
  }

  async function apagarPorFonte(source: string) {
    if (!confirm(`Apagar TODAS as transações de "${sourceLabel[source]}" (de qualquer data)?\n\nEsta ação não pode ser desfeita.`)) return;
    setBusy(true);
    const res = await fetch(`/api/empresas/${empresaId}/transactions?source=${source}`, { method: 'DELETE' });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return toast(data.error || 'Erro', 'error');
    toast(`${data.deleted} lançamentos removidos`, 'success');
    notifyRefresh('transactions');
    reload();
  }

  async function apagarTudo() {
    if (
      !confirm(
        `Apagar TODAS as transações desta empresa (recebidas + pagas + OFX)?\n\nO plano de contas e as regras permanecem intactos.\n\nEsta ação não pode ser desfeita.`,
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/empresas/${empresaId}/transactions?all=true`, { method: 'DELETE' });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return toast(data.error || 'Erro', 'error');
    toast(`${data.deleted} lançamentos removidos`, 'success');
    notifyRefresh('transactions');
    reload();
  }

  async function apagarPlano() {
    if (!confirm(`Apagar TODO o Plano de Contas (${planoCount} categorias) desta empresa?\n\nEsta ação não pode ser desfeita.`)) return;
    setBusy(true);
    const res = await fetch(`/api/empresas/${empresaId}/plano`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plano: [], mode: 'replace' }),
    });
    setBusy(false);
    if (!res.ok) return toast('Erro', 'error');
    toast(`Plano de contas zerado`, 'success');
    notifyRefresh('plano');
    reload();
  }

  if (!empresaId) return <div className="empty"><div className="empty-icon">▦</div>Selecione uma empresa.</div>;

  const totalRecebidas = lotes.filter((l) => l.source === 'recebidas').reduce((s, l) => s + l.total, 0);
  const totalPagas = lotes.filter((l) => l.source === 'pagas').reduce((s, l) => s + l.total, 0);
  const totalOfx = lotes.filter((l) => l.source === 'ofx').reduce((s, l) => s + l.total, 0);

  return (
    <>
      <div className="row-between">
        <div>
          <h2>Importações <span className="tag-pill">{empresaNome}</span></h2>
          <p className="muted">Histórico de cada arquivo importado. Subiu errado? Apague o lote inteiro com um clique.</p>
        </div>
      </div>

      {/* Ações rápidas em lote */}
      <div className="card alt" style={{ marginBottom: 18 }}>
        <h3>Ações rápidas</h3>
        <p>Use estas opções com cuidado — não há "desfazer".</p>
        <div className="row-gap" style={{ marginTop: 12 }}>
          <button className="btn btn-ghost danger" disabled={busy || !totalRecebidas} onClick={() => apagarPorFonte('recebidas')}>
            Apagar todas as Recebidas ({totalRecebidas})
          </button>
          <button className="btn btn-ghost danger" disabled={busy || !totalPagas} onClick={() => apagarPorFonte('pagas')}>
            Apagar todas as Pagas ({totalPagas})
          </button>
          <button className="btn btn-ghost danger" disabled={busy || !totalOfx} onClick={() => apagarPorFonte('ofx')}>
            Apagar todas OFX ({totalOfx})
          </button>
          <button className="btn btn-ghost danger" disabled={busy || lotes.length === 0} onClick={apagarTudo}>
            Apagar TODAS as transações
          </button>
          <button className="btn btn-ghost danger" disabled={busy || !planoCount} onClick={apagarPlano}>
            Zerar Plano de Contas ({planoCount})
          </button>
        </div>
      </div>

      {/* Lista de lotes */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Importado em</th>
              <th>Tipo de arquivo</th>
              <th>Lançamentos</th>
              <th>Aprovados</th>
              <th>Pendentes</th>
              <th>Rejeitados</th>
              <th className="num">Valor total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lotes.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-600)' }}>
                  Nenhuma importação ainda. Volte no Painel pra subir um arquivo.
                </td>
              </tr>
            )}
            {lotes.map((l, i) => (
              <tr key={i}>
                <td>{fmtDateTime(l.createdAt)}</td>
                <td>
                  <span className="tag-pill">{sourceLabel[l.source] || l.source}</span>
                </td>
                <td><strong>{l.total}</strong></td>
                <td>{l.aprovados ? <span className="tag-pill success">{l.aprovados}</span> : '—'}</td>
                <td>{l.pendentes || '—'}</td>
                <td>{l.rejeitados || '—'}</td>
                <td className="num">{fmtMoney(l.totalValor)}</td>
                <td>
                  <button className="btn btn-ghost danger" style={{ padding: '5px 10px', fontSize: 11 }} disabled={busy} onClick={() => apagarLote(l)}>
                    Apagar lote
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
