import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireEmpresaAccess } from '@/lib/auth';

export const runtime = 'nodejs';

// Aprova ou rejeita várias transações de uma vez
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    const { ids, action } = await req.json();
    if (!Array.isArray(ids) || !ids.length) {
      return NextResponse.json({ error: 'ids vazios' }, { status: 400 });
    }
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action deve ser approve ou reject' }, { status: 400 });
    }
    if (action === 'approve') {
      // só aprova quem tem categoria
      const result = await prisma.transaction.updateMany({
        where: { id: { in: ids }, empresaId: params.id, sugCategoria: { not: null } },
        data: { status: 'approved', approvedById: me.id, approvedAt: new Date() },
      });
      return NextResponse.json({ approved: result.count, skipped: ids.length - result.count });
    } else {
      const result = await prisma.transaction.updateMany({
        where: { id: { in: ids }, empresaId: params.id },
        data: { status: 'rejected' },
      });
      return NextResponse.json({ rejected: result.count });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
