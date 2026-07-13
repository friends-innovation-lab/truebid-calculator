# Keep List — Patterns Harvested from the Old UI

**Status:** Approved by Lapedra, 2026-07-13

The old UI is retired as a whole: it encodes the 6-tab structure, renders working_data-shaped reads, and produced the $2.28M phantom delta. It is a list of failures to avoid, not a reference. These entries are the *patterns* worth preserving, re-expressed within the new system — not layouts to replicate.

**For Claude Design:** these are required patterns, each bound to a contract and a data source. Do not reproduce the old layouts; rebuild the information design on the new reads.

| # | Element | Verdict | Contract | Data source |
|---|---|---|---|---|
| 1 | **Bill rate calculation panel** — the full cascade: base salary → +fringe → +overhead (on base+fringe) → loaded cost → +G&A → total cost → ÷2,080 → cost/hr → +profit → bill rate | Keep as-is conceptually. The canonical trust pattern; appears identically in pricing view, role detail, and artifact viewer | Staff → pricing view; Staff → role detail; Deliver → artifact viewer | `pricing_lines` calc trace fields (approved scenario); `boe_artifacts.content.calcTrace` |
| 2 | **WBS elements** — task structure display | Keep concept, new display. Rebuilt around what the normalized model now shows: versioning, candidate-accept, per-task citation-status and staffing-coverage badges | Staff → WBS editor | `wbs_versions` + `tasks` + `requirement_links` + `staffing_assignments` |
| 3 | **RFP context brief** — What They Want / Why It Matters / Key Challenges / Evaluation Emphasis | Keep pattern; requires new domain field. Challenge cards upgraded to cite verbatim source passages via fact_evidence — the extraction-side version of the calc trace | Scope → extraction review | `intelligence_versions.solicitation_brief` (new) + `fact_evidence` |
| 4 | **Period structure table** — periods, months, cumulative months, GSA rate year | Keep | Scope → extraction review | Confirmed/draft intelligence periods |
| 5 | **Staff tab summary header** — headline total + per-period breakdown | Pattern keep, implementation discard. This specific display produced the $2.28M phantom (computed from a read path competing with the pricing engine). The pattern (headline + period columns) reappears rendering the approved scenario only | Staff → pricing view | Approved `pricing_scenarios` + `pricing_lines` ONLY |
| — | Everything else in the old UI | Discard | — | — |

**The discipline entry #5 encodes:** liking a display is not evidence its numbers were real. Pattern and implementation are classified separately, element by element.
