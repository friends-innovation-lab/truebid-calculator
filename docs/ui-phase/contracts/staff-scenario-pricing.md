# Screen Contract: Staff → Scenario & Pricing View

**Status:** Draft for Lapedra review, 2026-07-13
**Section:** Staff
**Gate complexity:** Medium — contains the Approve gate (a human signature)

---

## Purpose

Where cost is computed, inspected, and signed. Scenarios render from the one pricing engine with full per-line traces; the user inspects, compares if multiple scenarios exist, and **approves** — the signature that makes a scenario the sole legitimate source of totals product-wide. This is the only screen in Staff where dollar figures appear.

## Reads (exhaustive)

| Data | Source | Rule |
|---|---|---|
| Scenarios | `pricing_scenarios` for the proposal | Status (draft / approved), engine_version, rate_config_snapshot summary |
| Pricing lines | `pricing_lines` per scenario | Both line types: wbs_estimate and labor_loading, with full calc traces |
| Totals | computed from the scenario's lines | Contract total = loading lines, per the P6A rule; per-period breakdown |
| Rate config snapshot | `pricing_scenarios.rate_config_snapshot` | The fringe/OH/G&A/profit/escalation rates this scenario froze, shown as facts of the scenario |
| Utilization sources | confirmed intelligence utilizations feeding loading lines | Read-only provenance: "this loading line derives from confirmed utilization X% × Y months" |

**Hard exclusions:** totals on this screen come from this scenario's lines and nowhere else — no parallel computation, no "quick estimate" paths. If the intelligence or WBS changed after a scenario was computed, the screen says so (staleness notice) but never silently recomputes; recomputation is an explicit user action producing a new scenario state.

## Commands (exhaustive)

- Create scenario / recompute scenario
- Set scenario-level inputs the domain allows (profit rate where explicit, etc.)
- **Approve scenario** — the gate; human-only, per the signature boundary
- Un-approve is NOT a command. If an approved scenario is wrong, the path is a new scenario — approval is a signature, and signatures aren't erased. (If the domain currently permits status reversal, flag it; the UI will not expose it either way.)

## States the screen must represent

1. **No scenario** → EmptyState; disabled-with-reason if prerequisites are missing (no confirmed intelligence / no active WBS), linking to the fixing screen
2. **Draft scenario** → full line table with expandable per-line calc traces (keeper #1, third editing-context instance); needs-utilization or other engine flags rendered per-line as warnings with links to their fix (Scope for utilization, WBS editor for staffing)
3. **Approve gate** → the checklist pattern: conditions for approval visible before the button (no unresolved engine flags, conservation clean); blocked-with-count if unmet
4. **Approved scenario** → visibly signed: approved-by, approved-at, rate snapshot frozen, the summary header (keeper #5's pattern — headline total + per-period columns) rendering from these lines only
5. **Staleness** → "intelligence was superseded after this scenario was approved" — prominent notice, with the path forward (new scenario) offered, never auto-fired
6. **Multiple scenarios** → list with status; comparison is a nice-to-have deferred to M2 unless trivially cheap in M1

## Keepers rendered here

- **Bill rate calculation panel** (keeper #1) — per-line expandable traces
- **Summary header pattern** (keeper #5) — headline total + per-period breakdown, rendering exclusively from the approved scenario's lines. This is the resurrection of the display that produced the $2.28M phantom, now structurally incapable of lying: same component shape, single source.

## Explicitly not on this screen

Structure editing (→ WBS editor). Role/salary editing (→ staffing detail). BOE generation (→ Deliver). Intelligence facts beyond read-only utilization provenance (→ Scope).

## Open flag for Lapedra

The un-approve question: does the current domain permit approved → draft status reversal on pricing_scenarios? The contract takes the position that it shouldn't be exposed in the UI regardless (new-scenario is the path), but if the DB permits reversal, that's a candidate for a trigger in a future hardening pass — same principle as intelligence confirmation immutability.
