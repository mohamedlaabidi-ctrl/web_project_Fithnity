import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../lib/mailer.js';
import { revokeAllUserSessions } from './sessionService.js';

function anonymizedEmail(id: string): string {
  return `deleted-${id}@thniyti.local`;
}

export async function deleteUserAccount(prisma: PrismaClient, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return;
  }

  const [activeRides, activeBookings] = await Promise.all([
    prisma.ride.findMany({
      where: {
        driverId: userId,
        departureTime: { gt: new Date() },
        status: { in: ['OPEN', 'FULL'] },
      },
      include: {
        bookings: {
          where: { status: { in: ['PENDING', 'ACCEPTED'] } },
          include: { passenger: true },
        },
      },
    }),
    prisma.booking.findMany({
      where: {
        passengerId: userId,
        status: { in: ['PENDING', 'ACCEPTED'] },
        ride: { departureTime: { gt: new Date() }, status: { in: ['OPEN', 'FULL'] } },
      },
      include: { ride: { include: { driver: true } } },
    }),
  ]);

  await prisma.$transaction(async (tx) => {
    for (const ride of activeRides) {
      await tx.ride.update({ where: { id: ride.id }, data: { status: 'CANCELLED' } });
      await tx.booking.updateMany({
        where: { rideId: ride.id, status: { in: ['PENDING', 'ACCEPTED'] } },
        data: { status: 'CANCELLED' },
      });
    }

    for (const booking of activeBookings) {
      await tx.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
      await tx.ride.update({
        where: { id: booking.rideId },
        data: { seatsAvailable: { increment: booking.seats }, status: 'OPEN' },
      });
    }

    await revokeAllUserSessions(tx, userId);

    await tx.user.update({
      where: { id: userId },
      data: {
        name: 'Deleted User',
        email: anonymizedEmail(userId),
        passwordHash: 'deleted-account',
        phone: null,
        bio: null,
        avatarPath: null,
        emailVerifiedAt: null,
        isSuspended: true,
        suspensionReason: 'ACCOUNT_DELETED',
        suspendedAt: new Date(),
      },
    });
  });

  await Promise.all([
    ...activeRides.flatMap((ride) =>
      ride.bookings.map((booking) =>
        sendEmail(
          booking.passenger.email,
          'Trip cancelled',
          `Your trip from ${ride.origin} to ${ride.destination} was cancelled because the driver account was deleted.`
        )
      )
    ),
    ...activeBookings.map((booking) =>
      sendEmail(
        booking.ride.driver.email,
        'Booking cancelled',
        `A booking on your trip from ${booking.ride.origin} to ${booking.ride.destination} was cancelled because the passenger account was deleted.`
      )
    ),
  ]);
}
