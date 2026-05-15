import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireEmpresaAccess } from '@/lib/auth';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { id: string; txId: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    const body = await req.json();
    const data: any = {};
    if (body.sugCategoria !== undefined) data.sugCategoria = body.sugCategoria || null;
    if (body.sugFornecedor !== undefined) data.sugFornecedor = body.sugFornecedor || null;
    if (body.sugCentro !== undefined) data.sugCentro = body.sugCentro || null;
    if (body.sugTipo !== undefined) data.sugTipo = body.sugTipo || null;
    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === 'approved') {
        data.approvedById = me.id;
        data.approvedAt = new Date();
      } else if (body.status === 'pending') {
        data.approvedById = null;
        data.approvedAt = null;
      }
    }
    const tx = await prisma.transaction.update({ where: { id: params.txId }, data });
    return NextResponse.json({ tx });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
