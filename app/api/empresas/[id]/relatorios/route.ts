import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireEmpresaAccess } from '@/lib/auth';
import { buildReport, periodoCustom, periodoDoAno, periodoDoMes } from '@/lib/reports';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    const url = new URL(req.url);
    const tipo = url.searchParams.get('tipo') || 'mes'; // 'mes' | 'ano' | 'custom'
    const ano = Number(url.searchParams.get('ano')) || new Date().getFullYear();
    const mes = Number(url.searchParams.get('mes')) || new Date().getMonth() + 1;

    let periodo;
    if (tipo === 'ano') periodo = periodoDoAno(ano);
    else if (tipo === 'custom') {
      const inicio = new Date(url.searchParams.get('inicio') || `${ano}-01-01`);
      const fim = new Date(url.searchParams.get('fim') || `${ano}-12-31`);
      periodo = periodoCustom(inicio, fim);
    } else periodo = periodoDoMes(ano, mes);

    const [transactions, plano] = await Promise.all([
      prisma.transaction.findMany({ where: { empresaId: params.id, status: 'approved' } }),
      prisma.chartAccount.findMany({ where: { empresaId: params.id } }),
    ]);

    const report = buildReport(transactions, plano, periodo);
    return NextResponse.json({ report });
  } catch (err: any) {
    const status = err.message === 'UNAUTHORIZED' ? 401 : err.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
