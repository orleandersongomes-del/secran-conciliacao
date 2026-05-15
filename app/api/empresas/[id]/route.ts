import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireEmpresaAccess } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    const empresa = await prisma.empresa.findUnique({
      where: { id: params.id },
      include: {
        consultores: { include: { user: { select: { id: true, name: true, email: true, cargo: true } } } },
        _count: { select: { transactions: true, plano: true, regras: true } },
      },
    });
    return NextResponse.json({ empresa });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    const empresa = await requireEmpresaAccess(params.id, me.id);
    if (empresa.ownerId !== me.id && !me.isAdmin) {
      return NextResponse.json({ error: 'Apenas o dono ou admin pode editar' }, { status: 403 });
    }
    const { nome, fantasia, cnpj, consultorIds } = await req.json();
    const updated = await prisma.$transaction(async (tx) => {
      const e = await tx.empresa.update({
        where: { id: params.id },
        data: {
          ...(nome ? { nome: String(nome).trim() } : {}),
          ...(fantasia !== undefined ? { fantasia: fantasia ? String(fantasia).trim() : null } : {}),
          ...(cnpj !== undefined ? { cnpj: cnpj ? String(cnpj).trim() : null } : {}),
        },
      });
      if (Array.isArray(consultorIds)) {
        await tx.empresaConsultor.deleteMany({ where: { empresaId: params.id } });
        if (consultorIds.length) {
          await tx.empresaConsultor.createMany({
            data: consultorIds.map((userId: string) => ({ empresaId: params.id, userId })),
            skipDuplicates: true,
          });
        }
      }
      return e;
    });
    return NextResponse.json({ empresa: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    const empresa = await requireEmpresaAccess(params.id, me.id);
    if (empresa.ownerId !== me.id && !me.isAdmin) {
      return NextResponse.json({ error: 'Apenas o dono ou admin pode excluir' }, { status: 403 });
    }
    await prisma.empresa.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
