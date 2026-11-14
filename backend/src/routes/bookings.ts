import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireVerified } from '../middleware/auth.js';

const router = Router();
export const bookingSchema = z.object({ seats: z.coerce.number().int().min(1).max(8) });
const bookingInclude = {
  ride: { include: { driver: { select: { id: true, name: true, bio: true, avatarPath: true, phone: true } } } },
  passenger: { select: { id: true, name: true, bio: true, avatarPath: true, phone: true } },
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

router.post('/rides/:rideId', requireVerified, async (req, res) => {
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
      if (ride.status === 'CANCELLED' || ride.status === 'COMPLETED') throw new Error('RIDE_CLOSED');
      const existing = await tx.booking.findUnique({
        where: { rideId_passengerId: { rideId: ride.id, passengerId: req.userId as string } },
      });
      if (existing && !['CANCELLED', 'DECLINED'].includes(existing.status)) throw new Error('ALREADY_BOOKED');

      const seatUpdate = await tx.ride.updateMany({
        where: { id: ride.id, status: 'OPEN', seatsAvailable: { gte: parsed.data.seats }, departureTime: { gt: new Date() } },
        data: { seatsAvailable: { decrement: parsed.data.seats } },
      });
      if (seatUpdate.count === 0) throw new Error('NOT_ENOUGH_SEATS');

      const updatedRide = await tx.ride.findUniqueOrThrow({ where: { id: ride.id } });
      if (updatedRide.seatsAvailable === 0 && updatedRide.status !== 'FULL') {
        await tx.ride.update({ where: { id: ride.id }, data: { status: 'FULL' } });
      }

      if (existing) {
        await tx.booking.update({
          where: { id: existing.id },
          data: { seats: parsed.data.seats, status: 'PENDING' },
        });
      } else {
        await tx.booking.create({ data: { rideId: ride.id, passengerId: req.userId as string, seats: parsed.data.seats } });
      }
      return tx.booking.findFirstOrThrow({ where: { rideId: ride.id, passengerId: req.userId }, include: bookingInclude });
    });
    res.status(201).json(booking);
  } catch (error) {
    const messages: Record<string, [number, string]> = {
      RIDE_NOT_FOUND: [404, 'Ride not found'],
      DRIVER_BOOKING: [400, 'Drivers cannot book their own ride'],
      RIDE_DEPARTED: [400, 'This ride has already departed'],
      RIDE_CLOSED: [409, 'This ride is not open for booking'],
      NOT_ENOUGH_SEATS: [409, 'Not enough seats are available'],
      ALREADY_BOOKED: [409, 'You already have an active booking for this ride'],
    };
    const response = messages[error instanceof Error ? error.message : ''];
    if (response) {
      res.status(response[0]).json({ message: response[1] });
      return;
    }
    throw error;
  }
});

router.patch('/:id/cancel', requireVerified, async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { ride: true } });
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
    const ride = await tx.ride.update({
      where: { id: booking.rideId },
      data: { seatsAvailable: { increment: booking.seats } },
    });
    if (ride.status === 'FULL') {
      await tx.ride.update({ where: { id: booking.rideId }, data: { status: 'OPEN' } });
    }
    return result;
  });
  res.json(updated);
});

export default router;
