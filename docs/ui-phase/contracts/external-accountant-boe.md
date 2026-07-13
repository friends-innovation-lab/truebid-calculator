# Screen Contract: External → Accountant Read-Only BOE (Token Link)

**Status:** Draft for Lapedra review, 2026-07-13
**Section:** External (no login, token-scoped)
**Gate complexity:** None — read-only; the product thesis delivered to its most skeptical audience

---

## Purpose

An accountant opens the artifact itself to answer audit questions: *where did this rate come from, what justifies these hours, do the numbers reconcile?* The document answers because it carries its own audit trail. Per the narrative: not "trust us," but "verify." This and the director view are the product's best screens, not its afterthought.

## Access model

Token resolves to a specific artifact or snapshot. Always frozen content from `boe_artifacts.content` / `proposal_snapshots`; never live reads; never recomputed.

## Reads (exhaustive)

| Data | Source | Rule |
|---|---|---|
| Provenance header | artifact + (if snapshot) snapshot metadata | Artifact hash, generated when/from what, engine version, conservation status, and — for snapshots — the composite hash and "as-submitted" framing. The trust handshake, first on the page |
| Full document | artifact content, all sections in order | period_structure, role_rate_table, wbs_estimates, labor_loading_summary, cost_fee_breakout, totals |
| Per-line calc traces | artifact content calcTrace | Keeper #1's third instance: the full cascade per line, expandable — base → fringe → OH → G&A → cost → profit → rate |
| Cost/fee decomposition | artifact lines | DCAA-style: cost component and fee component per line and in aggregate, with the conservation assertion visible |
| Citations | `boe_citations` → requirement → source quote | Every estimate line walks to its requirement and verbatim PWS passage — same one-gesture interaction as the director view |
| Rate config | artifact content rateConfig | The frozen fringe/OH/G&A/profit/escalation rates, presented as facts of this document |

**Hard exclusion:** no live data, no recomputation, no "current" anything. If a newer artifact exists, this page does not say so — the token holder sees exactly what was shared, which is the point of sharing a frozen record.

## Commands

None.

## States the screen must represent

1. **Valid token, artifact target** → the document with provenance header
2. **Valid token, snapshot target** → the as-submitted framing prominent; composite hash; the artifact set navigable within the snapshot
3. **Revoked/expired** → same treatment as the director view: plain, no leakage
4. **Trace expansion** → any line's rate opens its cascade inline; any total reconciles visibly to its lines (the conservation assertion rendered, not just stored)
5. **Citation walk** → estimate line → requirement → verbatim quote with source document + location, one gesture

## Relationship to the director view

Same skeleton — provenance header, frozen artifact content, walkable citations, no commands — with two differences: this view includes all pricing (it's the audience's whole question), and the cost/fee breakout is foregrounded. Design once, specialize twice; these should share nearly all components.

## Explicitly not on this screen

Anything live. Anything editable. Any other proposal surface. Comparison to other versions (the frozen record stands alone).
