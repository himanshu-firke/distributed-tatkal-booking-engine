const redis   = require('../config/redis');
const Booking = require('../models/Booking');

/**
 * Create a booking atomically.
 *
 * ✅ Fix for Failure 3 (TOCTOU race condition):
 *
 *    Monolith (broken):
 *      1. findById → read availableSeats         [STEP 1]
 *      2. if > 0, proceed                        [GAP — race lives here]
 *      3. $inc: { availableSeats: -1 }           [STEP 2]
 *    Two concurrent requests can both pass step 1 before either runs step 2.
 *
 *    Microservice (fixed):
 *      1. Redis DECR seat:{trainId}              [SINGLE ATOMIC OPERATION]
 *         → Redis guarantees: only ONE client gets each unique decremented value
 *         → No two clients can both DECR and both get a value >= 0 for the last seat
 *      2. If result < 0: INCR to reverse, return 409
 *      3. If result >= 0: seat is ours — write booking to MongoDB
 *
 *    The race condition gap is structurally impossible with Redis DECR.
 */
const createBooking = async ({ userId, trainId, idempotencyKey }) => {
  // Step 1: Idempotency check — return existing booking if key was used before
  const existing = await Booking.findOne({ idempotencyKey });
  if (existing) return existing;

  // Step 2: Atomic seat claim via Redis DECR
  const key       = `seat:${trainId}`;
  const remaining = await redis.decr(key);

  if (remaining < 0) {
    // No seats available — reverse the decrement so count stays consistent
    await redis.incr(key);
    throw Object.assign(new Error('No seats available'), { status: 409 });
  }

  // Step 3: Seat claimed — persist the booking
  const booking = await Booking.create({
    userId,
    trainId,
    idempotencyKey,
    status: 'confirmed',
  });

  return booking;
};

/**
 * Get a booking by ID.
 * Only returns the booking if it belongs to the requesting user.
 */
const getBooking = async ({ bookingId, userId }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw Object.assign(new Error('Booking not found'), { status: 404 });
  if (booking.userId !== userId.toString()) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  return booking;
};

module.exports = { createBooking, getBooking };
