# TrueBid UI Phase — Design Packet (M1)

**Status:** Complete — 9 of 9 contracts drafted (3 approved, 6 pending Lapedra review)
**Date:** 2026-07-13
**Owner:** Lapedra; architecture review in Claude chat session

This packet is the complete spec for the M1 UI rebuild. It goes to Claude Design for the wireframe-fidelity IA pass (M1 spec, explicitly no visual polish), and to CC as the build spec. Nothing gets built that isn't in a contract; no contract changes without Lapedra's approval.

## Packet contents

| Document | Role | Status |
|---|---|---|
| `NARRATIVE.md` | The user journey — what the UI must make true | Approved |
| `PRINCIPLES.md` | Design judgment — what good looks like | Approved |
| `contracts/` | Per-screen law — reads, commands, states, exclusions | 3 of 9 approved |
| `KEEP-LIST.md` | Patterns harvested from the old UI | Approved |
| IA skeleton | Below | Approved |

## IA Skeleton

Three sections (decided pre-packet; a constraint, not a question):

### Scope — what the document says
1. Document set management — `contracts/scope-document-set.md` (pending review)
2. **Extraction review & confirm** — `contracts/scope-extraction-review-confirm.md` ✓

### Staff — what the work is and who does it
3. **WBS editor** — `contracts/staff-wbs-editor.md` ✓
4. Staffing & roles detail — `contracts/staff-staffing-roles-detail.md` (pending review)
5. Scenario & pricing view — `contracts/staff-scenario-pricing.md` (pending review)

### Deliver — the immutable record
6. **BOE generation & artifacts** — `contracts/deliver-boe-generation-artifacts.md` ✓
7. Snapshot & share management — `contracts/deliver-snapshot-share.md` (pending review)

### External (token links, no login)
8. Director WBS review — `contracts/external-director-wbs-review.md` (pending review)
9. Accountant read-only BOE — `contracts/external-accountant-boe.md` (pending review)

Contracts 7–9 largely compose patterns defined in contracts 2, 3, and 6 (badges, gate checklists, trace panels, provenance headers) with reduced command sets.

## Backend prep (prerequisite branch, via PR gate)

Two additions before Scope/Staff screens can build, both extraction-side:

1. `intelligence_versions.solicitation_brief` — Zod-schema'd structured field (summary, rationale, challenges[], evaluation_emphasis); generated at extraction; versioned/superseded with the intelligence; frozen on confirm. Explicitly ruled extraction-side summarization (P4A), not a writing-subsystem violation.
2. AI-proposed task↔requirement links via the existing candidate-accept flow, each proposal carrying its suggesting evidence.

## Standing rules for this phase

- All work on feature branches through the PR gate; Lapedra approves merges; direct pushes to develop are blocked for all credentials including admin.
- Claude Design first pass = M1 IA/wireframes only. M2 (visual system) is a separate pass after M1 screens work.
- If a design idea requires a new read or command, it goes back through contract revision — it is not a design decision.
- M1 acceptance: the full lifecycle runs end-to-end on PM-HCD with real requirement links, and the Staff pricing view's total equals the generated artifact's total because they are the same number from the same source.

## Open items carried into this phase

- Staff-tab 7-roles/$2.28M delta (from old UI) — expected to be resolved or explained by construction when the new Staff screens render single-source; verify during M1 acceptance.
- Legacy live-data share links — flagged deprecated; migration to artifact/snapshot links during M1.
- PM-HCD requirement_links seeding — required before first real BOE generation; the WBS editor's link-review workflow is the intended path.
