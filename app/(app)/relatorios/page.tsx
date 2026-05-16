'use client';
import { useEffect, useState, Fragment } from 'react';
import { useEmpresaAtiva } from '@/lib/useEmpresaAtiva';
import { useRefreshListener } from '@/lib/refresh';

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
type Comparativo = { periodos: Report['periodo'][]; reports: Report[] };

const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function fmt(v: number): string { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtPct(v: number): string { return (Number(v) || 0).toFixed(2) + '%'; }
function av(valor: number, base: number): string { if (!base) return '—'; return ((valor / base) * 100).toFixed(1) + '%'; }
function ah(atual: number, anterior: number): { txt: string; dir: 'up' | 'down' | null } { if (!anterior) return { txt: '—', dir: null }; const v = ((atual - anterior) / Math.abs(anterior)) * 100; return { txt: (v >= 0 ? '+' : '') + v.toFixed(1) + '%', dir: v >= 0 ? 'up' : 'down' }; }

// =================== Linha DRE com toggle "+" inline =====================

function ToggleBtn({ open, onClick, disabled }: { open: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button className={`dre-toggle${open ? ' aberto' : ''}`} disabled={disabled} onClick={onClick} aria-label={open ? 'Fechar' : 'Detalhar'}>
      {open ? '−' : '+'}
    </button>
  );
}

function CategoriasInline({ categorias }: { categorias: Bucket['categorias'] }) {
  if (!categorias.length) return null;
  return (
    <tr className="cat-detail-row">
      <td colSpan={2}>
        <div className="cat-detail-inner">
          <table>
            <tbody>
              {categorias.map((c, i) => (
                <tr key={i}><td>{c.categoria} <span style={{ color: 'var(--gray-600)', fontSize: 11 }}>({c.count}x)</span></td><td className="num">{fmt(c.valor)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

function LinhaDRE({
  label, valor, bucket, level = 0, isTotal, isSubtotal, sign, openKey, openSet, toggle,
}: {
  label: string; valor: number; bucket?: Bucket; level?: number; isTotal?: boolean; isSubtotal?: boolean; sign?: '+' | '-' | '=';
  openKey: string; openSet: Set<string>; toggle: (k: string) => void;
}) {
  const cls = isTotal ? 'total' : isSubtotal ? 'subtotal' : level === 0 ? 'grupo' : 'linha';
  const numCls = valor >= 0 ? 'pos' : 'neg';
  const prefix = sign ? `(${sign}) ` : '';
  const hasCat = !!bucket && bucket.categorias.length > 0;
  const isOpen = openSet.has(openKey);
  return (
    <Fragment>
      <tr className={cls}>
        <td style={{ paddingLeft: level * 18 + 10 }}>
          {hasCat ? <ToggleBtn open={isOpen} onClick={() => toggle(openKey)} disabled={false} /> : <span style={{ display: 'inline-block', width: 26 }} />}
          {prefix}{label}
        </td>
        <td className={`num ${numCls}`}>{fmt(valor)}</td>
      </tr>
      {hasCat && isOpen && <CategoriasInline categorias={bucket!.categorias} />}
    </Fragment>
  );
}

// =================== Página =====================

export default function RelatoriosPage() {
  const empresaId = useEmpresaAtiva();
  const now = new Date();
  const [tipo, setTipo] = useState<'ano' | 'mes' | 'custom' | 'anos' | 'meses'>('ano');
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [inicio, setInicio] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
  const [fim, setFim] = useState(new Date().toISOString().slice(0, 10));
  const [anosComparar, setAnosComparar] = useState(`${now.getFullYear() - 2},${now.getFullYear() - 1},${now.getFullYear()}`);
  const [report, setReport] = useState<Report | null>(null);
  const [comparativo, setComparativo] = useState<Comparativo | null>(null);
  const [empresaNome, setEmpresaNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [totalAprovadas, setTotalAprovadas] = useState(0);
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());

  function toggle(k: string) {
    setOpenSet((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }

  async function reload() {
    if (!empresaId) return;
    setLoading(true);
    const params = new URLSearchParams({ tipo, ano: String(ano), mes: String(mes) });
    if (tipo === 'custom') { params.set('inicio', inicio); params.set('fim', fim); }
    if (tipo === 'anos') params.set('anos', anosComparar);
    const [r, e, tx] = await Promise.all([
      fetch(`/api/empresas/${empresaId}/relatorios?${params}`).then((x) => x.json()),
      fetch(`/api/empresas/${empresaId}`).then((x) => x.json()),
      fetch(`/api/empresas/${empresaId}/transactions?status=approved`).then((x) => x.json()),
    ]);
    setReport(r.report || null);
    setComparativo(r.comparativo || null);
    setEmpresaNome(e.empresa?.fantasia || e.empresa?.nome || '');
    setTotalAprovadas(tx.transactions?.length || 0);
    setLoading(false);
  }
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [empresaId, tipo, ano, mes, inicio, fim, anosComparar]);
  useRefreshListener(['transactions', 'plano', 'dados', 'all'], reload);

  if (!empresaId) return <div className="empty"><div className="empty-icon">▦</div>Selecione uma empresa.</div>;

  const anos = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);
  const modoComp = tipo === 'anos' || tipo === 'meses';

  return (
    <>
      <div className="row-between">
        <div>
          <h2>Relatórios <span className="tag-pill">{empresaNome}</span></h2>
          <p className="muted">DRE, DFC e indicadores. Use modo "Comparar anos" pra ver Análise Vertical e Horizontal.</p>
        </div>
      </div>

      <div className="period-filter">
        <label>Modo
          <select value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
            <option value="ano">Anual</option>
            <option value="mes">Mensal</option>
            <option value="custom">Personalizado</option>
            <option value="anos">Comparar anos (AV/AH)</option>
          </select>
        </label>
        {tipo === 'mes' && (
          <>
            <label>Mês <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>{meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></label>
            <label>Ano <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>{anos.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
          </>
        )}
        {tipo === 'ano' && <label>Ano <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>{anos.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>}
        {tipo === 'custom' && (
          <>
            <label>De <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
            <label>Até <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
          </>
        )}
        {tipo === 'anos' && (
          <label style={{ minWidth: 240 }}>
            Anos (separados por vírgula)
            <input value={anosComparar} onChange={(e) => setAnosComparar(e.target.value)} placeholder="2024,2025,2026" />
          </label>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gray-600)' }}>{loading ? 'Calculando…' : modoComp ? `${comparativo?.periodos.length || 0} períodos` : report?.periodo?.label}</span>
      </div>

      {/* === MODO SIMPLES === */}
      {!modoComp && report && (
        <>
          {report.indicadores.quantidadeTransacoes === 0 && totalAprovadas > 0 && (
            <div className="empty-banner" style={{ marginBottom: 16 }}>
              <h3>Não há transações neste período</h3>
              <p>{totalAprovadas} aprovadas existem, mas nenhuma cai em <strong>{report.periodo.label}</strong>. Mude o filtro.</p>
            </div>
          )}
          {report.indicadores.quantidadeTransacoes === 0 && totalAprovadas === 0 && (
            <div className="empty-banner" style={{ marginBottom: 16 }}>
              <h3>Ainda não há conciliações aprovadas</h3>
              <p>Importe e concilie no Painel e Conciliar pra ver os números aqui.</p>
            </div>
          )}

          {/* KPIs */}
          <div className="kpi-grid">
            <div className={`kpi-card ${report.indicadores.lucroLiquido >= 0 ? 'pos' : 'neg'}`}><div className="kpi-card-label">Lucro Líquido</div><div className={`kpi-card-value ${report.indicadores.lucroLiquido >= 0 ? 'pos' : 'neg'}`}>{fmt(report.indicadores.lucroLiquido)}</div><div className="kpi-card-sub">Margem: {fmtPct(report.indicadores.margemLiquida)}</div></div>
            <div className="kpi-card"><div className="kpi-card-label">Receita Total</div><div className="kpi-card-value">{fmt(report.indicadores.receitaTotal)}</div><div className="kpi-card-sub">Ticket médio: {fmt(report.indicadores.ticketMedio)}</div></div>
            <div className="kpi-card neg"><div className="kpi-card-label">Despesas + Custos</div><div className="kpi-card-value neg">{fmt(report.indicadores.despesaTotal + report.indicadores.custoTotal)}</div><div className="kpi-card-sub">Custo: {fmt(report.indicadores.custoTotal)}</div></div>
            <div className={`kpi-card ${report.indicadores.saldoCaixa >= 0 ? 'pos' : 'neg'}`}><div className="kpi-card-label">Saldo de Caixa</div><div className={`kpi-card-value ${report.indicadores.saldoCaixa >= 0 ? 'pos' : 'neg'}`}>{fmt(report.indicadores.saldoCaixa)}</div><div className="kpi-card-sub">{report.indicadores.quantidadeTransacoes} transações</div></div>
            <div className="kpi-card"><div className="kpi-card-label">Margem Bruta</div><div className="kpi-card-value">{fmtPct(report.indicadores.margemBruta)}</div><div className="kpi-card-sub">(Receita Líq. − Custos) / Receita Líq.</div></div>
            <div className="kpi-card"><div className="kpi-card-label">Margem EBITDA</div><div className="kpi-card-value">{fmtPct(report.indicadores.margemEbitda)}</div><div className="kpi-card-sub">EBITDA / Receita Líq.</div></div>
            <div className="kpi-card"><div className="kpi-card-label">Burn Rate (mensal)</div><div className="kpi-card-value neg">{fmt(report.indicadores.burnRateMensal)}</div><div className="kpi-card-sub">Despesa operacional média</div></div>
            <div className="kpi-card"><div className="kpi-card-label">Runway</div><div className="kpi-card-value">{report.indicadores.runwayMeses !== null ? `${report.indicadores.runwayMeses} meses` : '—'}</div><div className="kpi-card-sub">Saldo / burn rate</div></div>
          </div>

          {/* DRE */}
          <div className="report-section">
            <h3>Demonstração do Resultado do Exercício (DRE)</h3>
            <table className="report-table">
              <tbody>
                <LinhaDRE openKey="rb" {...{ openSet, toggle }} label="Receita Bruta" valor={report.dre.receitaBruta.total} bucket={report.dre.receitaBruta} sign="+" />
                <LinhaDRE openKey="or" {...{ openSet, toggle }} label="Outras Receitas Operacionais" valor={report.dre.outrasReceitas.total} bucket={report.dre.outrasReceitas} sign="+" />
                <LinhaDRE openKey="de" {...{ openSet, toggle }} label="Deduções" valor={-report.dre.deducoes.total} bucket={report.dre.deducoes} sign="-" />
                <LinhaDRE openKey="im" {...{ openSet, toggle }} label="Impostos sobre Receita" valor={-report.dre.impostosSobreReceita.total} bucket={report.dre.impostosSobreReceita} sign="-" />
                <LinhaDRE openKey="rl" {...{ openSet, toggle }} label="(=) Receita Líquida" valor={report.dre.receitaLiquida} isSubtotal />
                <LinhaDRE openKey="cu" {...{ openSet, toggle }} label="Custos da Operação" valor={-report.dre.custos.total} bucket={report.dre.custos} sign="-" />
                <LinhaDRE openKey="lb" {...{ openSet, toggle }} label="(=) Lucro Bruto" valor={report.dre.lucroBruto} isSubtotal />
                <tr className="grupo"><td>(−) Despesas Operacionais</td><td className="num neg">{fmt(-report.dre.despesasOperacionais.total)}</td></tr>
                {report.dre.despesasOperacionais.pessoal.total > 0 && <LinhaDRE openKey="dp" {...{ openSet, toggle }} label="Pessoal" valor={-report.dre.despesasOperacionais.pessoal.total} bucket={report.dre.despesasOperacionais.pessoal} level={1} />}
                {report.dre.despesasOperacionais.administrativas.total > 0 && <LinhaDRE openKey="da" {...{ openSet, toggle }} label="Administrativas" valor={-report.dre.despesasOperacionais.administrativas.total} bucket={report.dre.despesasOperacionais.administrativas} level={1} />}
                {report.dre.despesasOperacionais.comerciais.total > 0 && <LinhaDRE openKey="dc" {...{ openSet, toggle }} label="Comerciais" valor={-report.dre.despesasOperacionais.comerciais.total} bucket={report.dre.despesasOperacionais.comerciais} level={1} />}
                {report.dre.despesasOperacionais.marketing.total > 0 && <LinhaDRE openKey="dm" {...{ openSet, toggle }} label="Marketing" valor={-report.dre.despesasOperacionais.marketing.total} bucket={report.dre.despesasOperacionais.marketing} level={1} />}
                {report.dre.despesasOperacionais.ocupacao.total > 0 && <LinhaDRE openKey="do" {...{ openSet, toggle }} label="Ocupação" valor={-report.dre.despesasOperacionais.ocupacao.total} bucket={report.dre.despesasOperacionais.ocupacao} level={1} />}
                {report.dre.despesasOperacionais.diretoria.total > 0 && <LinhaDRE openKey="dd" {...{ openSet, toggle }} label="Diretoria" valor={-report.dre.despesasOperacionais.diretoria.total} bucket={report.dre.despesasOperacionais.diretoria} level={1} />}
                <LinhaDRE openKey="eb" {...{ openSet, toggle }} label="(=) EBITDA" valor={report.dre.ebitda} isSubtotal />
                <LinhaDRE openKey="rfr" {...{ openSet, toggle }} label="(+) Result. Financeiro - Receitas" valor={report.dre.resultadoFinanceiro.receitas.total} bucket={report.dre.resultadoFinanceiro.receitas} />
                <LinhaDRE openKey="rfd" {...{ openSet, toggle }} label="(−) Result. Financeiro - Despesas" valor={-report.dre.resultadoFinanceiro.despesas.total} bucket={report.dre.resultadoFinanceiro.despesas} />
                <LinhaDRE openKey="ll" {...{ openSet, toggle }} label="(=) Lucro Líquido do Período" valor={report.dre.lucroLiquido} isTotal />
              </tbody>
            </table>
          </div>

          {/* DFC */}
          <div className="report-section">
            <h3>Demonstração do Fluxo de Caixa (DFC)</h3>
            <table className="report-table">
              <tbody>
                <tr className="grupo"><td>Atividades Operacionais</td><td></td></tr>
                <LinhaDRE openKey="op-e" {...{ openSet, toggle }} label="Entradas operacionais" valor={report.dfc.operacional.entradas.total} bucket={report.dfc.operacional.entradas} level={1} />
                <LinhaDRE openKey="op-s" {...{ openSet, toggle }} label="Saídas operacionais" valor={-report.dfc.operacional.saidas.total} bucket={report.dfc.operacional.saidas} level={1} />
                <LinhaDRE openKey="op-t" {...{ openSet, toggle }} label="(=) Caixa das operações" valor={report.dfc.operacional.total} isSubtotal />
                <tr className="grupo"><td>Atividades de Investimento</td><td></td></tr>
                <LinhaDRE openKey="inv" {...{ openSet, toggle }} label="Aquisições / CAPEX" valor={-report.dfc.investimento.saidas.total} bucket={report.dfc.investimento.saidas} level={1} />
                <LinhaDRE openKey="inv-t" {...{ openSet, toggle }} label="(=) Caixa de investimento" valor={report.dfc.investimento.total} isSubtotal />
                <tr className="grupo"><td>Atividades de Financiamento</td><td></td></tr>
                <LinhaDRE openKey="fin-e" {...{ openSet, toggle }} label="Entradas" valor={report.dfc.financiamento.entradas.total} bucket={report.dfc.financiamento.entradas} level={1} />
                <LinhaDRE openKey="fin-s" {...{ openSet, toggle }} label="Saídas" valor={-report.dfc.financiamento.saidas.total} bucket={report.dfc.financiamento.saidas} level={1} />
                <LinhaDRE openKey="fin-t" {...{ openSet, toggle }} label="(=) Caixa de financiamento" valor={report.dfc.financiamento.total} isSubtotal />
                <LinhaDRE openKey="vl" {...{ openSet, toggle }} label="(=) Variação Líquida de Caixa" valor={report.dfc.variacaoLiquidaCaixa} isTotal />
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* === MODO COMPARATIVO === */}
      {modoComp && comparativo && comparativo.reports.length > 0 && (
        <DRESpread comparativo={comparativo} />
      )}
    </>
  );
}

// =================== DRE Comparativo =====================

function DRESpread({ comparativo }: { comparativo: Comparativo }) {
  // Linhas a renderizar
  const linhas: { label: string; pick: (r: Report) => number; sign?: string; bold?: boolean; indent?: number }[] = [
    { label: 'Receita Bruta', pick: (r) => r.dre.receitaBruta.total, sign: '+' },
    { label: 'Outras Receitas Operacionais', pick: (r) => r.dre.outrasReceitas.total, sign: '+' },
    { label: 'Deduções', pick: (r) => -r.dre.deducoes.total, sign: '-' },
    { label: 'Impostos sobre Receita', pick: (r) => -r.dre.impostosSobreReceita.total, sign: '-' },
    { label: '(=) Receita Líquida', pick: (r) => r.dre.receitaLiquida, bold: true },
    { label: 'Custos da Operação', pick: (r) => -r.dre.custos.total, sign: '-' },
    { label: '(=) Lucro Bruto', pick: (r) => r.dre.lucroBruto, bold: true },
    { label: 'Pessoal', pick: (r) => -r.dre.despesasOperacionais.pessoal.total, sign: '-', indent: 1 },
    { label: 'Administrativas', pick: (r) => -r.dre.despesasOperacionais.administrativas.total, sign: '-', indent: 1 },
    { label: 'Comerciais', pick: (r) => -r.dre.despesasOperacionais.comerciais.total, sign: '-', indent: 1 },
    { label: 'Marketing', pick: (r) => -r.dre.despesasOperacionais.marketing.total, sign: '-', indent: 1 },
    { label: 'Ocupação', pick: (r) => -r.dre.despesasOperacionais.ocupacao.total, sign: '-', indent: 1 },
    { label: 'Diretoria', pick: (r) => -r.dre.despesasOperacionais.diretoria.total, sign: '-', indent: 1 },
    { label: '(=) EBITDA', pick: (r) => r.dre.ebitda, bold: true },
    { label: '(+/−) Resultado Financeiro', pick: (r) => r.dre.resultadoFinanceiro.total },
    { label: '(=) Lucro Líquido', pick: (r) => r.dre.lucroLiquido, bold: true },
  ];

  return (
    <div className="report-section">
      <h3>DRE Comparativa · {comparativo.periodos.length} períodos</h3>
      <p className="muted" style={{ marginBottom: 12 }}>
        <strong>AV</strong> (Análise Vertical) = % sobre a Receita Líquida do mesmo período · <strong>AH</strong> (Análise Horizontal) = variação % vs período anterior
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table className="report-table comparativo">
          <thead>
            <tr>
              <th>Conta</th>
              {comparativo.reports.map((r, i) => (
                <Fragment key={i}>
                  <th>{r.periodo.label}</th>
                  <th className="av">AV</th>
                  {i > 0 && <th className="ah">AH</th>}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className={l.bold ? 'total' : 'linha'}>
                <td style={{ paddingLeft: (l.indent || 0) * 18 + 10 }}>{l.sign ? `(${l.sign}) ` : ''}{l.label}</td>
                {comparativo.reports.map((r, j) => {
                  const v = l.pick(r);
                  const base = r.dre.receitaLiquida;
                  const a = j > 0 ? ah(v, linhas[i].pick(comparativo.reports[j - 1])) : null;
                  return (
                    <Fragment key={j}>
                      <td className={`num ${v >= 0 ? 'pos' : 'neg'}`}>{fmt(v)}</td>
                      <td className="av">{av(v, base)}</td>
                      {j > 0 && <td className={`ah ${a?.dir || ''}`}>{a?.txt}</td>}
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
