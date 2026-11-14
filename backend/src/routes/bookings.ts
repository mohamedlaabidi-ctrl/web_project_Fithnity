import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const bookingSchema = z.object({ seats: z.coerce.number().int().min(1).max(8) });
const bookingInclude = {
  ride: { include: { driver: { select: { id: true, name: true, email: true } } } },
  passenger: { select: { id: true, name: true, email: true } },
} as const;

router.use(requireAuth);

router.get('/', async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { passengerId: req.userId },
    include: bookingInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json(bookings);
});

router.post('/rides/:rideId', async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Seats must be a positive whole number' });
    return;
  }
  try {
    const booking = await prisma.$transaction(async (tx) => {
      const ride = await tx.ride.findUnique({ where: { id: req.params.rideId } });
      if (!ride) throw new Error('RIDE_NOT_FOUND');
      if (ride.driverId === req.userId) throw new Error('DRIVER_BOOKING');
      if (ride.departureTime <= new Date()) throw new Error('RIDE_DEPARTED');
      if (ride.seatsAvailable < parsed.data.seats) throw new Error('NOT_ENOUGH_SEATS');
      const existing = await tx.booking.findUnique({
        where: { rideId_passengerId: { rideId: ride.id, passengerId: req.userId as string } },
      });
      if (existing && existing.status !== 'CANCELLED') throw new Error('ALREADY_BOOKED');
      if (existing) {
        await tx.booking.update({ where: { id: existing.id }, data: { seats: parsed.data.seats, status: 'PENDING' } });
      } else {
        await tx.booking.create({ data: { rideId: ride.id, passengerId: req.userId as string, seats: parsed.data.seats } });
      }
      await tx.ride.update({ where: { id: ride.id }, data: { seatsAvailable: { decrement: parsed.data.seats } } });
      return tx.booking.findFirstOrThrow({ where: { rideId: ride.id, passengerId: req.userId }, include: bookingInclude });
    });
    res.status(201).json(booking);
  } catch (error) {
    const messages: Record<string, [number, string]> = {
      RIDE_NOT_FOUND: [404, 'Ride not found'],
      DRIVER_BOOKING: [400, 'Drivers cannot book their own ride'],
      RIDE_DEPARTED: [400, 'This ride has already departed'],
      NOT_ENOUGH_SEATS: [409, 'Not enough seats are available'],
      ALREADY_BOOKED: [409, 'You already have a booking for this ride'],
    };
    const response = messages[error instanceof Error ? error.message : ''];
    if (response) {
      res.status(response[0]).json({ message: response[1] });
      return;
    }
    throw error;
  }
});

router.patch('/:id/cancel', async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!booking) {
    res.status(404).json({ message: 'Booking not found' });
    return;
  }
  if (booking.passengerId !== req.userId) {
    res.status(403).json({ message: 'You can only cancel your own bookings' });
    return;
  }
  if (booking.status === 'CANCELLED') {
    res.json(booking);
    return;
  }
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' }, include: bookingInclude });
    await tx.ride.update({ where: { id: booking.rideId }, data: { seatsAvailable: { increment: booking.seats } } });
    return result;
  });
  res.json(updated);
});

export default router;
