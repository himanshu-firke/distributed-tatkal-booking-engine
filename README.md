# Distributed Tatkal Booking Engine

A backend-only distributed systems project that simulates the Tatkal railway booking rush — where 10,000 users attempt to book 500 seats at exactly 11:00 AM.

Built to learn and demonstrate: concurrency control, atomic operations, service isolation, Docker, Kubernetes, and horizontal autoscaling.

---

## What This Project Is

| ✅ This IS | ❌ This is NOT |
|---|---|
| A backend architecture project | A frontend or UI project |
| A distributed systems learning project | A production IRCTC clone |
| A concurrency and scaling demonstration | A Kafka / Event Sourcing project |
| A Monolith → Microservices evolution | A full railway reservation system |

---

## The Problem

At 11:00:00 AM, Tatkal booking opens. Thousands of users simultaneously:
1. Refresh seat availability
2. Login (bcrypt CPU spike)
3. Attempt to book the same limited seats

**Core engineering challenges:**
- 🔴 Double booking (race condition)
- 🔴 Auth CPU starving the booking service
- 🔴 Traffic spike (20× normal load in seconds)
- 🔴 Retry storms corrupting booking state
- 🔴 No service isolation in a monolith

---

## Architecture Evolution

```
Phase 1–6   →   Monolith (Node.js + Express + MongoDB)
Phase 7–9   →   Microservices (Auth + Seat + Booking + API Gateway)
Phase 10    →   Architecture Decision Records
Phase 11–12 →   Docker + Kubernetes + HPA
Phase 13–14 →   k6 Load Testing + Benchmark Report
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB |
| Cache / Atomic Ops | Redis |
| Containerization | Docker |
| Orchestration | Kubernetes (local — Minikube) |
| Load Testing | k6 |

---

## Repository Structure

```
distributed-tatkal-booking-engine/
├── docs/                    ← Phase-by-phase documentation
│   ├── README.md            ← Documentation index
│   ├── phase-01-problem-statement.md
│   ├── phase-02-requirements.md
│   └── ...
├── images/                  ← Case study screenshots
│   └── irctc-high-load-error.png
├── prd/                     ← Original PRD
│   └── Distributed Tatkal Booking Engine.pdf
└── src/                     ← Source code (added in Phase 5+)
```

---

## Documentation

| Phase | Document | Status |
|---|---|---|
| 1 | [Problem Statement](./docs/phase-01-problem-statement.md) | ✅ |
| 2 | [Requirements](./docs/phase-02-requirements.md) | ✅ |
| 3 | Problems At Scale | 🔜 |
| 4 | Monolith Architecture | 🔜 |
| 5 | Monolith Implementation | 🔜 |
| 6 | Monolith Failure Report | 🔜 |
| 7 | Service Boundaries | 🔜 |
| 8 | Microservice ER & Sequence Diagrams | 🔜 |
| 9 | Microservice Architecture & API Design | 🔜 |
| 10 | Architecture Decision Records | 🔜 |
| 11 | Docker & Kubernetes Architecture | 🔜 |
| 12 | Microservice Implementation | 🔜 |
| 13 | Load Testing Plan | 🔜 |
| 14 | Benchmark Report | 🔜 |

---

## Real-World Motivation

> While attempting to book a Tatkal ticket at 11:00 AM, I personally encountered repeated **"We are experiencing High Load - Please retry"** errors. This project was built to understand and simulate the backend engineering challenges behind that failure.

![IRCTC High Load Error](./images/irctc-high-load-error.png)

---

## Key Engineering Decisions

- **Redis atomic `DECR`** prevents overselling — not MongoDB
- **Stateless JWT** eliminates Auth as a runtime dependency for Booking
- **Idempotency keys** prevent ghost bookings from retry storms
- **Kubernetes HPA** scales services independently under load
- **Monolith-first** approach intentionally surfaces the bottlenecks before solving them

---

*This repository tells the story: Problem → Monolith → Failure → Microservices → Kubernetes → Autoscaling → Results*
