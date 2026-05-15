import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setSessionCookie, verifyPassword } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (!user) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    await setSessionCookie({ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin });
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Falha no login' }, { status: 500 });
  }
}
