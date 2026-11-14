import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { clearAuthCookies } from '../lib/cookies.js';
import { requireAuth } from '../middleware/auth.js';
import { deleteUserAccount } from '../services/accountService.js';
import { toPublicUser } from '../services/sessionService.js';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';
const avatarDir = path.resolve(process.cwd(), 'uploads', 'avatars');
const allowedAvatarTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxAvatarBytes = 2 * 1024 * 1024;

const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  bio: z.string().trim().max(500).nullable().optional(),
});

const avatarSchema = z.object({ imageDataUrl: z.string().min(20) });
const deleteSchema = z.object({ password: z.string().min(1) });

router.use(requireAuth);

router.get('/', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }
  res.json(toPublicUser(user));
});

router.patch('/', async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid profile data', errors: parsed.error.flatten() });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: req.userId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio } : {}),
      ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone || null } : {}),
    },
  });

  res.json(toPublicUser(updated));
});

router.patch('/avatar', async (req, res) => {
  const parsed = avatarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid avatar payload' });
    return;
  }

  const match = parsed.data.imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    res.status(400).json({ message: 'Avatar must be a base64 data URL' });
    return;
  }

  const mimeType = match[1];
  if (!allowedAvatarTypes.has(mimeType)) {
    res.status(400).json({ message: 'Only PNG, JPEG, and WEBP avatars are allowed' });
    return;
  }

  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > maxAvatarBytes) {
    res.status(400).json({ message: 'Avatar size must be 2MB or less' });
    return;
  }

  await fs.mkdir(avatarDir, { recursive: true });
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'webp';
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const absolutePath = path.join(avatarDir, fileName);
  await fs.writeFile(absolutePath, bytes, { flag: 'wx' });

  const existing = await prisma.user.findUnique({ where: { id: req.userId }, select: { avatarPath: true } });
  const avatarPath = `/uploads/avatars/${fileName}`;
  const user = await prisma.user.update({ where: { id: req.userId }, data: { avatarPath } });

  if (existing?.avatarPath?.startsWith('/uploads/avatars/')) {
    const oldFile = path.resolve(process.cwd(), existing.avatarPath.replace(/^\//, ''));
    await fs.unlink(oldFile).catch(() => undefined);
  }

  res.json(toPublicUser(user));
});

router.delete('/', async (req, res) => {
  const parsed = deleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Password is required to delete your account' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ message: 'Incorrect password' });
    return;
  }

  await deleteUserAccount(prisma, user.id);
  clearAuthCookies(res, isProduction);
  res.json({ message: 'Account deleted successfully' });
});

export default router;
