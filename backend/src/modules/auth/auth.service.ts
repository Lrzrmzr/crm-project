import crypto from 'crypto';
import prisma from '../../config/postgres';
import { hashPassword, verifyPassword } from '../../utils/hash.utils';
import { signAccessToken } from '../../utils/jwt.utils';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function register(name: string, email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('EMAIL_TAKEN');

  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: { name, email, passwordHash },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw new Error('INVALID_CREDENTIALS');

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new Error('INVALID_CREDENTIALS');

  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });

  const rawToken = crypto.randomBytes(40).toString('hex');
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  return {
    accessToken,
    refreshToken: rawToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

export async function refresh(rawToken: string) {
  const stored = await prisma.refreshToken.findFirst({
    where: {
      tokenHash: hashToken(rawToken),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!stored || !stored.user.isActive) throw new Error('INVALID_TOKEN');

  return {
    accessToken: signAccessToken({
      sub: stored.user.id,
      email: stored.user.email,
      role: stored.user.role,
    }),
  };
}

export async function logout(rawToken: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}