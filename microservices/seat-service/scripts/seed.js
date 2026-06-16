/**
 * Seed script for Seat Service
 * Creates 1 train in tatkal-seat MongoDB database
 * Sets the Redis key seat:{trainId} = totalSeats
 *
 * Run: node scripts/seed.js   (from microservices/seat-service/)
 *
 * After running, copy the Train ID for use in k6 tests and booking requests.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Redis    = require('ioredis');
const Train    = require('../src/models/Train');

async function seed() {
  // Connect MongoDB
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[Seat Seed] Connected to MongoDB');

  // Connect Redis
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  await redis.ping();
  console.log('[Seat Seed] Connected to Redis');

  // Clear existing
  await Train.deleteMany({});
  console.log('[Seat Seed] Cleared existing trains');

  // Create train
  const train = await Train.create({
    trainNumber: '12951',
    name:        'Mumbai Rajdhani',
    totalSeats:  500,
  });

  // Set Redis seat counter
  const key = `seat:${train._id}`;
  await redis.set(key, train.totalSeats);
  console.log(`[Seat Seed] Redis key set: ${key} = ${train.totalSeats}`);

  console.log('\n[Seat Seed] ✅ Done.');
  console.log(`[Seat Seed] Train ID: ${train._id}`);
  console.log(`[Seat Seed] Available seats: ${train.totalSeats}`);
  console.log('\n→ Use this Train ID in your k6 scripts and booking requests.');

  await mongoose.disconnect();
  await redis.quit();
}

seed().catch((err) => {
  console.error('[Seat Seed] Error:', err.message);
  process.exit(1);
});
