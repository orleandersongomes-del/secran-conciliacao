'use client';
import { useEffect, useState } from 'react';
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

export default function HistoricoPage() {
  const empresaId = useEmpresaAtiva();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [empresaNome, setEmpresaNome] = useState('');

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

  function exportXlsx() {
    if (!txs.length) return toast('Nada para exportar', 'error');
    const tipoMap: any = { recebimento: 'Recebimento', pagamento: 'Pagamento', transferencia: 'Transferência' };
    const rows = txs.map((t) => ({
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
    toast('Arquivo exportado', 'success');
  }

  if (!empresaId) return <div className="empty"><div className="empty-icon">▦</div>Selecione uma empresa.</div>;

  return (
    <>
      <div className="row-between">
        <div>
          <h2>Histórico <span className="tag-pill">{empresaNome}</span></h2>
          <p className="muted">Lançamentos validados. Exporte quando quiser.</p>
        </div>
        <button className="btn btn-ghost" onClick={exportXlsx}>Exportar .xlsx</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Data</th><th>Tipo</th><th>Fornecedor</th><th>Descrição</th><th>Categoria</th><th>Centro de Custo</th><th className="num">Valor</th><th>Status</th></tr></thead>
          <tbody>
            {txs.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--gray-600)' }}>Ainda não há conciliações aprovadas.</td></tr>}
            {txs.map((t) => (
              <tr key={t.id}>
                <td>{t.data}</td>
                <td>{({ recebimento: 'Recebimento', pagamento: 'Pagamento', transferencia: 'Transferência' } as any)[t.sugTipo || ''] || '—'}</td>
                <td>{t.sugFornecedor || t.fornecedor || '—'}</td>
                <td>{t.descricao}</td>
                <td>{t.sugCategoria}</td>
                <td>{t.sugCentro || '—'}</td>
                <td className={`num ${t.valor >= 0 ? 'pos' : 'neg'}`}>{fmtMoney(t.valor)}</td>
                <td><span className="tag-pill success">aprovado</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
