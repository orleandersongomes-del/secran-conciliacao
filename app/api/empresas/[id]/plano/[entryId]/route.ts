import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireEmpresaAccess } from '@/lib/auth';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { id: string; entryId: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    const p = await req.json();
    const data: any = {};
    if (p.grupo !== undefined) data.grupo = String(p.grupo);
    if (p.categoria !== undefined) data.categoria = String(p.categoria);
    if (p.subgrupo !== undefined) data.subgrupo = p.subgrupo ? String(p.subgrupo) : null;
    if (p.nivel1 !== undefined) data.nivel1 = p.nivel1 ? String(p.nivel1) : null;
    if (p.key !== undefined) data.chaveKey = p.key ? String(p.key) : null;
    if (p.tipo !== undefined) data.tipo = String(p.tipo);
    const entry = await prisma.chartAccount.update({ where: { id: params.entryId }, data });
    return NextResponse.json({ entry });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string; entryId: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    await prisma.chartAccount.delete({ where: { id: params.entryId } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
