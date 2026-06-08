# Phase 5 — Monolith Implementation
### Distributed Tatkal Booking Engine

---

## Why This Phase Exists

Phase 4 designed the monolith. Phase 5 builds it. The code is intentionally simple — no Redis, no atomicity, no isolation. Every file is written to be understandable in one reading.

> The goal is not clean production code. The goal is working code that will visibly fail under load in Phase 6.

---

## Implementation Decisions

| Decision | Choice | Why |
|---|---|---|
| Framework | Express.js | Minimal, teaches routing clearly |
| ORM | Mongoose | Standard Node.js MongoDB library |
| Auth | bcrypt + JWT | bcrypt creates CPU load; JWT is stateless |
| No Redis | Intentional | Forces MongoDB to handle all reads and writes — the bottleneck we want |
| No transactions | Intentional | Exposes the TOCTOU race condition naturally |
| No rate limiting | Intentional | We want the spike to hit the system cleanly |
| Seed script | Required | Load test starts with pre-created users and train |

---

## File-by-File Explanation

### `src/server.js`
**Why it exists:** Entry point. Connects to MongoDB, then starts the HTTP server.
**Who calls it:** `node src/server.js` — started by Docker or directly.

### `src/app.js`
**Why it exists:** Express app setup — middleware, routes, health check.
**Who calls it:** `server.js` imports and starts it.

### `src/config/db.js`
**Why it exists:** Single MongoDB connection for the entire process. Shared connection pool = shared bottleneck.
**Who calls it:** `server.js` before starting HTTP server.

### `src/models/User.js`
**Why it exists:** Defines the User schema. Password stored as bcrypt hash.
**Who calls it:** `auth.service.js` for login lookup.

### `src/models/Train.js`
**Why it exists:** Defines Train schema including `availableSeats` — the field at the center of the race condition.
**Who calls it:** `seat.service.js` and `booking.service.js`.

### `src/models/Booking.js`
**Why it exists:** Records every confirmed booking. `idempotencyKey` enforced unique to prevent duplicate bookings.
**Who calls it:** `booking.service.js`.

### `src/middleware/auth.middleware.js`
**Why it exists:** Verifies JWT on every protected route. Stateless — does not call Auth service.
**Who calls it:** `booking.routes.js` applies it before `bookSeat` controller.

### `src/services/booking.service.js` ⚠️ THE INTENTIONALLY BROKEN FILE
**Why it exists:** Contains the race condition. Reads `availableSeats`, checks > 0, then decrements in a separate operation. Two operations — not atomic.
**The bug lives here.** Phase 6 load test will expose it.

### `scripts/seed.js`
**Why it exists:** Creates 10,000 users + 1 train with 500 seats before load testing.
**Who calls it:** `npm run seed` — must be run once before `k6` tests.

---

## How To Run

```bash
cd monolith

# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env

# 3. Start MongoDB (or use Docker)
# Make sure MongoDB is running on localhost:27017

# 4. Seed the database
npm run seed

# 5. Start the monolith
npm run dev

# Server running at http://localhost:3000
```

---

## Quick API Test

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@test.com","password":"password123"}'

# Check availability (use trainId from seed output)
curl http://localhost:3000/seats/availability?trainId=TRAIN_ID

# Book a seat (use token from login)
curl -X POST http://localhost:3000/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"trainId":"TRAIN_ID","idempotencyKey":"unique-uuid-here"}'
```

---
