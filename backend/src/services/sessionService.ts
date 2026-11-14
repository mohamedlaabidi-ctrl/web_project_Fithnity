import { Prisma, PrismaClient, User } from '@prisma/client';
import {
  createAccessToken,
  createOpaqueToken,
  refreshTokenExpiry,
  tokenHash,
} from '../lib/authTokens.js';

export interface SessionIssueInput {
  user: User;
  rememberMe: boolean;
  userAgent?: string;
  ipAddress?: string;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  expiresAt: Date;
}

function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    bio: user.bio,
    avatarPath: user.avatarPath,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
    isSuspended: user.isSuspended,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function toPublicUser(user: User) {
  return publicUser(user);
}

export async function issueSession(prisma: PrismaClient | Prisma.TransactionClient, input: SessionIssueInput): Promise<IssuedSession> {
  const refreshToken = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const expiresAt = refreshTokenExpiry(input.rememberMe);

  await prisma.refreshToken.create({
    data: {
      userId: input.user.id,
      tokenHash: tokenHash(refreshToken),
      csrfTokenHash: tokenHash(csrfToken),
      expiresAt,
      rememberMe: input.rememberMe,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    },
  });

  const accessToken = createAccessToken({
    sub: input.user.id,
    role: input.user.role,
    verified: Boolean(input.user.emailVerifiedAt),
  });

  return { accessToken, refreshToken, csrfToken, expiresAt };
}

export async function rotateSession(
  prisma: PrismaClient | Prisma.TransactionClient,
  currentRefreshToken: string,
  csrfToken: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{ session: IssuedSession; user: User } | null> {
  const currentHash = tokenHash(currentRefreshToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: currentHash },
    include: { user: true },
  });

  if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) {
    return null;
  }

  if (existing.csrfTokenHash !== tokenHash(csrfToken)) {
    return null;
  }

  if (existing.user.isSuspended) {
    return null;
  }

  const nextRefreshToken = createOpaqueToken();
  const nextCsrfToken = createOpaqueToken();
  const expiresAt = refreshTokenExpiry(existing.rememberMe);

  await prisma.$transaction(async (tx) => {
    const next = await tx.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: tokenHash(nextRefreshToken),
        csrfTokenHash: tokenHash(nextCsrfToken),
        expiresAt,
        rememberMe: existing.rememberMe,
        userAgent,
        ipAddress,
      },
    });

    await tx.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedByTokenId: next.id },
    });
  });

  const accessToken = createAccessToken({
    sub: existing.user.id,
    role: existing.user.role,
    verified: Boolean(existing.user.emailVerifiedAt),
  });

  return {
    user: existing.user,
    session: {
      accessToken,
      refreshToken: nextRefreshToken,
      csrfToken: nextCsrfToken,
      expiresAt,
    },
  };
}

export async function revokeSession(prisma: PrismaClient | Prisma.TransactionClient, refreshToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: tokenHash(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(prisma: PrismaClient | Prisma.TransactionClient, userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export { publicUser };
