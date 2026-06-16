# Phase 7 — Service Boundaries



## What This Phase Is About

Phase 6 proved the monolith breaks in 3 specific ways. Phase 7 defines how to fix it — not with code, but with **clear boundaries**.

Before writing a single line of microservice code, I need to answer:
- What services exist?
- What data does each service own exclusively?
- How do services talk to each other?
- What happens when one service goes down?

This phase answers all four.

---

## The Core Rule — Data Ownership

In a microservice architecture, **each service owns its data exclusively**. No service reads another service's database directly. All communication goes through APIs or events.

```
❌ Wrong: Booking Service reads directly from Auth Service's Users table
✅ Right: Booking Service calls Auth Service's API to validate a token
```

This is what makes services truly independent. If Auth's database schema changes, Booking doesn't break — it just calls the same API endpoint.

---

## The Three Services

Phase 6 showed exactly three failure points — each one becomes its own service.

### Why exactly three?

| Monolith Failure | Cause | Solution |
|---|---|---|
| bcrypt starvation | Auth + Booking share one process | **Auth Service** — isolated CPU |
| MongoDB pool exhaustion | No cache on seat reads | **Seat Service** — reads from Redis |
| TOCTOU race condition | Non-atomic read-write | **Booking Service** — atomic Redis DECR |

---

## Service 1 — Auth Service

### Responsibility

Issue JWT tokens after validating credentials. That is the only thing it does.

### What It Owns

| Resource | Details |
|---|---|
| `users` collection | name, email, bcrypt password hash |
| JWT signing key | used to sign tokens it issues |

No other service touches the `users` collection directly.

### API Contract

```
POST /auth/login
  Body:    { email, password }
  Returns: { token }   ← JWT signed with Auth's secret
  Error:   401 Invalid credentials

POST /auth/register   (optional — for seeding in tests)
  Body:    { name, email, password }
  Returns: { userId }
```

### How Other Services Use Auth

Other services do **not** call Auth for every request. They validate JWTs locally using the shared public key.

```
Client → [JWT token in header] → Booking Service
Booking Service → validates token signature locally → no Auth Service call needed
```

Auth is only called once: at login time. After that, the JWT is self-contained.

### Why It Needs Its Own Process

bcrypt.compare() takes ~100ms of CPU per call. In the monolith, this blocked the Node.js event loop for all other services.

In isolation, Auth's CPU usage does not affect Booking or Seat response times — they run in separate processes on separate ports.

---

## Service 2 — Seat Service

### Responsibility

Answer one question: how many seats are available for a given train?

### What It Owns

| Resource | Details |
|---|---|
| `trains` collection | train metadata (number, name, route, date) |
| Redis key `seat:{trainId}` | live available seat count (integer) |

The `availableSeats` number lives in **Redis**, not MongoDB. MongoDB holds the train metadata (name, route, etc.). Redis holds the mutable counter that changes with every booking.

### API Contract

```
GET /seats/availability?trainId=<id>
  Returns: { trainId, trainNumber, availableSeats, totalSeats }
  Source:  Redis (in-memory, < 1ms)

GET /seats/trains
  Returns: list of all trains
  Source:  MongoDB (read-only, cached)
```

### Why Redis Instead of MongoDB

In Phase 6, the availability endpoint destroyed the MongoDB connection pool under load.

Redis is in-memory and returns in under 1ms. A single Redis instance handles 100,000+ requests per second. The MongoDB pool exhaustion problem cannot occur.

```
Before: GET /seats → MongoDB findById → 3.6ms healthy, 9.9s under load
After:  GET /seats → Redis GET seat:trainId → 0.3ms always
```

### Who Writes the Redis Counter

The Booking Service decrements `seat:{trainId}` atomically when a seat is confirmed. The Seat Service only reads it.

---

## Service 3 — Booking Service

### Responsibility

Reserve a seat atomically. Create a booking record. Enforce exactly-once booking per idempotency key.

### What It Owns

| Resource | Details |
|---|---|
| `bookings` collection | confirmed reservations |
| Redis atomic operation | `DECR seat:{trainId}` to claim a seat |

### API Contract

```
POST /bookings
  Headers: Authorization: Bearer <JWT>
  Body:    { trainId, idempotencyKey }
  Returns: { booking: { id, seatNumber, status: "confirmed" } }
  Error:   409 No seats available
  Error:   409 Duplicate idempotencyKey

GET /bookings/:id
  Headers: Authorization: Bearer <JWT>
  Returns: booking details
```

