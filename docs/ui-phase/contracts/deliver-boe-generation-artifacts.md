# Screen Contract: Deliver → BOE Generation & Artifacts

**Status:** Approved by Lapedra, 2026-07-13
**Section:** Deliver
**Gate complexity:** High — fires the generation gates

---

## Purpose

Where verified work becomes an immutable record. The user generates BOE artifacts from the approved scenario, reviews them, creates the submission snapshot, and manages share links. This screen fires the gates that Scope and Staff predicted — and because they predicted them, arriving here with blockers should be rare and never surprising.

## Reads (exhaustive)

| Data | Source | Rule |
|---|---|---|
| Generated artifacts | `boe_artifacts` for the proposal | Status badges: generated / superseded |
| Artifact content | `boe_artifacts.content` | Rendered read-only from the immutable JSONB — never recomputed live |
| Citations | `boe_citations` per artifact | Per-line evidence, navigable to requirement + source quote |
| Snapshots | `proposal_snapshots` | With composite hash displayed |
| Share links | `boe_share_links` | Showing whether each resolves to artifact / snapshot / (legacy live — flagged deprecated) |
| Generation preconditions | confirmed intelligence status, active WBS, approved scenario, citation coverage | For the pre-flight panel |

**Hard exclusion:** the artifact viewer renders stored content only. No live joins back to `pricing_lines` "for freshness" — the entire point of an artifact is that it doesn't change. Freshness is expressed by generating a new artifact, never by mutating the view.

## Commands (exhaustive)

- `GenerateBOEArtifact`
- `CreateProposalSnapshot`
- Create / revoke share link (pointing at artifact or snapshot)
- Supersede artifact (status transition only — content untouched, per the IMM5/IMM6 triggers)

## States the screen must represent

1. **Pre-flight panel** (before any generation): the four gate conditions as a live checklist — intelligence confirmed ✓/✗, WBS active ✓/✗, scenario approved ✓/✗, all wbs_estimate lines cited ✓/✗ — each ✗ linking to the screen that fixes it. Generate button mirrors the Scope pattern: blocked-with-count, never dead-button-then-error.
2. **CITATION_INCOMPLETE surfaced structurally** — if generation fails anyway, the error payload (lineId, task, role, period, what's missing) renders as an actionable worklist with deep links into the WBS editor, filtered to the offending tasks. The Phase 6B error shape was designed for exactly this rendering.
3. **Artifact viewer** — the document: sections, line tables with cost/fee breakout, per-line calc traces (the keeper panel, from `content.calcTrace`), conservation status, content hash. Provenance header: generated when, by whom, from which intelligence version / WBS version / scenario, engine version.
4. **Generation succeeded** → new artifact appears; prior artifact for the same triple shows superseded automatically (the partial unique index enforces one generated per triple).
5. **Snapshot creation** — select artifacts, see the composite hash computed, label it. Post-creation: snapshot is visibly locked, hash prominent. Copy says what it is: "the as-submitted record."
6. **Share link management** — per link: what it resolves to, created when, revocation control. Legacy live-data links flagged for migration.

## Trust presentation

Hashes, engine version, and provenance are *content* here, not metadata footnotes. A director opening a share link should see, without hunting: this is artifact `6d0e17…`, generated from confirmed intelligence `hash…`, totals conserve, every line cites. That's the Pentagram-benchmark challenge for M2 — making cryptographic provenance feel like quality rather than clutter — but M1 just has to put the facts on the page.

## Explicitly not on this screen

Editing anything upstream. No narrative/prose sections (writing subsystem frozen — artifact viewer renders structure only, which is all 6B artifacts contain). Scenario approval lives in the pricing view, not here.
