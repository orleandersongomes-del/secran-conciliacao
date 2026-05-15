import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-only-insecure-secret-change-in-production'
);
const COOKIE_NAME = 'secran_token';
const TOKEN_EXP = '30d';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXP)
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      isAdmin: Boolean(payload.isAdmin),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser) {
  const token = await signSession(user);
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

/**
 * Garante que o usuário tem acesso à empresa (owner ou consultor vinculado).
 * Retorna a empresa se OK, lança erro se não.
 */
export async function requireEmpresaAccess(empresaId: string, userId: string) {
  const empresa = await prisma.empresa.findFirst({
    where: {
      id: empresaId,
      OR: [
        { ownerId: userId },
        { consultores: { some: { userId } } },
      ],
    },
  });
  if (!empresa) throw new Error('FORBIDDEN');
  return empresa;
}
