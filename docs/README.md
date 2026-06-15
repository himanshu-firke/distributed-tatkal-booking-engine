# Documentation Index
### Distributed Tatkal Booking Engine

All engineering documentation is organized by category and built phase-by-phase.

---

## 🟢 Foundation

| Phase | Document | Status |
|---|---|---|
| 1 | [Problem Statement](./phases/phase-01-problem-statement.md) | ✅ Done |
| 2 | [Requirements](./phases/phase-02-requirements.md) | ✅ Done |
| 3 | [Problems At Scale](./phases/phase-03-problems-at-scale.md) | ✅ Done |

## ⏳ Monolith

| Phase | Document | Status |
|---|---|---|
| 4 | [Monolith Architecture](./phases/phase-04-monolith-architecture.md) | ✅ Done |
| 5 | [Monolith Implementation](./phases/phase-05-monolith-implementation.md) | ✅ Done |
| 6 | [Monolith Failure Report](./phases/phase-06-monolith-failure-report.md) | ✅ Done |

## ⏳ Microservices

| Phase | Document | Status |
|---|---|---|
| 7 | [Service Boundaries](./phases/phase-07-service-boundaries.md) | 🚧 In Progress |
| 8 | Microservice Architecture | Coming Soon |
| 9 | Architecture Decision Records | Coming Soon |

## ⏳ Infrastructure

| Phase | Document | Status |
|---|---|---|
| 10 | Docker Architecture | Coming Soon |
| 11 | Kubernetes Deployment | Coming Soon |
| 12 | Autoscaling & HPA | Coming Soon |

## ⏳ Validation

| Phase | Document | Status |
|---|---|---|
| 13 | Load Testing Plan | Coming Soon |
| 14 | Benchmark Report | Coming Soon |

---

## Folder Guide

| Folder | Contents |
|---|---|
| `phases/` | All phase documents (markdown) |
| `diagrams/` | Architecture diagrams — monolith, microservice, ER, sequence, K8s (Phase 4+) |
| `adr/` | Architecture Decision Records (Phase 9) |
| `benchmark/` | k6 load test results and comparison tables (Phase 14) |
| `case-studies/` | Real-world IRCTC observations |

---

## Document Format Guide

| Content Type | Format | Why |
|---|---|---|
| Phase documents | `.md` (Markdown) | Readable on GitHub, diffable, version-controlled |
| Architecture diagrams | Mermaid in `.md` + exported `.png` | Mermaid renders on GitHub; PNG for embedding |
| ER diagrams | Mermaid in `.md` + exported `.png` | Same as above |
| Sequence diagrams | Mermaid in `.md` | GitHub renders natively |
| Benchmark tables | `.md` with tables | Easy to compare side-by-side |
| Case studies | `.pdf` | Preserves formatting of external observations |
| Screenshots | `.png` in `images/` | Referenced from phase docs |

---

## Who Reads What

| Reader | What They Read | Time |
|---|---|---|
| **Recruiter** | Root README — overview, tech stack, architecture evolution diagram | 1–2 min |
| **Hiring Manager** | Root README + Phase 1 (problem) + Phase 6 (failure report) + Phase 14 (benchmarks) | 5–10 min |
| **Senior Engineer** | Phase 3 (scale problems) + Phase 9 (ADRs) + Phase 14 (benchmarks) + source code | 20–30 min |

---

## Diagram Plan

All diagrams will live in `docs/diagrams/` and be referenced from phase documents.

| Diagram | Created In | Format |
|---|---|---|
| Monolith Architecture | Phase 4 | Mermaid + PNG |
| Monolith ER Diagram | Phase 4 | Mermaid + PNG |
| Login Sequence | Phase 4 | Mermaid |
| Booking Sequence | Phase 4 | Mermaid |
| Concurrent Booking Sequence | Phase 4 | Mermaid |
| Microservice Architecture | Phase 8 | Mermaid + PNG |
| Service Communication | Phase 8 | Mermaid |
| Kubernetes Deployment | Phase 11 | Mermaid + PNG |
| HPA Autoscaling Flow | Phase 12 | Mermaid |

---
