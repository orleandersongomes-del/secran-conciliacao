import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, hashPassword } from '@/lib/auth';

export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    if (!me.isAdmin && me.id !== params.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    const body = await req.json();
    const data: any = {};
    if (body.name) data.name = String(body.name).trim();
    if (body.cargo !== undefined) data.cargo = body.cargo ? String(body.cargo).trim() : null;
    if (body.telefone !== undefined) data.telefone = body.telefone ? String(body.telefone).trim() : null;
    if (body.password) {
      if (String(body.password).length < 6) {
        return NextResponse.json({ error: 'Senha mínima 6 caracteres' }, { status: 400 });
      }
      data.passwordHash = await hashPassword(body.password);
    }
    // só admin pode aprovar/revogar e dar/tirar admin
    if (body.isApproved !== undefined) {
      if (!me.isAdmin) return NextResponse.json({ error: 'Apenas admin pode aprovar contas' }, { status: 403 });
      data.isApproved = Boolean(body.isApproved);
    }
    if (body.isAdmin !== undefined) {
      if (!me.isAdmin) return NextResponse.json({ error: 'Apenas admin pode alterar permissão' }, { status: 403 });
      data.isAdmin = Boolean(body.isAdmin);
    }
    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, email: true, name: true, cargo: true, telefone: true, isAdmin: true, isApproved: true },
    });
    return NextResponse.json({ consultor: user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    if (!me.isAdmin) return NextResponse.json({ error: 'Apenas admin' }, { status: 403 });
    if (me.id === params.id) return NextResponse.json({ error: 'Não pode se autoexcluir' }, { status: 400 });
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
