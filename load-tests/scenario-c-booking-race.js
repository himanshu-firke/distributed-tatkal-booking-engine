/**
 * k6 — Scenario C: Booking Race Condition (TOCTOU)
 *
 * Goal: Prove the read-check-write gap causes oversold seats.
 *
 * HOW IT WORKS:
 *   1. setup()   → logs in 600 users sequentially (no bcrypt overload)
 *                  returns array of 600 pre-warmed JWT tokens
 *   2. default() → all 600 VUs immediately hit POST /bookings with cached
 *                  token — no login during the race, pure booking concurrency
 *
 * BEFORE RUNNING:
 *   npm run seed  → resets to 500 fresh seats, copy the Train ID
 *
 * Run:
 *   k6 run -e TRAIN_ID=<id> load-tests/scenario-c-booking-race.js
 *
 * After it finishes (from monolith/ directory):
 *   node scripts/verify-race-result.js
 */

import http    from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const TRAIN_ID      = __ENV.TRAIN_ID || 'REPLACE_WITH_TRAIN_ID';
const TOTAL_BOOKERS = 600; // more VUs than seats (500) to trigger race

const bookingSuccess = new Counter('bookings_confirmed');
const bookingFail    = new Counter('bookings_rejected');

// ─── SETUP: runs ONCE before the test ────────────────────────────────────────
// Logs in all 600 users sequentially — avoids saturating bcrypt
// Returns token array shared with all VUs
export function setup() {
  console.log(`[Setup] Pre-logging in ${TOTAL_BOOKERS} users sequentially...`);
  const tokens = [];

  for (let i = 1; i <= TOTAL_BOOKERS; i++) {
    const res = http.post(
      'http://localhost:3000/auth/login',
      JSON.stringify({ email: `user${i}@test.com`, password: 'password123' }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (res.status === 200) {
      tokens.push(res.json('token'));
    } else {
      tokens.push(null);
    }

    if (i % 100 === 0) {
      console.log(`[Setup] ${i}/${TOTAL_BOOKERS} users logged in`);
    }
  }

  const valid = tokens.filter(t => t !== null).length;
  console.log(`[Setup] Done. ${valid}/${TOTAL_BOOKERS} valid tokens ready.`);
  return tokens;
}

// ─── MAIN TEST ────────────────────────────────────────────────────────────────
export const options = {
  setupTimeout: '180s',   // bcrypt is slow — 600 sequential logins need ~90s
  scenarios: {
    booking_race: {
      executor:    'shared-iterations',
      vus:         TOTAL_BOOKERS,
      iterations:  TOTAL_BOOKERS,
      maxDuration: '2m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<30000'],
  },
};

export default function (tokens) {
  const token = tokens[__VU - 1];

  if (!token) {
    bookingFail.add(1);
    return;
  }

  const res = http.post(
    'http://localhost:3000/bookings',
    JSON.stringify({
      trainId:        TRAIN_ID,
      idempotencyKey: uuidv4(),
    }),
    {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  check(res, {
    'booking attempted': (r) => r.status !== 0,
  });

  if (res.status === 200 || res.status === 201) {
    bookingSuccess.add(1);
  } else {
    bookingFail.add(1);
  }
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const confirmed = data.metrics['bookings_confirmed']
    ? data.metrics['bookings_confirmed'].values.count : 0;
  const rejected = data.metrics['bookings_rejected']
    ? data.metrics['bookings_rejected'].values.count : 0;

  console.log('\n');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     SCENARIO C — RACE CONDITION RESULT   ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Train seats (seeded):   500             ║`);
  console.log(`║  Concurrent VUs:         ${String(TOTAL_BOOKERS).padEnd(14)}║`);
  console.log(`║  Bookings confirmed:     ${String(confirmed).padEnd(14)}║`);
  console.log(`║  Bookings rejected:      ${String(rejected).padEnd(14)}║`);
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  NOW RUN (from monolith/):               ║`);
  console.log(`║  node scripts/verify-race-result.js      ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('\n');
  return {};
}
