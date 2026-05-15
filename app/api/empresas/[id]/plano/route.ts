import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, requireEmpresaAccess } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    const plano = await prisma.chartAccount.findMany({ where: { empresaId: params.id }, orderBy: { createdAt: 'asc' } });
    return NextResponse.json({ plano });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: substituir TODO o plano (usado no import xlsx)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    const { plano, mode } = await req.json();
    if (!Array.isArray(plano)) return NextResponse.json({ error: 'plano deve ser array' }, { status: 400 });

    const created = await prisma.$transaction(async (tx) => {
      if (mode === 'replace') {
        await tx.chartAccount.deleteMany({ where: { empresaId: params.id } });
      }
      if (!plano.length) return [];
      await tx.chartAccount.createMany({
        data: plano.map((p: any) => ({
          empresaId: params.id,
          grupo: String(p.grupo || ''),
          categoria: String(p.categoria || ''),
          subgrupo: p.subgrupo ? String(p.subgrupo) : null,
          nivel1: p.nivel1 ? String(p.nivel1) : null,
          chaveKey: p.key !== undefined ? String(p.key) : null,
          tipo: String(p.tipo || 'Saída'),
        })),
      });
      return tx.chartAccount.findMany({ where: { empresaId: params.id }, orderBy: { createdAt: 'asc' } });
    });
    return NextResponse.json({ plano: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: adicionar 1 nova entrada
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireUser();
    await requireEmpresaAccess(params.id, me.id);
    const p = await req.json();
    const created = await prisma.chartAccount.create({
      data: {
        empresaId: params.id,
        grupo: String(p.grupo || ''),
        categoria: String(p.categoria || 'Nova categoria'),
        subgrupo: p.subgrupo ? String(p.subgrupo) : null,
        nivel1: p.nivel1 ? String(p.nivel1) : null,
        chaveKey: p.key !== undefined ? String(p.key) : null,
        tipo: String(p.tipo || 'Saída'),
      },
    });
    return NextResponse.json({ entry: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
