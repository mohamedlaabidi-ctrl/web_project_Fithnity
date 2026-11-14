import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const rideSchema = z.object({
  origin: z.string().trim().min(2).max(120),
  destination: z.string().trim().min(2).max(120),
  departureTime: z.coerce.date(),
  seatsAvailable: z.coerce.number().int().min(1).max(8),
});

const rideInclude = {
  driver: { select: { id: true, name: true, email: true, bio: true } },
  _count: { select: { bookings: true } },
} as const;

router.get('/', async (req, res) => {
  const query = z.object({
    origin: z.string().trim().optional(),
    destination: z.string().trim().optional(),
    date: z.coerce.date().optional(),
  }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ message: 'Invalid search parameters' });
    return;
  }

  const { origin, destination, date } = query.data;
  const start = date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : undefined;
  const end = start ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : undefined;
  const rides = await prisma.ride.findMany({
    where: {
      departureTime: { gte: start ?? new Date() , ...(end ? { lt: end } : {}) },
      ...(origin ? { origin: { contains: origin } } : {}),
      ...(destination ? { destination: { contains: destination } } : {}),
    },
    include: rideInclude,
    orderBy: { departureTime: 'asc' },
  });
  res.json(rides);
});

router.get('/:id', async (req, res) => {
  const rideId = String(req.params.id);
  const ride = await prisma.ride.findUnique({ where: { id: rideId }, include: rideInclude });
  if (!ride) {
    res.status(404).json({ message: 'Ride not found' });
    return;
  }
  res.json(ride);
});

router.post('/', requireAuth, async (req, res) => {
  const parsed = rideSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.departureTime <= new Date()) {
    res.status(400).json({ message: 'Provide valid ride details and a future departure time' });
    return;
  }
  const ride = await prisma.ride.create({
    data: { ...parsed.data, driverId: req.userId as string },
    include: rideInclude,
  });
  res.status(201).json(ride);
});

router.patch('/:id', requireAuth, async (req, res) => {
  const rideId = String(req.params.id);
  const parsed = rideSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid ride data', errors: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!existing) {
    res.status(404).json({ message: 'Ride not found' });
    return;
  }
  if (existing.driverId !== req.userId) {
    res.status(403).json({ message: 'Only the driver can update this ride' });
    return;
  }
  if (parsed.data.seatsAvailable !== undefined) {
    const booked = await prisma.booking.aggregate({
      where: { rideId, status: { not: 'CANCELLED' } },
      _sum: { seats: true },
    });
    if (parsed.data.seatsAvailable < (booked._sum.seats ?? 0)) {
      res.status(400).json({ message: 'Available seats cannot be lower than booked seats' });
      return;
    }
  }
  const ride = await prisma.ride.update({ where: { id: rideId }, data: parsed.data, include: rideInclude });
  res.json(ride);
});

router.delete('/:id', requireAuth, async (req, res) => {
  const rideId = String(req.params.id);
  const existing = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!existing) {
    res.status(404).json({ message: 'Ride not found' });
    return;
  }
  if (existing.driverId !== req.userId) {
    res.status(403).json({ message: 'Only the driver can delete this ride' });
    return;
  }
  await prisma.ride.delete({ where: { id: rideId } });
  res.status(204).send();
});

export default router;
