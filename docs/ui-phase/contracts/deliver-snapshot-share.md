# Screen Contract: Deliver → Snapshot & Share Management

**Status:** Draft for Lapedra review, 2026-07-13
**Section:** Deliver
**Gate complexity:** Low-medium — snapshot creation is a signature; sharing is administrative

---

## Purpose

The proposal's record-of-record and its distribution. Snapshots are the as-submitted pins; share links are how frozen artifacts reach directors and accountants. Split from the BOE generation contract because the audiences differ: generation is a working surface, this is an archive-and-distribute surface. (If M1 wireframing finds these collapse naturally into one Deliver screen, that's a layout decision, not a contract change — the reads/commands stay as specified across both.)

## Reads (exhaustive)

| Data | Source | Rule |
|---|---|---|
| Snapshots | `proposal_snapshots` | Label, submitted_at/by, composite hash, pinned version identifiers, artifact list |
| Snapshot contents | pinned artifacts via `artifact_ids` | Navigable to the artifact viewer (read-only, always) |
| Share links | `boe_share_links` | Target (artifact / snapshot / legacy-live), created, last accessed if available, revocation state |
| Hash verification | recomputation on demand | See rule below |

**Verification rule:** the snapshot detail offers a "verify" action that recomputes the composite hash from the stored artifact hashes and displays match/mismatch. Match is the expected boring outcome; a mismatch is a red-alert state (it should be impossible — the triggers prevent mutation — so a mismatch means something is deeply wrong and the UI says so plainly). This is the composite hash made user-visible instead of living only in acceptance tests.

## Commands (exhaustive)

- `CreateProposalSnapshot` (if not already fired from the generation screen — one command, two entry points)
- Create share link → choose target: specific artifact or snapshot. Legacy live-data targets are NOT creatable; they exist only as flagged historical rows
- Revoke share link
- Verify snapshot hash (read-only recomputation)

**No delete, no edit, anywhere on this screen.** Snapshots and their artifacts are immutable by trigger; the UI doesn't render controls the DB would reject — absence of the control IS the immutability presentation.

## States the screen must represent

1. **No snapshots** → EmptyState explaining what a snapshot is ("the as-submitted record — pins exact versions under one hash") and its prerequisite (at least one generated artifact)
2. **Snapshot list** → label, date, hash (truncated with copy-full affordance), artifact count
3. **Snapshot detail** → the full pin: intelligence version + hash, WBS version, scenario, each artifact with its content hash, composite hash, verify action
4. **Share link list** → per link: target with type badge, created, revoke control; **legacy live-data links in a visually distinct deprecated section** with migration guidance ("create a new link targeting an artifact")
5. **Link created** → the copyable URL with a one-line statement of what the recipient will see and that it's frozen
6. **Verify result** → match (quiet confirmation) / mismatch (alarm state, instruction to stop and investigate)

## Explicitly not on this screen

Artifact generation (→ BOE generation contract). Artifact content editing (impossible everywhere). Anything upstream.
