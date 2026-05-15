/**
 * Geração de DRE, DFC e indicadores financeiros a partir das transações aprovadas.
 *
 * Estratégia:
 * - Cada categoria do plano tem um `nivel1` agregador (ex.: "(-) Custo da Operação", "(+) Receitas operacionais").
 * - Classificamos cada nivel1 em "bucket DRE" e "bucket DFC" via heurística por palavra-chave.
 * - Somamos os valores absolutos das transações aprovadas dentro do período.
 * - Indicadores calculados a partir das somas.
 */
import type { Transaction, ChartAccount } from '@prisma/client';

export type Periodo = {
  inicio: Date; // inclusivo
  fim: Date; // inclusivo
  label: string; // ex.: "Abril/2026"
};

export type DREBucket =
  | 'receita_bruta'
  | 'outras_receitas'
  | 'deducoes'
  | 'impostos_sobre_receita'
  | 'custos'
  | 'despesas_pessoal'
  | 'despesas_administrativas'
  | 'despesas_comerciais'
  | 'despesas_ocupacao'
  | 'despesas_diretoria'
  | 'despesas_marketing'
  | 'resultado_financeiro_receita'
  | 'resultado_financeiro_despesa'
  | 'outros';

export type DFCBucket = 'operacional_entrada' | 'operacional_saida' | 'investimento' | 'financiamento_entrada' | 'financiamento_saida';

type CategoriaLinha = { categoria: string; valor: number; count: number };
type BucketAgg = { total: number; categorias: CategoriaLinha[] };

export type DREResult = {
  receitaBruta: BucketAgg;
  outrasReceitas: BucketAgg;
  deducoes: BucketAgg; // devoluções
  impostosSobreReceita: BucketAgg;
  receitaLiquida: number;
  custos: BucketAgg;
  lucroBruto: number;
  despesasOperacionais: {
    pessoal: BucketAgg;
    administrativas: BucketAgg;
    comerciais: BucketAgg;
    marketing: BucketAgg;
    ocupacao: BucketAgg;
    diretoria: BucketAgg;
    total: number;
  };
  ebitda: number;
  resultadoFinanceiro: {
    receitas: BucketAgg;
    despesas: BucketAgg;
    total: number; // receitas - despesas
  };
  lucroLiquido: number;
  outros: BucketAgg;
};

export type DFCResult = {
  operacional: {
    entradas: BucketAgg;
    saidas: BucketAgg;
    total: number;
  };
  investimento: {
    saidas: BucketAgg;
    total: number;
  };
  financiamento: {
    entradas: BucketAgg;
    saidas: BucketAgg;
    total: number;
  };
  variacaoLiquidaCaixa: number;
};

export type Indicadores = {
  receitaTotal: number;
  custoTotal: number;
  despesaTotal: number;
  lucroLiquido: number;
  margemBruta: number; // %
  margemOperacional: number; // %
  margemEbitda: number; // %
  margemLiquida: number; // %
  ticketMedio: number; // R$ / transacao de receita
  totalRecebimentos: number;
  totalPagamentos: number;
  saldoCaixa: number;
  quantidadeTransacoes: number;
  burnRateMensal: number; // despesa operacional média
  runwayMeses: number | null; // null se burn rate <= 0 ou caixa <= 0
};

export type ReportResult = {
  periodo: Periodo;
  dre: DREResult;
  dfc: DFCResult;
  indicadores: Indicadores;
};

// =========== Helpers ===========

function emptyBucket(): BucketAgg {
  return { total: 0, categorias: [] };
}

function pct(num: number, den: number): number {
  if (!den) return 0;
  return Math.round(((num / den) * 100) * 100) / 100;
}

function parseTxDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const m = String(d).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1]);
}

