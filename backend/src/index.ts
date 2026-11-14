import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { prisma } from './lib/prisma.js';
import authRouter from './routes/auth.js';
import bookingsRouter from './routes/bookings.js';
import profileRouter from './routes/profile.js';
import ridesRouter from './routes/rides.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/rides', ridesRouter);
app.use('/api/bookings', bookingsRouter);

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ message: 'Thniyti backend is running', database: 'connected' });
  } catch (error) {
    console.error('Database health check failed', error);
    res.status(503).json({ message: 'Thniyti backend is unavailable', database: 'disconnected' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
