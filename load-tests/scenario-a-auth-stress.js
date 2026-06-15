/**
 * k6 — Scenario A: Auth CPU Starvation Test
 *
 * Goal: Show bcrypt saturates the Node.js event loop under concurrent login load.
 * Expected failure: p99 latency climbs beyond 5s, http_req_failed > 20%
 *
 * Run:
 *   k6 run load-tests/scenario-a-auth-stress.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const loginFailRate  = new Rate('login_fail_rate');
const loginDuration  = new Trend('login_duration_ms', true);

export const options = {
  scenarios: {
    auth_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 50   },   // warm up
        { duration: '20s', target: 200  },   // ramp up — should still work
        { duration: '20s', target: 500  },   // event loop starts clogging
        { duration: '30s', target: 1000 },   // saturation zone — failures expected
        { duration: '15s', target: 0    },   // ramp down
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    // These thresholds are EXPECTED TO FAIL — that's the point
    http_req_duration: ['p(99)<2000'],   // will breach — documenting the breach
    login_fail_rate:   ['rate<0.05'],    // will breach — documenting the breach
  },
};

// Pick a random user from the 10,000 seeded users
function randomUser() {
  const n = Math.floor(Math.random() * 10000) + 1;
  return {
    email:    `user${n}@test.com`,
    password: 'password123',
  };
}

export default function () {
  const user    = randomUser();
  const payload = JSON.stringify(user);
  const params  = { headers: { 'Content-Type': 'application/json' } };

  const res = http.post('http://localhost:3000/auth/login', payload, params);

  const ok = check(res, {
    'login status 200': (r) => r.status === 200,
    'has token':        (r) => r.json('token') !== undefined,
  });

  loginFailRate.add(!ok);
  loginDuration.add(res.timings.duration);

  sleep(0); // no sleep — hammer at full speed to saturate CPU
}
