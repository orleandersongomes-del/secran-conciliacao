import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser, hashPassword } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireUser();
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        cargo: true,
        telefone: true,
        isAdmin: true,
        createdAt: true,
        empresasMembro: { select: { empresaId: true, empresa: { select: { nome: true, fantasia: true } } } },
      },
    });
    return NextResponse.json({ consultores: users });
  } catch (err: any) {
    const status = err.message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireUser();
    if (!me.isAdmin) return NextResponse.json({ error: 'Apenas admin pode cadastrar consultores' }, { status: 403 });
    const { email, password, name, cargo, telefone } = await req.json();
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Campos obrigatórios: email, password, name' }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Senha mínima 6 caracteres' }, { status: 400 });
    }
    const emailNorm = String(email).toLowerCase().trim();
    if (await prisma.user.findUnique({ where: { email: emailNorm } })) {
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
    }
    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        passwordHash: await hashPassword(password),
        name: String(name).trim(),
        cargo: cargo ? String(cargo).trim() : null,
        telefone: telefone ? String(telefone).trim() : null,
      },
      select: { id: true, email: true, name: true, cargo: true, telefone: true, isAdmin: true },
    });
    return NextResponse.json({ consultor: user });
  } catch (err: any) {
    const status = err.message === 'UNAUTHORIZED' ? 401 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