### The Atomic Booking Flow

This is the core fix for the TOCTOU race condition from Phase 6:

```
Step 1: Validate JWT (locally — no Auth call)
Step 2: Check idempotency key → if exists, return existing booking
Step 3: Redis DECR seat:{trainId}
         → if result >= 0: seat claimed — proceed
         → if result < 0: INCR to reverse, return 409 No seats
Step 4: Write booking record to MongoDB
Step 5: Return confirmed booking to client
```

The key difference from the monolith:

```
Monolith (broken):
  Read availableSeats from MongoDB  ← step 1
  [GAP — race condition lives here]
  Write $inc: -1 to MongoDB         ← step 2

Microservice (fixed):
  Redis DECR seat:{trainId}         ← single atomic operation, no gap possible
```

`DECR` is atomic at the Redis server level. Two clients cannot both DECR and both get a positive result. The race condition is structurally impossible.

---

## How Services Communicate

```
                  ┌──────────────────────────────────────┐
                  │              Client                  │
                  └────────┬────────────┬────────────────┘
                           │            │
                    POST /auth    GET /seats   POST /bookings
                           │            │            │
                  ┌────────▼──┐  ┌──────▼──┐  ┌─────▼──────┐
                  │   Auth    │  │  Seat   │  │  Booking   │
                  │ Service   │  │ Service │  │  Service   │
                  │ :3001     │  │ :3002   │  │  :3003     │
                  └────────┬──┘  └──────┬──┘  └─────┬──────┘
                           │            │            │
                  ┌────────▼──┐  ┌──────▼──────────▼──┐
                  │  MongoDB  │  │       Redis        │
                  │  (users)  │  │  seat:{trainId}    │
                  └───────────┘  │  (Seat reads,      │
                                 │   Booking writes)  │
                                 └────────────────────┘
```

### Communication Rules

| From | To | Method | Why |
|---|---|---|---|
| Client | Auth Service | HTTP POST | Login to get JWT |
| Client | Seat Service | HTTP GET | Check availability |
| Client | Booking Service | HTTP POST | Book a seat |
| Booking Service | Redis | DECR command | Atomic seat claim |
| Seat Service | Redis | GET command | Read available count |
| Booking Service | Auth (never) | — | JWT validated locally |

Services do **not** call each other during the booking flow. This is intentional — it removes network latency from the critical path and prevents cascading failures.

---

## Data Boundaries

| Data | Owner | Storage | Other services access it via |
|---|---|---|---|
| Users / credentials | Auth Service | MongoDB `users` | Never — Auth issues JWT tokens instead |
| Train metadata | Seat Service | MongoDB `trains` | `GET /seats/availability` API |
| Available seat count | Booking + Seat (shared Redis) | Redis | Redis directly (same key) |
| Booking records | Booking Service | MongoDB `bookings` | `GET /bookings/:id` API |

### Why Shared Redis Is Acceptable

Seat Service and Booking Service both access the same Redis key (`seat:{trainId}`). This is an intentional exception to strict data isolation:

- The seat counter is not business logic — it is an atomic counter
- Redis DECR is safe to call from multiple services simultaneously
- The Booking Service is the only writer; Seat Service only reads
- If Redis goes down, both services degrade together — but MongoDB bookings remain consistent

---

## What Happens When a Service Goes Down

| Service Down | Impact | Other Services |
|---|---|---|
| Auth Service | New logins fail | Booking still works for users with valid JWTs |
| Seat Service | Availability page fails | Booking still works (Redis still accessible) |
| Booking Service | Cannot book | Auth and Seat still respond |
| Redis | Availability and Booking fail | Auth still works (uses MongoDB only) |
| MongoDB | Auth and Booking writes fail | Seat availability still served from Redis |

No single service failure takes down the entire system. This is the key advantage over the monolith — where any crash killed everything.

---


## Summary

| Service | Port | Owns | Fixes |
|---|---|---|---|
| Auth Service | 3001 | Users, JWTs | bcrypt CPU starvation (Failure 1) |
| Seat Service | 3002 | Train metadata, Redis reads | MongoDB pool exhaustion (Failure 2) |
| Booking Service | 3003 | Bookings, Redis DECR | TOCTOU race condition (Failure 3) |

Each service fixes exactly one failure from Phase 6. Each service is independently deployable, independently scalable, and independently testable.

---

]