function classify(nivel1: string | null | undefined): { dre: DREBucket; dfc: DFCBucket } {
  const u = String(nivel1 || '').toLowerCase();

  // DFC primeiro (mais específico)
  let dfc: DFCBucket = 'operacional_saida'; // default

  // DRE
  let dre: DREBucket = 'outros';

  if (u.includes('outras receitas operacionais') || u.includes('outras receitas')) {
    dre = 'outras_receitas';
    dfc = 'operacional_entrada';
  } else if (u.includes('receita') && !u.includes('financeir')) {
    dre = 'receita_bruta';
    dfc = 'operacional_entrada';
  } else if (u.includes('devoluç') || u.includes('cancelament')) {
    dre = 'deducoes';
    dfc = 'operacional_saida';
  } else if (u.includes('custo') || u.includes('serviço prestado')) {
    dre = 'custos';
    dfc = 'operacional_saida';
  } else if (u.includes('pessoal')) {
    dre = 'despesas_pessoal';
    dfc = 'operacional_saida';
  } else if (u.includes('administr')) {
    dre = 'despesas_administrativas';
    dfc = 'operacional_saida';
  } else if (u.includes('marketing')) {
    dre = 'despesas_marketing';
    dfc = 'operacional_saida';
  } else if (u.includes('comerc') || u.includes('vendas') || u.includes('comiss')) {
    dre = 'despesas_comerciais';
    dfc = 'operacional_saida';
  } else if (u.includes('ocupaç')) {
    dre = 'despesas_ocupacao';
    dfc = 'operacional_saida';
  } else if (u.includes('diretoria')) {
    dre = 'despesas_diretoria';
    dfc = 'operacional_saida';
  } else if (u.includes('imposto')) {
    dre = 'impostos_sobre_receita';
    dfc = 'operacional_saida';
  } else if (u.includes('resultado financeir')) {
    // recebida (+) ou paga (-/-, -)
    if (u.startsWith('(+)')) {
      dre = 'resultado_financeiro_receita';
      dfc = 'operacional_entrada';
    } else {
      dre = 'resultado_financeiro_despesa';
      dfc = 'operacional_saida';
    }
  } else if (u.includes('investimento')) {
    dre = 'outros';
    dfc = 'investimento';
  } else if (
    u.includes('captaç') ||
    u.includes('amortiz') ||
    u.includes('aporte') ||
    u.includes('distribuiç') ||
    u.includes('repasses') ||
    u.includes('transfer')
  ) {
    dre = 'outros';
    dfc = u.startsWith('(+)') ? 'financiamento_entrada' : 'financiamento_saida';
  } else if (u.startsWith('(+)')) {
    dre = 'outras_receitas';
    dfc = 'operacional_entrada';
  }

  return { dre, dfc };
}

function addToBucket(bucket: BucketAgg, categoria: string, valor: number) {
  bucket.total += valor;
  const existente = bucket.categorias.find((c) => c.categoria === categoria);
  if (existente) {
    existente.valor += valor;
    existente.count++;
  } else {
    bucket.categorias.push({ categoria, valor, count: 1 });
  }
}

// =========== Função principal ===========

