import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireEmpresaAccess } from '@/lib/auth';

export const runtime = 'nodejs';

// DELETE: remove transações por fonte, por dia de import, por ids, ou tudo.
// Query: ?source=recebidas|pagas|ofx  ?day=YYYY-MM-DD  ?ids=a,b,c  ?all=true
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    const url = new URL(req.url);
    const source = url.searchParams.get('source');
    const day = url.searchParams.get('day'); // dia de createdAt (UTC)
    const ids = url.searchParams.get('ids');
    const all = url.searchParams.get('all') === 'true';
    const where: any = { empresaId: params.id };
    if (ids) where.id = { in: ids.split(',') };
    if (source && source !== 'all') where.source = source;
    if (day) {
      const start = new Date(day + 'T00:00:00.000Z');
      const end = new Date(day + 'T23:59:59.999Z');
      where.createdAt = { gte: start, lte: end };
    }
    if (!all && !ids && !source && !day) {
      return NextResponse.json({ error: 'Informe ao menos um filtro: source, day, ids ou all=true' }, { status: 400 });
    }
    const result = await prisma.transaction.deleteMany({ where });
    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (err: any) {
    const status = err.message === 'UNAUTHORIZED' ? 401 : err.message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    const url = new URL(req.url);
    const status = url.searchParams.get('status') || undefined;
    const source = url.searchParams.get('source') || undefined;
    const q = url.searchParams.get('q')?.trim().toLowerCase();
    const where: any = { empresaId: params.id };
    if (status && status !== 'all') where.status = status;
    if (source && source !== 'all') where.source = source;
    if (q) {
      where.OR = [
        { descricao: { contains: q, mode: 'insensitive' } },
        { fornecedor: { contains: q, mode: 'insensitive' } },
        { categoriaOriginal: { contains: q, mode: 'insensitive' } },
      ];
    }
    const transactions = await prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, take: 1000 });
    return NextResponse.json({ transactions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
