import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireEmpresaAccess } from '@/lib/auth';
import { buildComparativo, buildReport, periodoCustom, periodoDoAno, periodoDoMes, type Periodo } from '@/lib/reports';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    const url = new URL(req.url);
    const tipo = url.searchParams.get('tipo') || 'mes'; // 'mes' | 'ano' | 'custom' | 'anos'
    const ano = Number(url.searchParams.get('ano')) || new Date().getFullYear();
    const mes = Number(url.searchParams.get('mes')) || new Date().getMonth() + 1;

    const [transactions, plano] = await Promise.all([
      prisma.transaction.findMany({ where: { empresaId: params.id, status: 'approved' } }),
      prisma.chartAccount.findMany({ where: { empresaId: params.id } }),
    ]);

    // MODO COMPARATIVO: tipo=anos&anos=2024,2025,2026
    if (tipo === 'anos') {
      const lista = (url.searchParams.get('anos') || '').split(',').map((x) => Number(x.trim())).filter(Boolean);
      const periodos: Periodo[] = (lista.length ? lista : [ano - 2, ano - 1, ano]).map((a) => periodoDoAno(a));
      const comparativo = buildComparativo(transactions, plano, periodos);
      return NextResponse.json({ comparativo });
    }

    // MODO COMPARATIVO MENSAL: tipo=meses&ano=2026&meses=1,2,3,4
    if (tipo === 'meses') {
      const lista = (url.searchParams.get('meses') || '').split(',').map((x) => Number(x.trim())).filter(Boolean);
      const periodos: Periodo[] = (lista.length ? lista : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).map((m) => periodoDoMes(ano, m));
      const comparativo = buildComparativo(transactions, plano, periodos);
      return NextResponse.json({ comparativo });
    }

    let periodo;
    if (tipo === 'ano') periodo = periodoDoAno(ano);
    else if (tipo === 'custom') {
      const inicio = new Date(url.searchParams.get('inicio') || `${ano}-01-01`);
      const fim = new Date(url.searchParams.get('fim') || `${ano}-12-31`);
      periodo = periodoCustom(inicio, fim);
    } else periodo = periodoDoMes(ano, mes);

    const report = buildReport(transactions, plano, periodo);
    return NextResponse.json({ report });
  } catch (err: any) {
    const status = err.message === 'UNAUTHORIZED' ? 401 : err.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
