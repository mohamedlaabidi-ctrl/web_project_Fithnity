import assert from 'node:assert/strict';
import test from 'node:test';
import { bookingSchema } from './bookings.js';

test('booking validation accepts a valid seat count', () => {
  assert.deepEqual(bookingSchema.parse({ seats: '3' }), { seats: 3 });
});

test('booking validation rejects zero, fractional, and excessive seat counts', () => {
  for (const seats of [0, 1.5, 9]) {
    assert.equal(bookingSchema.safeParse({ seats }).success, false);
  }
});
