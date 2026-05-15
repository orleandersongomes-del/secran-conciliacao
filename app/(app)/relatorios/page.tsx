'use client';
import { useEffect, useState } from 'react';
import { useEmpresaAtiva } from '@/lib/useEmpresaAtiva';

type Bucket = { total: number; categorias: { categoria: string; valor: number; count: number }[] };

type Report = {
  periodo: { inicio: string; fim: string; label: string };
  dre: {
    receitaBruta: Bucket; outrasReceitas: Bucket; deducoes: Bucket; impostosSobreReceita: Bucket;
    receitaLiquida: number; custos: Bucket; lucroBruto: number;
    despesasOperacionais: { pessoal: Bucket; administrativas: Bucket; comerciais: Bucket; marketing: Bucket; ocupacao: Bucket; diretoria: Bucket; total: number };
    ebitda: number;
    resultadoFinanceiro: { receitas: Bucket; despesas: Bucket; total: number };
    lucroLiquido: number;
    outros: Bucket;
  };
  dfc: {
    operacional: { entradas: Bucket; saidas: Bucket; total: number };
    investimento: { saidas: Bucket; total: number };
    financiamento: { entradas: Bucket; saidas: Bucket; total: number };
    variacaoLiquidaCaixa: number;
  };
  indicadores: {
    receitaTotal: number; custoTotal: number; despesaTotal: number; lucroLiquido: number;
    margemBruta: number; margemOperacional: number; margemEbitda: number; margemLiquida: number;
    ticketMedio: number; totalRecebimentos: number; totalPagamentos: number; saldoCaixa: number;
    quantidadeTransacoes: number; burnRateMensal: number; runwayMeses: number | null;
  };
};

