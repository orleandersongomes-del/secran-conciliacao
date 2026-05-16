'use client';
import { useEffect, useMemo, useState } from 'react';
import { useEmpresaAtiva } from '@/lib/useEmpresaAtiva';
import { toast } from '@/components/Toast';
import { useRefreshListener } from '@/lib/refresh';
import * as XLSX from 'xlsx';

type Tx = {
  id: string; data: string | null; sugTipo: string | null; sugFornecedor: string | null;
  fornecedor: string | null; descricao: string | null; sugCategoria: string | null;
  sugCentro: string | null; valor: number; source: string; banco: string | null;
};

function fmtMoney(v: number) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

function parseDate(d: string | null): Date | null {
  if (!d) return null;
  const m = String(d).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

export default function HistoricoPage() {
  const empresaId = useEmpresaAtiva();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [empresaNome, setEmpresaNome] = useState('');

  // filtros
  const [busca, setBusca] = useState('');
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const [categoria, setCategoria] = useState('all');
  const [fonte, setFonte] = useState('all');
  const [tipo, setTipo] = useState('all');
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');

  async function reload() {
    if (!empresaId) return;
    const [t, e] = await Promise.all([
      fetch(`/api/empresas/${empresaId}/transactions?status=approved`).then((r) => r.json()),
      fetch(`/api/empresas/${empresaId}`).then((r) => r.json()),
    ]);
    setTxs(t.transactions || []);
    setEmpresaNome(e.empresa?.fantasia || e.empresa?.nome || '');
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [empresaId]);
  useRefreshListener(['transactions', 'dados', 'all'], reload);

  // categorias únicas dos lançamentos aprovados
  const categoriasDisponiveis = useMemo(() => {
    const s = new Set<string>();
    for (const t of txs) if (t.sugCategoria) s.add(t.sugCategoria);
    return [...s].sort();
  }, [txs]);

  const filtrados = useMemo(() => {
    const de = dataDe ? new Date(dataDe + 'T00:00:00') : null;
    const ate = dataAte ? new Date(dataAte + 'T23:59:59') : null;
    const q = busca.toLowerCase().trim();
    const min = valorMin ? Number(valorMin) : null;
    const max = valorMax ? Number(valorMax) : null;
    return txs.filter((t) => {
      if (categoria !== 'all' && t.sugCategoria !== categoria) return false;
      if (fonte !== 'all' && t.source !== fonte) return false;
      if (tipo !== 'all' && t.sugTipo !== tipo) return false;
      if (de || ate) {
        const d = parseDate(t.data);
        if (!d) return false;
        if (de && d < de) return false;
        if (ate && d > ate) return false;
      }
      if (q) {
        const hay = `${t.descricao || ''} ${t.fornecedor || ''} ${t.sugFornecedor || ''} ${t.sugCategoria || ''} ${t.sugCentro || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const abs = Math.abs(t.valor);
      if (min !== null && abs < min) return false;
      if (max !== null && abs > max) return false;
      return true;
    });
  }, [txs, busca, dataDe, dataAte, categoria, fonte, tipo, valorMin, valorMax]);

  const totalFiltrado = useMemo(() => filtrados.reduce((s, t) => s + t.valor, 0), [filtrados]);

  function limpar() {
    setBusca(''); setDataDe(''); setDataAte(''); setCategoria('all'); setFonte('all'); setTipo('all'); setValorMin(''); setValorMax('');
  }

  function exportXlsx() {
    if (!filtrados.length) return toast('Nada para exportar', 'error');
    const tipoMap: any = { recebimento: 'Recebimento', pagamento: 'Pagamento', transferencia: 'Transferência' };
    const rows = filtrados.map((t) => ({
      Empresa: empresaNome,
      Data: t.data || '',
      Tipo: tipoMap[t.sugTipo || ''] || '',
      Fornecedor: t.sugFornecedor || t.fornecedor || '',
      Descricao: t.descricao || '',
      Categoria: t.sugCategoria || '',
      'Centro de Custo': t.sugCentro || '',
      Valor: t.valor,
      Banco: t.banco || '',
      Fonte: t.source,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Conciliados');
    const safe = empresaNome.replace(/[^a-z0-9]+/gi, '_').toLowerCase() || 'empresa';
    XLSX.writeFile(wb, `conciliados_${safe}.xlsx`);
    toast(`${filtrados.length} lançamentos exportados`, 'success');
  }

  if (!empresaId) return <div className="empty"><div className="empty-icon">▦</div>Selecione uma empresa.</div>;

  return (
    <>
      <div className="row-between">
        <div>
          <h2>Histórico <span className="tag-pill">{empresaNome}</span></h2>
          <p className="muted">Lançamentos validados. Filtre por qualquer combinação e exporte.</p>
        </div>
        <div className="row-gap">
          <button className="btn btn-ghost" onClick={limpar}>Limpar filtros</button>
          <button className="btn btn-secondary" onClick={exportXlsx}>Exportar filtrados</button>
        </div>
      </div>

      <div className="filtros-historico">
        <label>
          <span>Busca</span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Descrição, fornecedor, categoria…" />
        </label>
        <label>
          <span>De</span>
          <input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
        </label>
        <label>
          <span>Até</span>
          <input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
        </label>
        <label>
          <span>Categoria</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="all">Todas</option>
            {categoriasDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          <span>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="all">Todos</option>
            <option value="recebimento">Recebimento</option>
            <option value="pagamento">Pagamento</option>
            <option value="transferencia">Transferência</option>
          </select>
        </label>
        <label>
          <span>Fonte</span>
          <select value={fonte} onChange={(e) => setFonte(e.target.value)}>
            <option value="all">Todas</option>
            <option value="recebidas">Recebidas</option>
            <option value="pagas">Pagas</option>
            <option value="ofx">OFX</option>
          </select>
        </label>
        <label>
          <span>Valor mín.</span>
          <input type="number" value={valorMin} onChange={(e) => setValorMin(e.target.value)} placeholder="0" />
        </label>
        <label>
          <span>Valor máx.</span>
          <input type="number" value={valorMax} onChange={(e) => setValorMax(e.target.value)} placeholder="—" />
        </label>
      </div>

      <div className="row-between" style={{ marginBottom: 10 }}>
        <span className="muted"><strong>{filtrados.length}</strong> de {txs.length} lançamentos · Soma: <strong className={totalFiltrado >= 0 ? 'pos' : 'neg'} style={{ color: totalFiltrado >= 0 ? 'var(--green-500)' : 'var(--rose-500)' }}>{fmtMoney(totalFiltrado)}</strong></span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Data</th><th>Tipo</th><th>Fornecedor</th><th>Descrição</th><th>Categoria</th><th>Centro de Custo</th><th className="num">Valor</th><th>Fonte</th></tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-600)' }}>Nenhum lançamento com esses filtros.</td></tr>}
            {filtrados.map((t) => (
              <tr key={t.id}>
                <td>{t.data}</td>
                <td>{({ recebimento: 'Recebimento', pagamento: 'Pagamento', transferencia: 'Transferência' } as any)[t.sugTipo || ''] || '—'}</td>
                <td>{t.sugFornecedor || t.fornecedor || '—'}</td>
                <td>{t.descricao}</td>
                <td>{t.sugCategoria}</td>
                <td>{t.sugCentro || '—'}</td>
                <td className={`num ${t.valor >= 0 ? 'pos' : 'neg'}`}>{fmtMoney(t.valor)}</td>
                <td><span className="tag-pill">{t.source}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
