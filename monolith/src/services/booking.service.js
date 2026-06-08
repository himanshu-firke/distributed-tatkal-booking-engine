const Booking = require('../models/Booking');
const Train   = require('../models/Train');

/**
 * Booking Service — bookSeat
 *
 * ⚠️ THIS FILE CONTAINS AN INTENTIONAL RACE CONDITION.
 *
 * The read (findById) and write ($inc availableSeats) are two separate
 * database operations with NO atomicity between them.
 *
 * Failure scenario:
 *   1. Thread A reads availableSeats = 1
 *   2. Thread B reads availableSeats = 1
 *   3. Thread A: 1 > 0 ✓ → decrements → creates Booking A
 *   4. Thread B: 1 > 0 ✓ → decrements → creates Booking B  ← OVERSOLD
 *   5. availableSeats = -1 ← DATA CORRUPTION
 *
 * This is fixed in Phase 8 using Redis DECR (atomic check-and-decrement).
 */
const bookSeat = async (userId, trainId, idempotencyKey) => {
  // Idempotency check — prevents duplicate bookings from retries
  const existing = await Booking.findOne({ idempotencyKey });
  if (existing) return { booking: existing, alreadyExists: true };

  // ⚠️ STEP 1: Read availableSeats
  const train = await Train.findById(trainId);
  if (!train) throw new Error('Train not found');

  if (train.availableSeats <= 0) {
    throw new Error('No seats available');
  }

  // ⚠️ GAP: Another concurrent request can pass the check above
  //          before this write executes. That is the TOCTOU bug.

  // ⚠️ STEP 2: Decrement (separate operation — not atomic with step 1)
  const seatNumber = train.totalSeats - train.availableSeats + 1;
  await Train.findByIdAndUpdate(trainId, { $inc: { availableSeats: -1 } });

  const booking = await Booking.create({
    userId,
    trainId,
    seatNumber,
    status: 'confirmed',
    idempotencyKey,
  });

  return { booking, alreadyExists: false };
};

module.exports = { bookSeat };
