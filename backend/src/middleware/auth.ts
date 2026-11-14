import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifyAccessToken } from '../lib/authTokens.js';

function bearerToken(req: Request): string | null {
  const header = req.header('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, emailVerifiedAt: true, isSuspended: true },
    });

    if (!user || user.isSuspended) {
      res.status(403).json({ message: 'Account is suspended or unavailable' });
      return;
    }

    req.userId = user.id;
    req.userRole = user.role;
    req.userVerified = Boolean(user.emailVerifiedAt);
    req.userSuspended = user.isSuspended;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireVerified(req: Request, res: Response, next: NextFunction): void {
  if (!req.userVerified) {
    res.status(403).json({ message: 'Please verify your email before performing this action' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.userRole !== 'ADMIN') {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  next();
}
