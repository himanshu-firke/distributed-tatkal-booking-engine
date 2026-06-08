/**
 * Seed Script
 * Creates 10,000 users + 1 train with 500 Tatkal seats.
 * Must be run once before load testing.
 *
 * Usage: npm run seed
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const User     = require('../src/models/User');
const Train    = require('../src/models/Train');

const TOTAL_USERS = 10000;
const TOTAL_SEATS = 500;
const BATCH_SIZE  = 500; // insert in batches to avoid memory spikes

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[Seed] Connected to MongoDB');

  // Clear existing data
  await User.deleteMany({});
  await Train.deleteMany({});
  console.log('[Seed] Cleared existing data');

  // Create users in batches
  console.log(`[Seed] Creating ${TOTAL_USERS} users...`);
  const passwordHash = await bcrypt.hash('password123', 10);

  for (let i = 0; i < TOTAL_USERS; i += BATCH_SIZE) {
    const batch = [];
    for (let j = i; j < Math.min(i + BATCH_SIZE, TOTAL_USERS); j++) {
      batch.push({
        name:     `User ${j + 1}`,
        email:    `user${j + 1}@test.com`,
        password: passwordHash,
      });
    }
    await User.insertMany(batch);
    process.stdout.write(`\r[Seed] Users created: ${Math.min(i + BATCH_SIZE, TOTAL_USERS)} / ${TOTAL_USERS}`);
  }
  console.log('\n[Seed] Users done.');

  // Create 1 train
  const train = await Train.create({
    trainNumber:    '12951',
    name:           'Mumbai Rajdhani',
    source:         'Mumbai',
    destination:    'Delhi',
    totalSeats:     TOTAL_SEATS,
    availableSeats: TOTAL_SEATS,
    date:           new Date('2025-01-01'),
  });

  console.log(`[Seed] Train created: ${train.trainNumber} — ${train.name}`);
  console.log(`[Seed] Train ID: ${train._id}`);
  console.log(`[Seed] Available seats: ${train.availableSeats}`);
  console.log('\n[Seed] ✅ Done. Use the Train ID above in your k6 scripts.');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[Seed] Error:', err.message);
  process.exit(1);
});
