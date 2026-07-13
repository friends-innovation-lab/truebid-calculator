# Screen Contract: Staff → WBS Editor

**Status:** Approved by Lapedra, 2026-07-13
**Section:** Staff
**Gate complexity:** High — predicts the citation gate

---

## Purpose

Where the confirmed intelligence becomes a work structure. The user reviews AI-generated task candidates, accepts/edits/adds tasks, reviews AI-proposed requirement links, and assigns staffing per period. This screen's defining job is making two downstream gates visible early: a task without requirement links will fail BOE generation (CITATION_INCOMPLETE), and a task without staffing produces no pricing lines. The old UI showed "0 hrs from WBS" on every role and nobody could tell if that was a state or a bug — this screen makes coverage legible.

## Reads (exhaustive)

| Data | Source | Rule |
|---|---|---|
| Active WBS version | `wbs_versions` where proposal + status=`active` | The only version rendered by default |
| Tasks | `tasks` for the active version | Hierarchy with wbs codes |
| Candidate tasks | candidate-accept flow records | Visually distinct from accepted tasks — never co-mingled as equals |
| Candidate requirement links | candidate-accept flow records (new — backend prep) | AI-proposed task↔requirement links, each carrying its evidence (which PWS passage suggested it); visually distinct from accepted links |
| Staffing assignments | `staffing_assignments` per task, per period | Including assignment-level overrides (salary, etc.) |
| Requirements + links | `requirements`, `requirement_links` for the confirmed intelligence | Per-task citation status derives from this |
| Confirmed intelligence context | active confirmed version: periods, roles, staffing model, utilizations | Read-only reference rail — this screen never edits intelligence |
| Role catalog | tenant 27-role catalog + aliases | For assignment pickers; unmapped-title surfaced as first-class state |

**Hard exclusions:** no draft intelligence, ever — if a draft exists, this screen still renders against the *confirmed* version, with at most a passive notice that a draft is in review on Scope. No dollar amounts — hours and coverage live here; money lives in the pricing view. (This is the structural answer to the $2.28M delta: the screen that edits structure cannot also compute totals.)

## Commands (exhaustive)

- Accept / reject candidate task
- Accept / reject candidate requirement link
- Create / edit / archive task (user-edits-win per the P3 conflict defaults)
- Link / unlink task ↔ requirement (manual path remains for links the AI missed)
- Create / edit / remove staffing assignment (role, period, hours basis, overrides)
- Create new WBS version (supersede) — with the same diff-on-supersede treatment as the Scope contract

## States the screen must represent

1. **No WBS yet** → EmptyState offering generation from confirmed intelligence; disabled with explanation if no confirmed intelligence exists (gate legibility — say *why*, link to Scope)
2. **Candidates pending review** → accepted structure and AI candidates (tasks AND links) clearly separated; count of pending candidates visible at section level
3. **Per-task status badges** — the core of the screen. Every task row carries two independent indicators:
   - **Citation status:** linked (n requirements) / proposed links pending review / unlinked — unlinked rendered as a warning, with copy that says what it blocks: "will fail BOE generation"
   - **Staffing coverage:** assigned (roles × periods) / unstaffed / partially staffed (assigned in some periods but not others)
4. **Rollup banner** → "N tasks unlinked, M tasks unstaffed, K proposals pending review" at the top, each count clickable to filter. This is the pre-flight check for the BOE gate — the user should be able to answer "can I generate a BOE right now?" from this screen without trying and failing.
5. **Unmapped title state** → an assignment whose role title doesn't resolve to the catalog is a visible, first-class condition with a resolve control, not a silent fallback
6. **Version context** → active version identifier visible; superseded versions accessible read-only (view, never edit)

## Keeper rendered here

- **WBS elements, redesigned** — task hierarchy with the badge system above. Keep-list item 2 in its new form: the concept survives, the display is rebuilt around what the normalized model can now show (versioning, candidates, citation status, per-period coverage).

## Explicitly not on this screen

Rates, totals, cost of any kind (→ pricing view). Intelligence editing (→ Scope). BOE generation (→ Deliver — this screen *predicts* the gate, Deliver *fires* it).

## Ratified decisions

1. **Rollup banner (state 4) treats requirement-linking as a first-class workflow** — ratified 2026-07-13. The most design-expensive element in this contract; the link-review interaction must be fast.
2. **AI-proposed requirement links via candidate-accept pattern** — ratified 2026-07-13. Per the labor-vs-judgment principle: the AI does the linking labor; the user reviews and accepts. Manual linking remains as the fallback for links the AI missed.

## Backend dependencies

- AI-proposed task↔requirement links riding the existing candidate-accept flow, with per-proposal evidence (the suggesting PWS passage). Folded into the same backend prep branch as `solicitation_brief`.
