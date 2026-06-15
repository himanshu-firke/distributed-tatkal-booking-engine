/**
 * k6 — Scenario B: Seat Availability MongoDB Saturation
 *
 * Goal: Show MongoDB connection pool exhausts under heavy polling of GET /seats/availability.
 * Expected failure: MongoTimeoutError, p99 latency > 2000ms
 *
 * Setup: Copy the trainId from `npm run seed` output into TRAIN_ID below.
 *
 * Run:
 *   k6 run load-tests/scenario-b-seat-storm.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── PASTE YOUR TRAIN ID HERE (from: npm run seed output) ───────────────────
const TRAIN_ID = __ENV.TRAIN_ID || 'REPLACE_WITH_TRAIN_ID';
// ─────────────────────────────────────────────────────────────────────────────

const availFail     = new Rate('availability_fail_rate');
const availDuration = new Trend('availability_duration_ms', true);

export const options = {
  scenarios: {
    availability_storm: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50   },  // warm up — should be fast (< 20ms)
        { duration: '20s', target: 500  },  // ramp up
        { duration: '20s', target: 1500 },  // connection pool starts queuing
        { duration: '30s', target: 2500 },  // pool exhausted — MongoTimeoutError
        { duration: '10s', target: 0    },  // ramp down
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    // EXPECTED TO BREACH — documenting the failure
    http_req_duration:    ['p(99)<500'],
    availability_fail_rate: ['rate<0.05'],
  },
};

export default function () {
  const url = `http://localhost:3000/seats/availability?trainId=${TRAIN_ID}`;
  const res = http.get(url);

  const ok = check(res, {
    'availability status 200':   (r) => r.status === 200,
    'has availableSeats':        (r) => r.json('availableSeats') !== undefined,
  });

  availFail.add(!ok);
  availDuration.add(res.timings.duration);

  sleep(0.1); // 100ms between polls per VU — simulates clients refreshing page
}