export function buildReport(
  transactions: Transaction[],
  plano: ChartAccount[],
  periodo: Periodo,
): ReportResult {
  const planoMap = new Map<string, ChartAccount>();
  for (const p of plano) planoMap.set(p.categoria, p);

  const dre: DREResult = {
    receitaBruta: emptyBucket(),
    outrasReceitas: emptyBucket(),
    deducoes: emptyBucket(),
    impostosSobreReceita: emptyBucket(),
    receitaLiquida: 0,
    custos: emptyBucket(),
    lucroBruto: 0,
    despesasOperacionais: {
      pessoal: emptyBucket(),
      administrativas: emptyBucket(),
      comerciais: emptyBucket(),
      marketing: emptyBucket(),
      ocupacao: emptyBucket(),
      diretoria: emptyBucket(),
      total: 0,
    },
    ebitda: 0,
    resultadoFinanceiro: { receitas: emptyBucket(), despesas: emptyBucket(), total: 0 },
    lucroLiquido: 0,
    outros: emptyBucket(),
  };

  const dfc: DFCResult = {
    operacional: { entradas: emptyBucket(), saidas: emptyBucket(), total: 0 },
    investimento: { saidas: emptyBucket(), total: 0 },
    financiamento: { entradas: emptyBucket(), saidas: emptyBucket(), total: 0 },
    variacaoLiquidaCaixa: 0,
  };

  let receitasCount = 0;
  let recebTotal = 0;
  let pagTotal = 0;

  for (const t of transactions) {
    if (t.status !== 'approved') continue;
    const d = parseTxDate(t.data);
    if (!d || d < periodo.inicio || d > periodo.fim) continue;

    const cat = t.sugCategoria;
    if (!cat) continue;
    const p = planoMap.get(cat);
    if (!p) continue;

    const { dre: dreBucket, dfc: dfcBucket } = classify(p.nivel1);
    const valor = Math.abs(Number(t.valor) || 0);

    // DRE
    if (dreBucket === 'receita_bruta') addToBucket(dre.receitaBruta, cat, valor);
    else if (dreBucket === 'outras_receitas') addToBucket(dre.outrasReceitas, cat, valor);
    else if (dreBucket === 'deducoes') addToBucket(dre.deducoes, cat, valor);
    else if (dreBucket === 'impostos_sobre_receita') addToBucket(dre.impostosSobreReceita, cat, valor);
    else if (dreBucket === 'custos') addToBucket(dre.custos, cat, valor);
    else if (dreBucket === 'despesas_pessoal') addToBucket(dre.despesasOperacionais.pessoal, cat, valor);
    else if (dreBucket === 'despesas_administrativas') addToBucket(dre.despesasOperacionais.administrativas, cat, valor);
    else if (dreBucket === 'despesas_comerciais') addToBucket(dre.despesasOperacionais.comerciais, cat, valor);
    else if (dreBucket === 'despesas_marketing') addToBucket(dre.despesasOperacionais.marketing, cat, valor);
    else if (dreBucket === 'despesas_ocupacao') addToBucket(dre.despesasOperacionais.ocupacao, cat, valor);
    else if (dreBucket === 'despesas_diretoria') addToBucket(dre.despesasOperacionais.diretoria, cat, valor);
    else if (dreBucket === 'resultado_financeiro_receita') addToBucket(dre.resultadoFinanceiro.receitas, cat, valor);
    else if (dreBucket === 'resultado_financeiro_despesa') addToBucket(dre.resultadoFinanceiro.despesas, cat, valor);
    else addToBucket(dre.outros, cat, valor);

    // DFC
    if (dfcBucket === 'operacional_entrada') addToBucket(dfc.operacional.entradas, cat, valor);
    else if (dfcBucket === 'operacional_saida') addToBucket(dfc.operacional.saidas, cat, valor);
    else if (dfcBucket === 'investimento') addToBucket(dfc.investimento.saidas, cat, valor);
    else if (dfcBucket === 'financiamento_entrada') addToBucket(dfc.financiamento.entradas, cat, valor);
    else if (dfcBucket === 'financiamento_saida') addToBucket(dfc.financiamento.saidas, cat, valor);

    if (dfcBucket === 'operacional_entrada' || dfcBucket === 'financiamento_entrada') {
      recebTotal += valor;
      if (dreBucket === 'receita_bruta' || dreBucket === 'outras_receitas') receitasCount++;
    } else {
      pagTotal += valor;
    }
  }

  // Cálculos derivados DRE
  const receitaTotalBruta = dre.receitaBruta.total + dre.outrasReceitas.total;
  dre.receitaLiquida = receitaTotalBruta - dre.deducoes.total - dre.impostosSobreReceita.total;
  dre.lucroBruto = dre.receitaLiquida - dre.custos.total;
  dre.despesasOperacionais.total =
    dre.despesasOperacionais.pessoal.total +
    dre.despesasOperacionais.administrativas.total +
    dre.despesasOperacionais.comerciais.total +
    dre.despesasOperacionais.marketing.total +
    dre.despesasOperacionais.ocupacao.total +
    dre.despesasOperacionais.diretoria.total;
  dre.ebitda = dre.lucroBruto - dre.despesasOperacionais.total;
  dre.resultadoFinanceiro.total = dre.resultadoFinanceiro.receitas.total - dre.resultadoFinanceiro.despesas.total;
  dre.lucroLiquido = dre.ebitda + dre.resultadoFinanceiro.total;

  // Cálculos derivados DFC
  dfc.operacional.total = dfc.operacional.entradas.total - dfc.operacional.saidas.total;
  dfc.investimento.total = -dfc.investimento.saidas.total;
  dfc.financiamento.total = dfc.financiamento.entradas.total - dfc.financiamento.saidas.total;
  dfc.variacaoLiquidaCaixa = dfc.operacional.total + dfc.investimento.total + dfc.financiamento.total;

  // Indicadores
  const meses = Math.max(1, Math.round((periodo.fim.getTime() - periodo.inicio.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  const burnRateMensal = dre.despesasOperacionais.total / meses;
  const saldoCaixa = recebTotal - pagTotal;
  const indicadores: Indicadores = {
    receitaTotal: receitaTotalBruta,
    custoTotal: dre.custos.total,
    despesaTotal: dre.despesasOperacionais.total + dre.impostosSobreReceita.total + dre.deducoes.total + dre.resultadoFinanceiro.despesas.total,
    lucroLiquido: dre.lucroLiquido,
    margemBruta: pct(dre.lucroBruto, dre.receitaLiquida),
    margemOperacional: pct(dre.ebitda, dre.receitaLiquida),
    margemEbitda: pct(dre.ebitda, dre.receitaLiquida),
    margemLiquida: pct(dre.lucroLiquido, dre.receitaLiquida),
    ticketMedio: receitasCount ? dre.receitaBruta.total / receitasCount : 0,
    totalRecebimentos: recebTotal,
    totalPagamentos: pagTotal,
    saldoCaixa,
    quantidadeTransacoes: transactions.filter((t) => {
      if (t.status !== 'approved') return false;
      const d = parseTxDate(t.data);
      return d && d >= periodo.inicio && d <= periodo.fim;
    }).length,
    burnRateMensal,
    runwayMeses: burnRateMensal > 0 && saldoCaixa > 0 ? Math.round((saldoCaixa / burnRateMensal) * 10) / 10 : null,
  };

  // Ordena categorias por valor desc dentro de cada bucket
  function sortBucket(b: BucketAgg) {
    b.categorias.sort((a, b) => b.valor - a.valor);
  }
  sortBucket(dre.receitaBruta);
  sortBucket(dre.outrasReceitas);
  sortBucket(dre.deducoes);
  sortBucket(dre.impostosSobreReceita);
  sortBucket(dre.custos);
  sortBucket(dre.despesasOperacionais.pessoal);
  sortBucket(dre.despesasOperacionais.administrativas);
  sortBucket(dre.despesasOperacionais.comerciais);
  sortBucket(dre.despesasOperacionais.marketing);
  sortBucket(dre.despesasOperacionais.ocupacao);
  sortBucket(dre.despesasOperacionais.diretoria);
  sortBucket(dre.resultadoFinanceiro.receitas);
  sortBucket(dre.resultadoFinanceiro.despesas);
  sortBucket(dre.outros);
  sortBucket(dfc.operacional.entradas);
  sortBucket(dfc.operacional.saidas);
  sortBucket(dfc.investimento.saidas);
  sortBucket(dfc.financiamento.entradas);
  sortBucket(dfc.financiamento.saidas);

  return { periodo, dre, dfc, indicadores };
}

export function periodoDoMes(ano: number, mes: number): Periodo {
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59, 999);
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return { inicio, fim, label: `${meses[mes - 1]}/${ano}` };
}

export function periodoDoAno(ano: number): Periodo {
  return { inicio: new Date(ano, 0, 1), fim: new Date(ano, 11, 31, 23, 59, 59, 999), label: `Ano ${ano}` };
}

export function periodoCustom(inicio: Date, fim: Date, label?: string): Periodo {
  return { inicio, fim, label: label || `${inicio.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')}` };
}
