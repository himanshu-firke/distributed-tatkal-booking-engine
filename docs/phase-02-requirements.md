# Phase 2 — Requirements
### Distributed Tatkal Booking Engine

---

## Why This Phase Exists

Requirements in a distributed systems project are not a feature list. They are **engineering contracts** — they define the behavioral guarantees the system must uphold under concurrency, failure, and load. Every requirement here exists because it exposes or solves a hard systems problem.

This is 90% architecture-driven and 10% application-driven.

---

## Functional Requirements

Each FR exists to create or solve a specific distributed systems challenge.

### FR-1 — Authentication Load Generator
- Users authenticate via email + password
- Passwords are verified using **bcrypt** (intentionally CPU-bound)
- On success, system issues a signed **JWT token**
- **Architectural purpose:** bcrypt creates CPU saturation during the 11:00 AM spike. In a monolith, this starves the booking service. In microservices, Auth is isolated — its overload does not cascade.

### FR-2 — Seat Availability Check
- Returns current available seat count for a given train
- Must be served from **Redis** (in-memory), not MongoDB
- **Architectural purpose:** This is a high-frequency read workload. Serving it from Redis keeps latency sub-10ms even under thousands of concurrent reads. Demonstrates the read-path optimization that decouples read load from write load.

### FR-2A — Availability Refresh Storm Resilience
- Thousands of users may repeatedly refresh seat availability during the Tatkal window
- Availability requests must remain low latency and must not impact booking correctness
- **Architectural purpose:** Demonstrates read-heavy traffic isolation and Redis-backed read serving under burst load. In a monolith, this refresh storm competes for the same CPU and memory as the booking service. In microservices with Redis, reads are isolated and cheap.

### FR-3 — Atomic Seat Reservation
- Authenticated users can attempt to reserve a seat
- System must atomically check-and-decrement the seat counter
- If seats are exhausted, the request must be rejected immediately — no queuing
- **Architectural purpose:** This is the core race condition problem. Without atomicity, two concurrent requests both see "1 seat available" and both succeed. Redis `DECR` guarantees atomic inventory decrement. Booking creation must remain consistent with that inventory state.

### FR-4 — Idempotent Booking
- Each booking request must carry a client-generated **idempotency key**
- If the same key is received twice (retry storm), the system returns the original response without creating a duplicate booking
- **Architectural purpose:** Under load, clients retry. Without idempotency, retries create ghost bookings and corrupt seat counts. This requirement forces the implementation of stateful deduplication via Redis TTL keys.

### FR-5 — Service Fault Isolation
- The Booking service must remain operational even if the Auth service is overloaded or down
- JWT verification in the Booking service must not depend on a live call to the Auth service
- **Architectural purpose:** Stateless JWT validation (verify signature locally) eliminates Auth as a synchronous dependency for Booking. This is the key microservice isolation demonstration.

---

## Non-Functional Requirements

These are the hardest constraints to satisfy. Meeting them is the actual engineering challenge.

| NFR | Requirement | Target | Why It Matters |
|---|---|---|---|
| **Consistency** | Zero overselling | Exactly 0 extra bookings | The fundamental correctness guarantee |
| **Atomicity** | Seat decrement is atomic | No TOCTOU race | Requires Redis `DECR`, not read-then-write |
| **Latency — Reads** | Availability check latency | < 50ms p99 | Redis-backed; must not degrade under login flood |
| **Latency — Writes** | Booking confirmation latency | < 500ms p95 | Acceptable under spike conditions |
| **Throughput** | Survive a Tatkal-style burst without violating consistency | Measured via k6 benchmarks | Exact number depends on hardware; correctness is non-negotiable |
| **Scalability** | Horizontal pod scaling | 1 → 5 pods via HPA | Kubernetes HPA at 50% CPU threshold |
| **Fault Isolation** | Auth down → Booking unaffected | Booking uptime ≥ 99% | Stateless JWT; no Auth dependency at runtime |
| **Idempotency** | Duplicate requests → 1 booking | Zero ghost bookings | Redis idempotency key with TTL |
| **Correctness** | 500 users, 50 seats → 50 bookings | Exact count, no deviation | End-to-end load test validation |

