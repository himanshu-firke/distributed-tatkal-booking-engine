# Phase 3 — Problems At Scale
### Distributed Tatkal Booking Engine

---

## Why This Phase Exists

Phase 1 named the problems. Phase 2 defined the requirements. Phase 3 explains **exactly how each problem manifests at scale** — what technically breaks, why it breaks, and what the system looks like when it fails.

This phase exists because understanding failure is more important than building the solution. A junior engineer writes code that works. A senior engineer understands **why** it breaks under load before writing a single line.

> Every architectural decision in Phase 4 onwards is a direct response to a failure described here.

---

## Scale Profile: Tatkal vs Normal Traffic

| Dimension | Normal Traffic | Tatkal Spike |
|---|---|---|
| Requests/sec | ~50–100 | ~2,000–10,000 (burst) |
| Duration | Continuous, steady | 60–120 seconds |
| Pattern | Random, spread | Synchronized — all at 11:00:00 AM |
| Request type | Mixed (browse, search, book) | Login → Availability → Book (sequential, fast) |
| Users competing for same resource | Rare | Always — all targeting same train/date |

**The spike is not gradual.** It is a cliff edge. The system goes from idle to maximum load in under one second.

---

## Problem 1 — Race Condition (Double Booking)

### What Happens

This is a **TOCTOU** bug — Time Of Check, Time Of Use.

```
Thread A: SELECT available_seats WHERE train = 'MUM-DEL'  → returns 1
Thread B: SELECT available_seats WHERE train = 'MUM-DEL'  → returns 1
Thread A: available_seats > 0 ✓ → INSERT booking → UPDATE seats = 0
Thread B: available_seats > 0 ✓ → INSERT booking → UPDATE seats = -1
```

Both threads read the same value before either writes. Both pass the check. Both create a booking.

### Why It Gets Worse At Scale

At 100 concurrent users, the probability of two threads hitting this exact gap is low. At **10,000 concurrent users** all arriving simultaneously, this race condition becomes near-certain. The smaller the remaining inventory, the more dangerous — the last 10 seats will be fought over by thousands of requests simultaneously.

### What Breaks

- `available_seats` goes negative
- More bookings exist than seats
- No way to determine which bookings are valid
- Data is permanently corrupted

### What a Correct System Must Do

Atomic check-and-decrement. The read and write must happen as a single indivisible operation — not two separate database calls.

---

## Problem 2 — Auth CPU Spike (Shared Resource Contention)

### What Happens

`bcrypt` is intentionally designed to be slow — it performs thousands of hashing rounds to resist brute-force attacks. Each login request on a single CPU core takes **80–200ms** of pure computation.

At 11:00 AM, every user logs in simultaneously.

```
10,000 users × 100ms bcrypt = 1,000,000ms of CPU work
On a 4-core machine: 250 seconds of CPU-bound processing queued up
```

### Why It Destroys the Monolith

In a monolith, Auth and Booking **run in the same Node.js process**. Node.js is single-threaded. The event loop cannot process booking requests while it is blocked computing bcrypt hashes.

```
Login req #1    → bcrypt (100ms) → event loop blocked
Login req #2    → queued
Login req #3    → queued
...
Booking req #1  → queued behind 9,999 login requests
Booking req #2  → timeout ← user gives up
```

### What Breaks

- Booking API latency spikes from <50ms to 10,000ms+
- Booking requests time out even though the booking service itself has no bug
- CPU sits at 100% on auth — not on the work that matters
- Users who successfully log in still cannot book

### What a Correct System Must Do

Auth and Booking must run in **separate processes** with **separate CPU budgets**. Auth being slow must not affect Booking's ability to serve requests.

---

## Problem 3 — Availability Refresh Storm (Read Flood)

### What Happens

Before booking, users check availability. At 11:00 AM, users are not just booking — they are **repeatedly refreshing the availability screen** to watch the seat count drop in real time.

A single user might send 10–20 availability requests in the first 60 seconds. At 10,000 users:

```
10,000 users × 15 refreshes = 150,000 availability requests in 60 seconds
= ~2,500 req/sec of pure read traffic
```

### Why It Destroys the Monolith

In a monolith backed only by MongoDB, each availability check hits the database:

```
GET /availability → MongoDB query → response
GET /availability → MongoDB query → response (×2,500/sec)
```

