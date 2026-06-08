# Phase 1 — Problem Statement
### Distributed Tatkal Booking Engine

---

## Why This Phase Exists

Before writing a single line of code, we must clearly define **what problem we are solving** and **why it is hard**. Without this, we risk building a technically impressive system that solves the wrong problem. Every architectural decision in the phases ahead traces back to this document.

---

## The Business Scenario

Every day at **11:00 AM**, Indian Railways opens Tatkal quota booking. At that exact second, thousands of users flood the system simultaneously — all competing for a small number of reserved seats.

| Parameter | Value |
|---|---|
| Route | Mumbai → Delhi |
| Total Tatkal Seats | 500 |
| Simulated Concurrent Users | 10,000 |
| Booking Window Opens | 11:00:00 AM exactly |
| Expected Successful Bookings | 500 |
| Expected Rejected Requests | ~9,500 |

This is not a sustained load problem. It is a **sudden, synchronized spike** — like a flash sale — where demand (10,000) is 20× greater than supply (500) and it all hits within seconds.

---

## Real-World Observation — Availability Refresh Storm

While attempting to book a Tatkal ticket at exactly **11:00 AM**, I personally experienced the following sequence:

1. Selected source and destination station
2. Searched available trains
3. Opened a specific train and Tatkal quota
4. Clicked **Refresh** repeatedly to check latest seat availability
5. Attempted to view available seats the moment the Tatkal window opened

Instead of receiving seat availability data, the application repeatedly displayed:

> **"We are experiencing High Load - Please retry"**

This happened multiple times within the first 60 seconds of the Tatkal window.

**Screenshot — IRCTC at 11:00 AM (Tatkal window):**

![IRCTC High Load — multiple "We are experiencing High Load - Please retry" errors stacked on screen](../../images/irctc-high-load-error.png)

> *Screenshot captured during a live Tatkal booking attempt. Each yellow alert box is a separate "High Load" error returned by the IRCTC server within seconds of the window opening.*

### Availability Refresh Storm

This is not simply "too many users." It is a specific failure pattern:

- At 11:00:00 AM, thousands of users simultaneously **refresh the availability page** — before attempting to book
- This creates a sudden burst of **read requests** that is orders of magnitude above normal traffic
- The availability service — which should be a cheap, fast read — becomes the **first bottleneck**
- Under a monolith, this refresh storm **competes for the same CPU and memory** as the booking service

**Questions this project will investigate:**

- Can the Availability Service survive a sudden refresh storm without degrading?
- Can availability read latency stay low even when booking load is simultaneously high?
- Can availability requests remain isolated from booking write operations?
- Does serving availability from Redis (in-memory) prevent the storm from cascading?

This real-world observation became one of the primary motivations for building the Distributed Tatkal Booking Engine.

📄 **Full Case Study:** [Availability Refresh Storm Analysis](../case-studies/Availability%20Refresh%20Storm%20Analysis.pdf)

---

## The 5 Core Engineering Problems

### Problem 1 — Double Booking (Race Condition)
Two users check availability simultaneously. Both see "1 seat available." Both send a booking request. Without concurrency control, **both succeed** and the seat is sold twice.

> **This is the hardest correctness problem. Everything else is secondary to this.**

---

### Problem 2 — Auth CPU Spike
`bcrypt` password hashing is intentionally slow (CPU-bound). When 10,000 users log in simultaneously, the login handler consumes all available CPU — leaving **zero cycles** for the booking API.

> In a monolith, Auth and Booking **share the same process**. One starves the other.

---

### Problem 3 — Traffic Spike
Normal system load might be ~100 req/sec. Tatkal traffic arrives as thousands of req/sec **for 60–120 seconds**, then drops. A static single-server architecture cannot absorb this burst.

---

### Problem 4 — Retry Storm
A user clicks "Book" and sees a loading spinner. Due to network delay, they click again. The server receives **2–5 duplicate requests** per user. Multiply by 10,000 users.

> Without idempotency, retries create ghost bookings, double charges, and corrupted state.

---

### Problem 5 — Service Isolation Failure
In a monolith, if Auth is overloaded, Booking is also starved — they share the same process, port, memory, and CPU. There is no isolation boundary.

> We want to demonstrate that microservices allow Auth to degrade **without affecting Booking**.

---

## What We Are NOT Solving

| Out of Scope | Why |
|---|  ---|
| Payment Processing | Adds complexity without teaching new distributed concepts |
| Train Scheduling / PNR | Not relevant to the concurrency problem |
| Seat Selection (berth preference) | Business logic, not systems architecture |
| Frontend / UI | This is a backend architecture project |
| Kafka / Event Sourcing / CQRS | Deliberate exclusion — adds complexity without serving the learning goals |
| Multi-route / multi-train | One route keeps the problem focused |
| Real IRCTC Integration | This is a simulation, not a production clone |

---

## Assumptions

- All 10,000 users are **pre-registered** before the Tatkal window opens. Load testing does not include registration load.
- The system runs on **local Kubernetes** (Minikube or kind) — not cloud.
- One train, one date, one journey is sufficient to demonstrate all concurrency and scaling concepts.
- JWT tokens are **short-lived** (15 minutes). No refresh token complexity.
- "Booking" means reserving a seat. No payment, no PNR generation, no ticket printing.

---

## Tradeoffs We Are Accepting

| Decision | Tradeoff |
|---|---|
| Monolith first | We deliberately build something that will fail, to understand *why* it fails |
| MongoDB over PostgreSQL | Familiar in Node.js ecosystem; fits document model; ACID at document level is sufficient |
| Redis for seat inventory | Trades some durability for speed and atomic operations |
| Kubernetes locally | Adds operational overhead, but teaches real HPA behavior |
| Simple API Gateway (Express proxy) | Not production-grade; sufficient for demonstrating routing and isolation |

---

## The Story This Project Tells

```
Traffic Spike → Monolith Bottleneck → Race Condition → Failure
       ↓
Service Isolation → Redis Atomicity → Idempotency → Correct Bookings
       ↓
Docker → Kubernetes → HPA → Autoscaling Under Load
```

Every architectural decision in the phases ahead exists to solve **one of the 5 problems** defined above.

---
