/**
 * Seed script for Auth Service
 * Creates 10,000 test users in tatkal-auth database
 *
 * Run: node scripts/seed.js   (from microservices/auth-service/)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../src/models/User');

const TOTAL_USERS = 10000;
const BATCH_SIZE  = 500;
const PASSWORD    = 'password123';

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[Auth Seed] Connected to MongoDB');

  await User.deleteMany({});
  console.log('[Auth Seed] Cleared existing users');

  console.log(`[Auth Seed] Hashing password (once, reused for all users)...`);
  const hash = await bcrypt.hash(PASSWORD, parseInt(process.env.BCRYPT_ROUNDS) || 10);

  console.log(`[Auth Seed] Creating ${TOTAL_USERS} users in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < TOTAL_USERS; i += BATCH_SIZE) {
    const batch = [];
    for (let j = i + 1; j <= Math.min(i + BATCH_SIZE, TOTAL_USERS); j++) {
      batch.push({
        name:     `User ${j}`,
        email:    `user${j}@test.com`,
        password: hash,
      });
    }
    await User.insertMany(batch);
    console.log(`[Auth Seed] Created ${Math.min(i + BATCH_SIZE, TOTAL_USERS)} / ${TOTAL_USERS}`);
  }

  console.log('\n[Auth Seed] ✅ Done. 10,000 users ready in tatkal-auth database.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[Auth Seed] Error:', err.message);
  process.exit(1);
});
