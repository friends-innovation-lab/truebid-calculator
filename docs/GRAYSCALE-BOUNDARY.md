# Grayscale — Engine Boundary Document

**Status:** Draft v1 for Lapedra review
**Date:** July 14, 2026
**Purpose:** Define what Grayscale is, where the boundary sits between Grayscale (the engine) and TrueBid (the application), and the approved external language. This document describes the system as actually built — it is not a spec and does not authorize new work.

---

## 1. What Grayscale Is

Grayscale is the estimating intelligence engine underneath TrueBid. It is the proprietary system of data models, gates, deterministic calculations, traceability, and human-approval controls that turns government solicitation documents into defensible staffing, pricing, and Basis of Estimate outputs.

Grayscale is **not** a foundation model. It uses Claude for language reasoning — document interpretation, requirement extraction, WBS proposal, drafting. What Friends owns is everything around the model: the workflow, the schemas, the business rules, the estimating controls, the audit trail, and the guarantee that every number in a proposal traces to a source and reconciles to the penny.

The one-line internal definition:

> **Claude reasons. Grayscale decides how reasoning becomes a defensible estimate. The user approves.**

## 2. The Boundary

**Inside Grayscale (the engine):**

- The domain data model: versioned contract intelligence, normalized requirements with evidence, WBS tasks, staffing, pricing scenarios, BOE artifacts, snapshots
- The command layer — every state change is a named command with an audit event
- The gates (Section 4) — server-enforced, not UI conventions
- The single pricing engine with per-line calculation traces
- The AI orchestration pattern: structured outputs, prompt/knowledge separation, single-responsibility prompts, candidate-accept for all AI proposals
- Canonical serialization and the SHA-256 confirmation hash (append-only invariant, golden-file regression protected)
- The conservation and reconciliation rules
- Tenancy and row-level security
- Immutability at the artifact layer

**Inside TrueBid (the application):**

- The Scope / Staff / Deliver interface and navigation
- Review and editing workflows (the human side of candidate-accept)
- Token-based external views (director WBS review, accountant BOE read-only)
- Exports, share links, notifications
- Company configuration surfaces (role catalog, rates, writing guide)

The test for which side something belongs on: **if it would have to exist in any product built on this engine, it's Grayscale. If it's how FFTC's users touch it, it's TrueBid.**

## 3. The Nine Functions — As Implemented

| # | Function | Implementation in TrueBid today |
|---|----------|--------------------------------|
| 1 | Solicitation intelligence | Multi-document ingestion with type classification; versioned `intelligence_versions` with draft → confirmed → superseded lifecycle; `solicitation_brief` (structured summary with `fact_evidence` citations); SHA-256 confirmation hash freezes the confirmed structure |
| 2 | Requirement normalization | Precedence-based fact merge across documents (amendments and Q&A override base documents); `fact_evidence` linking extracted facts to source; requirement records with `requirement_links` to tasks |
| 3 | WBS generation | Normalized WBS with parent-child hierarchy; AI proposes via candidate-accept — nothing enters the active WBS without human acceptance; discipline constraints from confirmed intelligence are hard constraints on generation |
| 4 | Estimating logic | Per-line labor estimates with stored rationale; all arithmetic in the deterministic pricing engine, never the model *(gap: formal estimating-method ontology — see Section 6)* |
| 5 | Role / LCAT mapping | Curated tenant role catalog (27 roles) as controlled input; prescribed-staffing constraints with role-level validation; user overrides via command layer with audit events |
| 6 | Periodization | Base and option periods as first-class entities; hours and pricing computed per period; GSA rate-year mapping from cumulative months of performance |
| 7 | Pricing rules | Single pricing engine; wrap-rate cascade (fringe → OH → G&A → fee) applied deterministically; per-line calculation traces; three-way rate source (Internal / GSA MAS / Sub); conservation gate — component sums must equal totals or generation is blocked |
| 8 | BOE generation | Immutable `boe_artifacts` generated only from approved structured data; `boe_citations` — every estimate line must cite a requirement (hard generation gate); DCAA-style fee decomposition at the artifact layer; `proposal_snapshots` with composite hash; share links point to frozen artifacts, never live tables |
| 9 | Traceability & validation | Source document → intelligence version (hashed) → requirement → WBS task → staffing line → priced line (with trace) → cited BOE artifact; audit events on every command; optimistic concurrency; artifacts reproducible from stored data |

## 4. The Gates (What Makes It an Engine, Not a Wrapper)

These are server-enforced invariants. They exist regardless of which UI, or which AI model, sits on top.

1. **Confirmation gate.** Nothing downstream generates until a human confirms the extracted contract intelligence. Confirmation is sealed with a SHA-256 hash over a canonical serialization; a mutated structure invalidates the hash.
2. **Candidate-accept.** Every AI proposal (WBS tasks, requirement links, staffing) lands as a candidate. Human acceptance is the only path into active data. AI proposes, human accepts, gates are announced — not discovered.
3. **Citation gate.** A BOE artifact cannot be generated while any estimate line lacks a requirement citation.
4. **Conservation gate.** Cost + fee must equal total, per line and in aggregate, to the penny, or the operation is blocked.
5. **Immutability.** Generated artifacts and snapshots are frozen by database trigger. Change means supersede, never edit.
6. **One source per number.** Every displayed figure has exactly one computation path. No parallel client-side math.
7. **Audit completeness.** Every state change is a named command with an actor, a timestamp, and an event. Overrides carry reasons. Prior versions are retained.

## 5. External Language (Approved Claims)

**Primary:**

> TrueBid is powered by Grayscale, our proprietary estimating intelligence engine. Grayscale combines leading AI models with structured estimating methods, deterministic calculations, source-level traceability, and human approval controls to turn solicitation requirements into defensible WBS, staffing, pricing, and Basis of Estimate outputs.

**Short:**

> Powered by Grayscale, the estimating intelligence engine for government proposals.

**DCAA positioning — use:** "supports audit-ready estimating," "strengthens estimating controls and traceability," "documented Basis of Estimate support," "every number traces to a source."

**DCAA positioning — never use:** "DCAA compliant," "DCAA certified," or any claim that the software makes a company's estimating system compliant. Compliance depends on company policies, practices, and records, not software alone. Stronger claims require a formal control mapping reviewed by a GovCon accounting specialist.

**Never claim:** that Grayscale is a proprietary AI model, that Friends trains its own models, or that estimates are produced autonomously.

## 6. Known Gaps (Grayscale Roadmap, Post-M1)

Three areas where the engine's current implementation is thinner than the full Grayscale definition. These are roadmap items, not current work.

1. **Estimating-method ontology.** Store the named method (engineering / analogous / parametric / historical / expert), its inputs, and its formula as structured domain data per estimate line — so the calculation is reproducible from inputs, not just recorded as a trace and rationale. Highest DCAA-defensibility value of the three.
2. **Requirement provenance.** Formally tag each requirement as explicitly required / implied by outcome / added by bidder approach / assumed due to solicitation gaps. Drives BOE language precision ("the Government requires" vs. "we assume").
3. **Period allocation patterns.** Name the distribution pattern (recurring, front-loaded, declining, one-time, surge) as a taxonomy rather than only storing the resulting hour distribution.

## 7. What This Document Does Not Authorize

- No schema changes to match any external sketch of a Grayscale data model. The implemented schema is the authoritative one.
- No re-audit of the codebase against the Grayscale concept. The January 8 technical audit and CLAUDE.md carry current state.
- No new workstream during M1. Grayscale is a name and a boundary drawn around what exists; the Section 6 gaps queue behind M1 acceptance.