---

## Concurrency Model Requirements

This section defines how the system must behave when multiple requests arrive simultaneously — the hardest part of the system to get right.

| Scenario | Required Behavior |
|---|---|
| 2 users, 1 seat remaining | Exactly 1 succeeds, 1 receives `409 Seat Unavailable` |
| 1,000 users, 500 seats | Exactly 500 succeed, 500 receive `409` |
| Same user sends 3 duplicate booking requests | Exactly 1 booking created, same response returned for all 3 |
| Auth service at 100% CPU | Booking service continues accepting and processing requests |
| Booking service pod crashes mid-request | In-flight request fails; seat count already decremented — acceptable for V1 |

---

## System Behavior Under Load

The system must exhibit predictable **degradation**, not collapse.

- **Graceful rejection:** When seats are sold out, new requests receive an immediate `409` — not a timeout
- **No cascading failure:** Auth overload must not propagate to Booking or Seat services
- **Stable state:** After the Tatkal window closes, total confirmed bookings must equal exactly the seat inventory — no more, no less

---

## API Surface (Minimal)

Only the endpoints required to demonstrate the architectural problems.

| Method | Endpoint | Auth Required | Architectural Purpose |
|---|---|---|---|
| POST | `/auth/login` | No | Generates bcrypt CPU load |
| GET | `/seats/availability` | No | High-frequency Redis read |
| POST | `/bookings` | JWT | Atomic reservation + idempotency |

> No registration endpoint is required for load testing (users are pre-seeded).
> No view/update/delete endpoints are required — this is not a CRUD application.

---

## Explicitly Out of Scope

The following are intentionally excluded. They add application complexity without advancing the distributed systems learning objectives.

| Excluded | Reason |
|---|---|
| Frontend (React, Angular, any UI) | Backend architecture project — no UI layer |
| Payment gateway or billing | Adds state machine complexity without concurrency value |
| Booking cancellation / refund | Not relevant to the race condition or scaling problem |
| Seat preference selection | Business logic, not systems architecture |
| Multi-train or multi-date support | One resource contention scenario is sufficient |
| Waitlists or queuing | Deliberate exclusion — we demonstrate rejection, not queuing |
| Admin dashboard | No management interface needed |
| Email / SMS notifications | Infrastructure concern, out of scope |
| Real IRCTC integration | This is a controlled simulation environment |
| Kafka, Event Sourcing, CQRS | Deliberate exclusion per project charter |

---

## Future Enhancements (V2+)

The following patterns are valid distributed systems concepts but are intentionally deferred. They belong to a more complex reservation lifecycle (closer to airline systems) than the Flash Sale model this project is based on.

| Enhancement | Description | Why Deferred |
|---|---|---|
| Seat Lock TTL | Reserve a seat with a TTL; auto-release if booking not confirmed | Adds reservation state machine complexity not required for V1 |
| Reservation Recovery | Re-credit inventory when TTL expires mid-flow | Requires TTL lock to be in place first |
| Waitlist Queue | Queue users when seats are exhausted | Changes the problem from rejection-based to queue-based |

---

## Requirements Traceability

Every requirement maps directly to a scale problem from Phase 1.

| Requirement | Maps To |
|---|---|
| FR-1 bcrypt Authentication | Problem 2 — Auth CPU Spike |
| FR-2 Redis Availability Read | Problem 3 — Traffic Spike |
| FR-2A Refresh Storm Resilience | Problem 3 — Traffic Spike (read path) |
| FR-3 Atomic Seat Reservation | Problem 1 — Double Booking |
| FR-4 Idempotent Booking | Problem 4 — Retry Storm |
| FR-5 Service Fault Isolation | Problem 5 — Service Isolation |
| NFR Scalability (HPA) | Problem 3 — Traffic Spike |
| NFR Consistency / Atomicity | Problem 1 — Double Booking |

---
