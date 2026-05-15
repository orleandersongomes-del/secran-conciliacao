import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const me = await requireUser();
    // empresas que o user é dono OU consultor vinculado
    const empresas = await prisma.empresa.findMany({
      where: {
        OR: [
          { ownerId: me.id },
          { consultores: { some: { userId: me.id } } },
        ],
      },
      include: {
        consultores: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { transactions: true, plano: true, regras: true } },
      },
      orderBy: { nome: 'asc' },
    });
    return NextResponse.json({ empresas });
  } catch (err: any) {
    const status = err.message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireUser();
    const { nome, fantasia, cnpj, consultorIds } = await req.json();
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
    const empresa = await prisma.empresa.create({
      data: {
        nome: String(nome).trim(),
        fantasia: fantasia ? String(fantasia).trim() : null,
        cnpj: cnpj ? String(cnpj).trim() : null,
        ownerId: me.id,
        consultores: {
          create: (Array.isArray(consultorIds) ? consultorIds : []).map((userId: string) => ({ userId })),
        },
      },
    });
    return NextResponse.json({ empresa });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
