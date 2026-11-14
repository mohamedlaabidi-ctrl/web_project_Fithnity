import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import {
  createOpaqueToken,
  passwordResetTokenExpiry,
  passwordStrongEnough,
  tokenHash,
  verificationTokenExpiry,
} from '../lib/authTokens.js';
import { clearAuthCookies, parseCookies, setAuthCookies } from '../lib/cookies.js';
import { sendEmail } from '../lib/mailer.js';
import { requireAuth } from '../middleware/auth.js';
import { issueSession, revokeSession, rotateSession, toPublicUser } from '../services/sessionService.js';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmNewPassword: z.string().min(8).max(128),
});

async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = createOpaqueToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: tokenHash(rawToken),
      expiresAt: verificationTokenExpiry(),
    },
  });

  const url = `${frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
  await sendEmail(email, 'Verify your Thniyti account', `Verify your email by visiting: ${url}`);
}

async function sendPasswordResetEmail(userId: string, email: string): Promise<void> {
  await prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  const rawToken = createOpaqueToken();
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: tokenHash(rawToken),
      expiresAt: passwordResetTokenExpiry(),
    },
  });

  const url = `${frontendUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  await sendEmail(email, 'Reset your Thniyti password', `Reset your password by visiting: ${url}`);
}

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Please provide valid registration data', errors: parsed.error.flatten() });
    return;
  }

  const { name, email, password, confirmPassword } = parsed.data;
  const phone = parsed.data.phone || null;

  if (password !== confirmPassword) {
    res.status(400).json({ message: 'Password confirmation does not match' });
    return;
  }

  if (!passwordStrongEnough(password)) {
    res.status(400).json({
      message: 'Password must include uppercase, lowercase, number, and special character',
    });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ message: 'An account with this email already exists' });
    return;
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  await sendVerificationEmail(user.id, user.email);
  res.status(201).json({ message: 'Account created. Please verify your email before publishing or booking rides.' });
});

router.post('/verify-email/request', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  if (user.emailVerifiedAt) {
    res.json({ message: 'Email is already verified' });
    return;
  }
  await sendVerificationEmail(user.id, user.email);
  res.json({ message: 'Verification email sent' });
});

router.post('/verify-email', async (req, res) => {
  const tokenSchema = z.object({ token: z.string().min(20) });
  const parsed = tokenSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid verification token' });
    return;
  }

  const tokenRecord = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: tokenHash(parsed.data.token) },
    include: { user: true },
  });

  if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt <= new Date()) {
    res.status(400).json({ message: 'Verification token is invalid or expired' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.update({ where: { id: tokenRecord.id }, data: { usedAt: new Date() } });
    await tx.user.update({ where: { id: tokenRecord.userId }, data: { emailVerifiedAt: new Date() } });
  });

  res.json({ message: 'Email verified successfully' });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'A valid email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  if (user.isSuspended) {
    res.status(403).json({ message: 'Your account is suspended' });
    return;
  }

  const session = await issueSession(prisma, {
    user,
    rememberMe: parsed.data.rememberMe,
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });

  setAuthCookies(res, session.refreshToken, session.csrfToken, session.expiresAt, isProduction);

  res.json({
    accessToken: session.accessToken,
    csrfToken: session.csrfToken,
    user: toPublicUser(user),
    accessTokenExpiresInMs: 15 * 60 * 1000,
  });
});

router.post('/refresh', async (req, res) => {
  const cookies = parseCookies(req);
  const refreshToken = cookies.thniyti_refresh;
  const csrfCookie = cookies.thniyti_csrf;
  const csrfHeader = req.header('x-csrf-token');

  if (!refreshToken || !csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    clearAuthCookies(res, isProduction);
    res.status(401).json({ message: 'Session expired. Please log in again.' });
    return;
  }

  const rotated = await rotateSession(prisma, refreshToken, csrfHeader, req.headers['user-agent'], req.ip);
  if (!rotated) {
    clearAuthCookies(res, isProduction);
    res.status(401).json({ message: 'Session expired. Please log in again.' });
    return;
  }

  setAuthCookies(res, rotated.session.refreshToken, rotated.session.csrfToken, rotated.session.expiresAt, isProduction);

  res.json({
    accessToken: rotated.session.accessToken,
    csrfToken: rotated.session.csrfToken,
    user: toPublicUser(rotated.user),
    accessTokenExpiresInMs: 15 * 60 * 1000,
  });
});

router.post('/logout', async (req, res) => {
  const cookies = parseCookies(req);
  if (cookies.thniyti_refresh) {
    await revokeSession(prisma, cookies.thniyti_refresh);
  }
  clearAuthCookies(res, isProduction);
  res.status(204).send();
});

router.post('/forgot-password', async (req, res) => {
  const schema = z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Valid email is required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user && !user.isSuspended) {
    await sendPasswordResetEmail(user.id, user.email);
  }

  res.json({ message: 'If that email exists, a password reset link has been sent.' });
});

router.post('/reset-password', async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid reset payload', errors: parsed.error.flatten() });
    return;
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    res.status(400).json({ message: 'Password confirmation does not match' });
    return;
  }

  if (!passwordStrongEnough(parsed.data.password)) {
    res.status(400).json({
      message: 'Password must include uppercase, lowercase, number, and special character',
    });
    return;
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: tokenHash(parsed.data.token) },
  });

  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    res.status(400).json({ message: 'Password reset token is invalid or expired' });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash: await bcrypt.hash(parsed.data.password, 12) },
    });
    await tx.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
  });

  clearAuthCookies(res, isProduction);
  res.json({ message: 'Password reset successful. Please log in again.' });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid password change payload', errors: parsed.error.flatten() });
    return;
  }

  if (parsed.data.newPassword !== parsed.data.confirmNewPassword) {
    res.status(400).json({ message: 'Password confirmation does not match' });
    return;
  }

  if (!passwordStrongEnough(parsed.data.newPassword)) {
    res.status(400).json({
      message: 'Password must include uppercase, lowercase, number, and special character',
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ message: 'Current password is incorrect' });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) },
  });

  await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  clearAuthCookies(res, isProduction);
  res.json({ message: 'Password changed successfully. Please log in again.' });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  res.json({ user: toPublicUser(user) });
});

export default router;