const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function fmt(v: number): string {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtPct(v: number): string {
  return (Number(v) || 0).toFixed(2) + '%';
}

function CategoriasDetail({ categorias }: { categorias: Bucket['categorias'] }) {
  if (!categorias.length) return null;
  return (
    <details className="expandable">
      <summary>Detalhar categorias ({categorias.length})</summary>
      <table className="report-table" style={{ marginTop: 6 }}>
        <tbody>
          {categorias.map((c, i) => (
            <tr key={i} className="linha">
              <td className="indent deeper">{c.categoria}</td>
              <td className="num">{fmt(c.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function LinhaDRE({ label, valor, bucket, level = 0, isTotal, isSubtotal, sign }: { label: string; valor: number; bucket?: Bucket; level?: number; isTotal?: boolean; isSubtotal?: boolean; sign?: '+' | '-' | '=' }) {
  const cls = isTotal ? 'total' : isSubtotal ? 'subtotal' : level === 0 ? 'grupo' : 'linha';
  const numCls = valor >= 0 ? 'pos' : 'neg';
  const prefix = sign ? `(${sign}) ` : '';
  return (
    <>
      <tr className={cls}>
        <td style={{ paddingLeft: level * 18 + 10 }}>{prefix}{label}</td>
        <td className={`num ${numCls}`}>{fmt(valor)}</td>
      </tr>
      {bucket && bucket.categorias.length > 0 && (
        <tr>
          <td colSpan={2} style={{ paddingLeft: level * 18 + 24, paddingTop: 0, paddingBottom: 0 }}>
            <CategoriasDetail categorias={bucket.categorias} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function RelatoriosPage() {
  const empresaId = useEmpresaAtiva();
  const now = new Date();
  const [tipo, setTipo] = useState<'mes' | 'ano' | 'custom'>('mes');
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [inicio, setInicio] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [fim, setFim] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<Report | null>(null);
  const [empresaNome, setEmpresaNome] = useState('');
  const [loading, setLoading] = useState(false);

  async function reload() {
    if (!empresaId) return;
    setLoading(true);
    const params = new URLSearchParams({ tipo, ano: String(ano), mes: String(mes) });
    if (tipo === 'custom') {
      params.set('inicio', inicio);
      params.set('fim', fim);
    }
    const [r, e] = await Promise.all([
      fetch(`/api/empresas/${empresaId}/relatorios?${params}`).then((x) => x.json()),
      fetch(`/api/empresas/${empresaId}`).then((x) => x.json()),
    ]);
    setReport(r.report);
    setEmpresaNome(e.empresa?.fantasia || e.empresa?.nome || '');
    setLoading(false);
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [empresaId, tipo, ano, mes, inicio, fim]);

  if (!empresaId) return <div className="empty"><div className="empty-icon">▦</div>Selecione uma empresa.</div>;

  const anos = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  return (
    <>
      <div className="row-between">
        <div>
          <h2>Relatórios <span className="tag-pill">{empresaNome}</span></h2>
          <p className="muted">DRE, DFC e indicadores financeiros calculados a partir das conciliações aprovadas.</p>
        </div>
      </div>

      <div className="period-filter">
        <label>Período <select value={tipo} onChange={(e) => setTipo(e.target.value as any)}><option value="mes">Mensal</option><option value="ano">Anual</option><option value="custom">Personalizado</option></select></label>
        {tipo === 'mes' && (
          <>
            <label>Mês <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>{meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></label>
            <label>Ano <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>{anos.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
          </>
        )}
        {tipo === 'ano' && (
          <label>Ano <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>{anos.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
        )}
        {tipo === 'custom' && (
          <>
            <label>De <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
            <label>Até <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
          </>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gray-600)' }}>{loading ? 'Calculando…' : report?.periodo?.label}</span>
      </div>

      {!report && <div className="empty"><div className="empty-icon">⟳</div>Carregando…</div>}
      {report && (
        <>
          {/* === INDICADORES === */}
          <div className="kpi-grid">
            <div className={`kpi-card ${report.indicadores.lucroLiquido >= 0 ? 'pos' : 'neg'}`}>
              <div className="kpi-card-label">Lucro Líquido</div>
              <div className={`kpi-card-value ${report.indicadores.lucroLiquido >= 0 ? 'pos' : 'neg'}`}>{fmt(report.indicadores.lucroLiquido)}</div>
              <div className="kpi-card-sub">Margem: {fmtPct(report.indicadores.margemLiquida)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-label">Receita Total</div>
              <div className="kpi-card-value">{fmt(report.indicadores.receitaTotal)}</div>
              <div className="kpi-card-sub">Ticket médio: {fmt(report.indicadores.ticketMedio)}</div>
            </div>
            <div className="kpi-card neg">
              <div className="kpi-card-label">Despesas + Custos</div>
              <div className="kpi-card-value neg">{fmt(report.indicadores.despesaTotal + report.indicadores.custoTotal)}</div>
              <div className="kpi-card-sub">Custo: {fmt(report.indicadores.custoTotal)}</div>
            </div>
            <div className={`kpi-card ${report.indicadores.saldoCaixa >= 0 ? 'pos' : 'neg'}`}>
              <div className="kpi-card-label">Saldo de Caixa</div>
              <div className={`kpi-card-value ${report.indicadores.saldoCaixa >= 0 ? 'pos' : 'neg'}`}>{fmt(report.indicadores.saldoCaixa)}</div>
              <div className="kpi-card-sub">{report.indicadores.quantidadeTransacoes} transações</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-card-label">Margem Bruta</div>
              <div className="kpi-card-value">{fmtPct(report.indicadores.margemBruta)}</div>
              <div className="kpi-card-sub">(Receita Líq. − Custos) / Receita Líq.</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-label">Margem EBITDA</div>
              <div className="kpi-card-value">{fmtPct(report.indicadores.margemEbitda)}</div>
              <div className="kpi-card-sub">EBITDA / Receita Líq.</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-label">Burn Rate (mensal)</div>
              <div className="kpi-card-value neg">{fmt(report.indicadores.burnRateMensal)}</div>
              <div className="kpi-card-sub">Despesa operacional média</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-card-label">Runway</div>
              <div className="kpi-card-value">{report.indicadores.runwayMeses !== null ? `${report.indicadores.runwayMeses} meses` : '—'}</div>
              <div className="kpi-card-sub">Saldo / burn rate</div>
            </div>
          </div>

          {/* === DRE === */}
          <div className="report-section">
            <h3>Demonstração do Resultado do Exercício (DRE)</h3>
            <table className="report-table">
              <tbody>
                <LinhaDRE label="Receita Bruta" valor={report.dre.receitaBruta.total} bucket={report.dre.receitaBruta} sign="+" />
                <LinhaDRE label="Outras Receitas Operacionais" valor={report.dre.outrasReceitas.total} bucket={report.dre.outrasReceitas} sign="+" />
                <LinhaDRE label="Deduções (devoluções/cancelamentos)" valor={-report.dre.deducoes.total} bucket={report.dre.deducoes} sign="-" />
                <LinhaDRE label="Impostos sobre Receita" valor={-report.dre.impostosSobreReceita.total} bucket={report.dre.impostosSobreReceita} sign="-" />
                <LinhaDRE label="(=) Receita Líquida" valor={report.dre.receitaLiquida} isSubtotal />
                <LinhaDRE label="Custos da Operação" valor={-report.dre.custos.total} bucket={report.dre.custos} sign="-" />
                <LinhaDRE label="(=) Lucro Bruto" valor={report.dre.lucroBruto} isSubtotal />
                <tr className="grupo"><td>(−) Despesas Operacionais</td><td className="num neg">{fmt(-report.dre.despesasOperacionais.total)}</td></tr>
                {report.dre.despesasOperacionais.pessoal.total > 0 && <LinhaDRE label="Pessoal" valor={-report.dre.despesasOperacionais.pessoal.total} bucket={report.dre.despesasOperacionais.pessoal} level={1} />}
                {report.dre.despesasOperacionais.administrativas.total > 0 && <LinhaDRE label="Administrativas" valor={-report.dre.despesasOperacionais.administrativas.total} bucket={report.dre.despesasOperacionais.administrativas} level={1} />}
                {report.dre.despesasOperacionais.comerciais.total > 0 && <LinhaDRE label="Comerciais" valor={-report.dre.despesasOperacionais.comerciais.total} bucket={report.dre.despesasOperacionais.comerciais} level={1} />}
                {report.dre.despesasOperacionais.marketing.total > 0 && <LinhaDRE label="Marketing" valor={-report.dre.despesasOperacionais.marketing.total} bucket={report.dre.despesasOperacionais.marketing} level={1} />}
                {report.dre.despesasOperacionais.ocupacao.total > 0 && <LinhaDRE label="Ocupação" valor={-report.dre.despesasOperacionais.ocupacao.total} bucket={report.dre.despesasOperacionais.ocupacao} level={1} />}
                {report.dre.despesasOperacionais.diretoria.total > 0 && <LinhaDRE label="Diretoria" valor={-report.dre.despesasOperacionais.diretoria.total} bucket={report.dre.despesasOperacionais.diretoria} level={1} />}
                <LinhaDRE label="(=) EBITDA" valor={report.dre.ebitda} isSubtotal />
                <LinhaDRE label="(+) Resultado Financeiro (receitas)" valor={report.dre.resultadoFinanceiro.receitas.total} bucket={report.dre.resultadoFinanceiro.receitas} />
                <LinhaDRE label="(−) Resultado Financeiro (despesas)" valor={-report.dre.resultadoFinanceiro.despesas.total} bucket={report.dre.resultadoFinanceiro.despesas} />
                <LinhaDRE label="(=) Lucro Líquido do Período" valor={report.dre.lucroLiquido} isTotal />
              </tbody>
            </table>
          </div>

          {/* === DFC === */}
          <div className="report-section">
            <h3>Demonstração do Fluxo de Caixa (DFC)</h3>
            <table className="report-table">
              <tbody>
                <tr className="grupo"><td>Atividades Operacionais</td><td></td></tr>
                <LinhaDRE label="Entradas operacionais" valor={report.dfc.operacional.entradas.total} bucket={report.dfc.operacional.entradas} level={1} />
                <LinhaDRE label="Saídas operacionais" valor={-report.dfc.operacional.saidas.total} bucket={report.dfc.operacional.saidas} level={1} />
                <LinhaDRE label="(=) Caixa das operações" valor={report.dfc.operacional.total} isSubtotal />
                <tr className="grupo"><td>Atividades de Investimento</td><td></td></tr>
                <LinhaDRE label="Aquisições / CAPEX" valor={-report.dfc.investimento.saidas.total} bucket={report.dfc.investimento.saidas} level={1} />
                <LinhaDRE label="(=) Caixa de investimento" valor={report.dfc.investimento.total} isSubtotal />
                <tr className="grupo"><td>Atividades de Financiamento</td><td></td></tr>
                <LinhaDRE label="Entradas (aportes, captações, repasses)" valor={report.dfc.financiamento.entradas.total} bucket={report.dfc.financiamento.entradas} level={1} />
                <LinhaDRE label="Saídas (amortizações, distribuição)" valor={-report.dfc.financiamento.saidas.total} bucket={report.dfc.financiamento.saidas} level={1} />
                <LinhaDRE label="(=) Caixa de financiamento" valor={report.dfc.financiamento.total} isSubtotal />
                <LinhaDRE label="(=) Variação Líquida de Caixa" valor={report.dfc.variacaoLiquidaCaixa} isTotal />
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
