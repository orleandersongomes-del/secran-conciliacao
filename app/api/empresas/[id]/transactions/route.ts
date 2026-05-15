import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireEmpresaAccess } from '@/lib/auth';

export const runtime = 'nodejs';

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
