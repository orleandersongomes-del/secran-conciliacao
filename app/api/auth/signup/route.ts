import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { email, password, name, cargo, telefone } = await req.json();
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Campos obrigatórios: email, password, name' }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'Senha precisa ter no mínimo 6 caracteres' }, { status: 400 });
    }
    const emailNorm = String(email).toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) {
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
    }
    const userCount = await prisma.user.count();
    const isFirst = userCount === 0;
    // 1º usuário: admin auto-aprovado. Demais: ficam pendentes até admin aprovar.
    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        passwordHash: await hashPassword(password),
        name: String(name).trim(),
        cargo: cargo ? String(cargo).trim() : null,
        telefone: telefone ? String(telefone).trim() : null,
        isAdmin: isFirst,
        isApproved: isFirst,
      },
    });
    if (isFirst) {
      await setSessionCookie({ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin });
      return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } });
    }
    return NextResponse.json({
      ok: true,
      pending: true,
      message: 'Cadastro recebido. Aguardando aprovação do administrador para liberar o acesso.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Falha no cadastro' }, { status: 500 });
  }
}
