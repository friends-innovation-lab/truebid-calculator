# Screen Contract: Staff → Staffing & Roles Detail

**Status:** Draft for Lapedra review, 2026-07-13
**Section:** Staff
**Gate complexity:** Low — detail/reference surface; assignment edits happen here and in the WBS editor

---

## Purpose

The role-centric view of staffing: who is on this proposal, at what level and salary basis, with what justification. Where the WBS editor answers "is this task covered," this screen answers "is this person's rate defensible." It absorbs the old Rate Justification panel into the role detail (per the pre-packet IA decision) and is the primary home of the keeper calc-trace panel on the editing side.

## Reads (exhaustive)

| Data | Source | Rule |
|---|---|---|
| Roles on this proposal | distinct roles across `staffing_assignments` for the active WBS version | With per-role assignment counts and period coverage |
| Role catalog entry | tenant 27-role catalog | Labor category, level/step structure, salary bands, aliases, context notes |
| Assignment detail | `staffing_assignments` | Task, period, hours basis, and any assignment-level overrides (bid-time frozen salary, etc.) |
| Calc trace preview | pricing engine read for the role's resolved inputs | See rule below |
| Rate justification context | catalog context notes + assignment overrides + salary source | The "why this rate" narrative material, structured not prose |

**Calc trace rule:** if an approved scenario exists, the trace panel renders the stored `pricing_lines` trace for this role — the real numbers. If no scenario exists yet, the panel may render a live engine preview but must label it "preview — not an approved price" with distinct treatment. Preview and approved never look the same. (This preserves the old side panel's usefulness during setup without re-creating a competing source of truth.)

## Commands (exhaustive)

- Edit assignment (role mapping, level/step, hours basis, overrides) — same command surface as the WBS editor, different entry point
- Resolve unmapped title against the catalog
- Set / clear assignment-level salary override (bid-time freeze)

**No catalog editing here** — the 27-role catalog is tenant configuration (Account → Company Settings territory), not proposal data. This screen reads the catalog; it never writes it.

## States the screen must represent

1. **Role list** → all roles with: catalog mapping status (mapped / unmapped-warning), level+step, salary source badge (catalog / override), assignment count, period coverage
2. **Role detail** → the side-panel pattern from the old UI, rebuilt: role identity, level/step selector against the catalog's band structure, salary source, and the **calc trace panel** (keeper #1) — approved or clearly-labeled preview per the rule above
3. **Unmapped title** → first-class resolve flow: the unrecognized title, the catalog's closest matches via aliases, accept-or-map interaction. Same state as the WBS editor's version; same component
4. **Override active** → visibly distinct: "salary overridden for this bid — catalog: $X, this proposal: $Y," with who/when

## Keeper rendered here

- **Bill rate calculation panel** (keeper #1) — the editing-side instance. The pricing view and artifact viewer carry the other two instances; all three are the same component rendering the same trace shape.

## Explicitly not on this screen

Totals (→ pricing view). Task structure (→ WBS editor). Catalog administration (→ Account settings). Scenario approval (→ pricing view).
