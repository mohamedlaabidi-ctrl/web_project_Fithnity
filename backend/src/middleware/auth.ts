import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is required to start the backend');
  }
  return secret;
}

const jwtSecret = getJwtSecret();

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload !== 'object' || typeof payload.sub !== 'string') {
      throw new Error('Invalid token payload');
    }
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function createToken(userId: string): string {
  return jwt.sign({}, jwtSecret, { subject: userId, expiresIn: '7d' });
}
