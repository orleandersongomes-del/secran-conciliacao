import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireEmpresaAccess } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    const regras = await prisma.rule.findMany({ where: { empresaId: params.id }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ regras });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    const { field, keyword, categoria, tipo } = await req.json();
    if (!field || !keyword || !categoria) {
      return NextResponse.json({ error: 'field, keyword e categoria são obrigatórios' }, { status: 400 });
    }
    const regra = await prisma.rule.create({
      data: {
        empresaId: params.id,
        field: String(field),
        keyword: String(keyword).trim(),
        categoria: String(categoria),
        tipo: tipo ? String(tipo) : null,
      },
    });
    return NextResponse.json({ regra });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