MongoDB connection pools saturate. Read operations queue up. The same database connection pool that serves availability requests **also serves booking writes** — so availability reads block booking writes and vice versa.

### What Breaks

- Availability responses slow down from <10ms to 2,000ms+
- Users see stale data or timeouts
- MongoDB CPU spikes from read load, degrading booking write performance
- The "cheap read" becomes the most expensive operation in the system

### What a Correct System Must Do

Availability reads must be served from **Redis** — in-memory, O(1), completely separate from the write path. Availability reads and booking writes must never compete for the same resource.

---

## Problem 4 — Retry Storm (Idempotency Failure)

### What Happens

Network latency is high during a spike. A user sends a booking request. It takes 3 seconds. The user's browser or app retries after 2 seconds. The server is still processing the first request when the second arrives.

```
User sends request #1  → server processing (3,000ms)
User sends request #2  → server creates booking #2 (first request still running)
Request #1 completes   → server creates booking #1
Result: 2 bookings, 2 seats decremented, 1 user
```

### Why It Gets Worse At Scale

At 10,000 users with high latency, assume 30% retry once = 13,000 total booking requests for 10,000 intended bookings. If 10% retry twice = 16,000 requests. The effective load multiplier from retries can be **1.5×–3×** the intended load.

### What Breaks

- Same user holds multiple bookings
- Seat count decremented multiple times for one logical booking
- `available_seats` hits 0 faster than it should
- Ghost bookings appear in the database

### What a Correct System Must Do

Each unique booking attempt must carry an **idempotency key**. The server stores the result of the first request. Any subsequent request with the same key returns the stored result without re-executing the operation.

---

## Problem 5 — Service Isolation Failure (Monolith Single Point of Failure)

### What Happens

In a monolith, every feature lives in the same process. There are no isolation boundaries. If one part of the system consumes excessive resources, **every other part suffers**.

```
Monolith Process
├── Auth handler      → 100% CPU (bcrypt)
├── Booking handler   → starved, queue growing
├── Availability handler → starved, latency rising
└── All share: memory, event loop, connection pool, port
```

### The Failure Cascade

```
Step 1: 10,000 login requests arrive at 11:00:00 AM
Step 2: bcrypt saturates CPU
Step 3: Event loop lag increases from 0ms to 500ms+
Step 4: Availability requests start timing out
Step 5: Booking requests cannot get CPU time
Step 6: Users retry (making it worse)
Step 7: Memory grows from queued requests
Step 8: Process crashes or becomes completely unresponsive
```

### What Breaks

- The entire system becomes unavailable — not just Auth
- Booking service is down because Auth is overloaded, even though Booking itself has no problem
- No way to scale just the struggling component — the whole monolith scales or nothing does
- A single spike in one feature can take down the entire application

### What a Correct System Must Do

Services must run in **separate processes** with **separate resource pools**. Auth being at 100% CPU must not affect Booking's CPU. Kubernetes HPA must be able to scale individual services independently based on their own CPU metrics.

---

## Summary — Failure Matrix

| Problem | Failure Mechanism | Breaks Under | Impact |
|---|---|---|---|
| Double Booking | TOCTOU race condition | >2 concurrent requests for last seat | Data corruption — overselling |
| Auth CPU Spike | bcrypt saturates shared event loop | >500 concurrent logins | All services degrade |
| Availability Refresh Storm | MongoDB read flood saturates connection pool | >500 concurrent refreshes | Reads and writes both slow |
| Retry Storm | No deduplication of duplicate requests | >1 retry per user under load | Ghost bookings, inventory corruption |
| Isolation Failure | Single process, shared resources | Any single service overloaded | Full system unavailable |

---

## What We Are NOT Solving in This Phase

This is an analysis phase — no code, no fixes. We are:

- ✅ Documenting exactly how each failure manifests
- ✅ Identifying the root cause of each problem
- ❌ Not solving them yet (that is Phase 4+)
- ❌ Not benchmarking exact numbers (that is Phase 6 and 14)
- ❌ Not designing the microservice fix yet (that is Phase 7+)

---

## Assumptions

- Failures described are based on a standard single-instance Node.js + MongoDB monolith
- No connection pooling optimizations, no caching, no load balancer in the monolith
- Node.js `bcrypt` (not `bcryptjs`) is used — CPU-bound, not async-offloaded
- All 10,000 users arrive within the same 5-second window at 11:00 AM

---
