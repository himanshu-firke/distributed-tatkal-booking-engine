/**
 * Post-test database verification script
 * Run: node scripts/verify-race-result.js  (from inside monolith/ directory)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Train    = require('../src/models/Train');
const Booking  = require('../src/models/Booking');

async function verify() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('\n[Verify] Connected to MongoDB\n');

  const train    = await Train.findOne({});
  const bookings = await Booking.countDocuments({ status: 'confirmed' });

  const totalSeats     = train.totalSeats;
  const availableSeats = train.availableSeats;
  const actualOversold = bookings - totalSeats;

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║          RACE CONDITION VERIFICATION RESULT          ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Train:            ${train.trainNumber} — ${train.name.padEnd(22)}║`);
  console.log(`║  Total seats:      ${String(totalSeats).padEnd(32)}║`);
  console.log(`║  Available seats:  ${String(availableSeats).padEnd(32)}║`);
  console.log(`║  Bookings in DB:   ${String(bookings).padEnd(32)}║`);
  console.log('╠══════════════════════════════════════════════════════╣');

  if (bookings > totalSeats) {
    console.log(`║  ❌ RACE CONDITION CONFIRMED                          ║`);
    console.log(`║  Oversold by:      ${String(actualOversold).padEnd(32)}║`);
    console.log(`║  ${actualOversold} passengers have confirmed tickets for phantom seats   ║`);
  } else if (availableSeats < 0) {
    console.log(`║  ❌ DATA CORRUPTION: availableSeats is negative       ║`);
    console.log(`║  Counter drifted to: ${String(availableSeats).padEnd(30)}║`);
  } else {
    console.log(`║  ⚠️  No oversell detected — reseed and retry with     ║`);
    console.log(`║     more VUs or ensure no connection errors during run║`);
  }

  console.log('╚══════════════════════════════════════════════════════╝\n');

  await mongoose.disconnect();
}

verify().catch((err) => {
  console.error('[Verify] Error:', err.message);
  process.exit(1);
});
