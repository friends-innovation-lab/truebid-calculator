# Screen Contract: Scope → Extraction Review & Confirm

**Status:** Approved by Lapedra, 2026-07-13
**Section:** Scope
**Gate complexity:** High — contains the Confirm gate

---

## Purpose

The human gate between AI extraction and everything downstream. The user reviews what the AI extracted from the document set, resolves anything unclear, and confirms — creating the immutable, hashed intelligence version that WBS, pricing, and BOE all build on. This screen is where the failed July 13 ceremony happened; its job is to make that failure mode impossible to hit blindly.

## Reads (exhaustive — nothing else may be rendered)

| Data | Source | Rule |
|---|---|---|
| Draft intelligence under review | `intelligence_versions` where status=`draft` | Only when explicitly in review mode |
| Currently confirmed version | `intelligence_versions` where id = proposal's `active_intelligence_version_id` AND status=`confirmed` | The default view; never renders draft data outside review mode |
| Solicitation brief | `intelligence_versions.solicitation_brief` (new field — backend prep) | Renders from whichever version is being viewed |
| Fact evidence | `fact_evidence` for the viewed version | Verbatim quotes, linked from brief challenge cards |
| Source documents | document set for the proposal | Classified pws/instructions/qa with precedence shown |

**Hard exclusion:** no read may merge draft and confirmed data in one display. The Bug1/Bug2 class of failure — draft values bleeding into panels presented as current — is a contract violation, not a styling issue.

## Commands (exhaustive)

- `CreateIntelligenceDraft` (supersede — full field copy, per the Bug2 fix)
- Draft field edits: utilization, hours/mo, contract type, staffing model resolution
- `ConfirmIntelligence` — the gate
- Discard draft

## States the screen must represent

1. **No intelligence yet** → EmptyState, upload-first
2. **Confirmed, no draft** → read-only view of confirmed version, hash visible, "Supersede" as the only mutation path
3. **Draft in review** → explicit review mode: banner making unmistakable that values shown are unconfirmed; side-by-side or diff view against the prior confirmed version (what changed in this supersede)
4. **Draft with blockers** → the ceremony fix. Every condition that will fail `ConfirmIntelligence` is surfaced *as a checklist on the screen, before the button is pressed*: staffing model unresolved, missing utilization, missing hrs/mo per role. Each blocker names the field and offers the control to fix it inline. The Confirm button shows blocked state with count ("Confirm — 2 items need resolution"), not a dead button that errors on click.
5. **Confirm in flight / succeeded** → hash displayed on success; screen transitions to state 2

**The design rule state 4 encodes:** the July 13 failure wasn't that confirm was blocked — blocking was correct. It was that the *reason* was invisible and the *fix* (the resolver control) wasn't discoverable. Gates must be legible before they're hit.

## Keepers rendered here

- **Period structure table** — periods, months, cumulative, GSA year; from the viewed version's confirmed/draft periods
- **Solicitation brief** — What They Want / Why It Matters / Key Challenges / Evaluation Emphasis; challenge cards cite `fact_evidence` with verbatim quotes, tap-to-see-source

## Explicitly not on this screen

WBS, staffing assignments, pricing, totals of any kind. Scope is about *what the document says*, not what it costs. (The old UI's roles-with-hours panel on the Scope tab is part of how the phantom-draft confusion happened — role/utilization review belongs to draft review here only as intelligence facts, and everything cost-shaped lives in Staff.)

## Ratified decisions

1. **Blocker checklist (state 4) is a requirement, not a suggestion** — ratified 2026-07-13. It encodes the ceremony lesson directly.
2. **Diff view on supersede (state 3)** — ratified 2026-07-13. Makes the Bug2 class (fields silently dropped during supersede) user-visible.

## Backend dependencies

- `intelligence_versions.solicitation_brief` — new Zod-schema'd field (summary, rationale, challenges[], evaluation_emphasis), generated at extraction, versioned/superseded with the intelligence, frozen on confirm. Ruled as extraction-side summarization (P4A territory), NOT a writing-subsystem violation — it describes the document, it does not draft the proposal. This ruling is explicit, not ambient.
