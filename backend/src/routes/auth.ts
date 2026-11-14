import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createToken } from '../middleware/auth.js';

const router = Router();
const credentialsSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

function publicUser(user: { id: string; name: string; email: string; bio: string | null; createdAt: Date }) {
  return { id: user.id, name: user.name, email: user.email, bio: user.bio, createdAt: user.createdAt };
}

router.post('/register', async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success || !parsed.data.name) {
    res.status(400).json({ message: 'Name, email, and a password of at least 8 characters are required' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    res.status(409).json({ message: 'An account with this email already exists' });
    return;
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
    },
  });
  res.status(201).json({ token: createToken(user.id), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const parsed = credentialsSchema.pick({ email: true, password: true }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'A valid email and password are required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }
  res.json({ token: createToken(user.id), user: publicUser(user) });
});

export default router;
