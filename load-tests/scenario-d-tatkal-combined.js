/**
 * k6 — Scenario D: Combined Tatkal Window Simulation
 *
 * Runs all three failure scenarios simultaneously — Auth spike, Availability storm,
 * and Booking race — to simulate a real Tatkal booking window opening.
 *
 * This is the "full cascade" test.
 *
 * Run:
 *   k6 run -e TRAIN_ID=<your-train-id> load-tests/scenario-d-tatkal-combined.js
 */

import http    from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const TRAIN_ID = __ENV.TRAIN_ID || 'REPLACE_WITH_TRAIN_ID';

// Per-scenario metrics
const authFail      = new Rate('auth_fail_rate');
const availFail     = new Rate('availability_fail_rate');
const bookConfirmed = new Counter('bookings_confirmed');
const bookFail      = new Counter('bookings_rejected');

export const options = {
  scenarios: {
    // 500 users hammering login (bcrypt saturates CPU)
    auth_spike: {
      executor: 'ramping-vus',
      exec:     'authScenario',
      startVUs: 0,
      stages: [
        { duration: '5s',  target: 100 },
        { duration: '20s', target: 500 },
        { duration: '30s', target: 500 },
        { duration: '5s',  target: 0   },
      ],
    },
    // 1000 users polling seat availability
    seat_storm: {
      executor: 'constant-vus',
      exec:     'seatScenario',
      vus:      1000,
      duration: '60s',
    },
    // 600 users all trying to book at exactly the same time
    booking_race: {
      executor:     'shared-iterations',
      exec:         'bookingScenario',
      vus:          600,
      iterations:   600,
      maxDuration:  '60s',
      startTime:    '5s', // small delay — let auth storm start first
    },
  },
};

export function authScenario() {
  const n = Math.floor(Math.random() * 10000) + 1;
  const res = http.post(
    'http://localhost:3000/auth/login',
    JSON.stringify({ email: `user${n}@test.com`, password: 'password123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  authFail.add(res.status !== 200);
  sleep(0);
}

export function seatScenario() {
  const res = http.get(`http://localhost:3000/seats/availability?trainId=${TRAIN_ID}`);
  availFail.add(res.status !== 200);
  sleep(0.2);
}

export function bookingScenario() {
  const userIndex = __VU;

  // Login first
  const loginRes = http.post(
    'http://localhost:3000/auth/login',
    JSON.stringify({ email: `user${userIndex}@test.com`, password: 'password123' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (loginRes.status !== 200) { bookFail.add(1); return; }

  const token = loginRes.json('token');

  const bookRes = http.post(
    'http://localhost:3000/bookings',
    JSON.stringify({ trainId: TRAIN_ID, idempotencyKey: uuidv4() }),
    { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } }
  );

  if (bookRes.status === 200 || bookRes.status === 201) {
    bookConfirmed.add(1);
  } else {
    bookFail.add(1);
  }
}
