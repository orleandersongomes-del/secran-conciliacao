import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireEmpresaAccess } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * Lista os "lotes" de importação agrupados por (source, dia de createdAt).
 * Cada lote representa um upload feito pelo usuário no Painel.
 */
export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    // Pega todas as transações + createdAt
    const txs = await prisma.transaction.findMany({
      where: { empresaId: params.id },
      select: { id: true, source: true, status: true, valor: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    // Agrupa por (source + YYYY-MM-DD da createdAt em UTC)
    const groups = new Map<string, any>();
    for (const t of txs) {
      const day = t.createdAt.toISOString().slice(0, 10);
      const key = `${t.source}|${day}`;
      if (!groups.has(key)) {
        groups.set(key, {
          source: t.source,
          day,
          total: 0,
          totalValor: 0,
          aprovados: 0,
          pendentes: 0,
          rejeitados: 0,
          createdAt: t.createdAt,
        });
      }
      const g = groups.get(key);
      g.total++;
      g.totalValor += Math.abs(Number(t.valor) || 0);
      if (t.status === 'approved') g.aprovados++;
      else if (t.status === 'rejected') g.rejeitados++;
      else g.pendentes++;
    }
    const imports = Array.from(groups.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return NextResponse.json({ imports });
  } catch (err: any) {
    const status = err.message === 'UNAUTHORIZED' ? 401 : err.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
