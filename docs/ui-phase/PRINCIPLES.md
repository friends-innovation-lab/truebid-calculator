# TrueBid M1/M2 — Design Principles

*The judgment layer of the packet. The narrative says what happens; the contracts say what's lawful; this says what good looks like.*

**Status:** Approved by Lapedra, 2026-07-13
**Packet:** NARRATIVE.md · principles (this doc) · contracts/ · IA-SKELETON.md

---

## 1. What this product is

TrueBid is a **trust instrument**. Its content is numbers, statuses, hashes, citations, and provenance. Users come to verify machine work and sign it; external reviewers come to audit it. Every design decision should be tested against one question: *does this make the work more verifiable, or just more decorated?*

The benchmark is "what would Pentagram do" — meaning restraint, intentionality, and systems thinking, not ornamentation. References: **Linear** (density with calm), **Vercel** (confidence through typography and space), **GitHub** (complex state made legible, diffs as first-class UI). Note what these references share: they are tools professionals trust with consequential work, and none of them decorate.

## 2. The user is an auditor, not a clerk

AI proposes; the human reviews, accepts, signs. The interface should feel like reviewing well-prepared work, not filling out forms. Practical consequences:

- **Review surfaces over input surfaces.** The dominant interactions are accept/reject/edit-in-place, not blank fields. A blank field the AI could have filled is a design failure.
- **Signatures feel like signatures.** Confirm, approve, snapshot are deliberate acts with visible consequence (a hash appears, a state freezes). They should carry ceremony proportional to their weight — not friction, but unmistakable moment. A snapshot is not a save.
- **Proposed vs. accepted is always visually distinct.** Candidate tasks, proposed requirement links, draft intelligence — machine proposals never wear the same clothes as human-accepted facts.

## 3. Gates are announced, never discovered

The defining interaction pattern of this product, and its biggest departure from the old UI:

- Every gated action displays its **precondition checklist live**, before the user acts: what's met, what's blocking, and a link or inline control to fix each blocker.
- Blocked buttons state their count: "Confirm — 2 items need resolution." Never a dead button. Never an enabled button that errors on click.
- When an error occurs anyway, it renders as a **worklist** — each item named, each deep-linked to its fix — not a message.

*Provenance of this rule: the July 13 confirm-ceremony failure. The gate was right; its invisibility was the bug.*

## 4. State is always legible

- Every screen answers, at a glance: where in the lifecycle am I, what am I looking at (draft / confirmed / active / approved / superseded / generated), and what's next.
- **Status vocabulary is fixed and product-wide.** One visual treatment per status, everywhere it appears. A "superseded" badge on an intelligence version, a WBS version, and an artifact must be the same badge.
- Version identity is content, not metadata. Which version, which hash, generated when, by whom — on the page, not buried in a tooltip.
- Immutability is shown, not implied. Frozen things look frozen.

## 5. Numbers behave like evidence

- **Every dollar figure traces.** Any total or rate on screen can be expanded or followed to its calculation trace. The bill-rate cascade panel (base → fringe → OH → G&A → ÷2,080 → profit → rate) is the canonical pattern — it appears in the pricing view, the role detail, and the artifact viewer, identically.
- **One source per number.** Totals come from the approved scenario or a stored artifact; nothing else may compute one. Two screens showing the same quantity show the same number because they share the read, not because they agree by luck.
- Tabular numerics: aligned, consistent precision, monospaced or tabular figures. Money is typeset like it matters.
- Citations are one interaction away from their verbatim source quote. The chain — BOE line → requirement → PWS passage — is walkable in the UI because it's walkable in the data.

## 6. Density with calm

GovCon pricing is dense; the answer is hierarchy, not hiding.

- Prefer showing more with strong typographic hierarchy over collapsing into tabs, accordions, and disclosure widgets. The old UI hid state behind panels; hidden state is how phantoms survive.
- Whitespace and type scale do the organizing. Boxes, rules, and background tints are the last resort, not the first.
- Tables are a primary surface here, not a fallback — design them deliberately (the reference products all do).

## 7. System vocabulary

- **Typography:** Geist Sans; tabular figures for all numerics.
- **Components:** the established set — Card, EmptyState, ErrorAlert, SaveStatus — extended, not forked. New patterns earn their place by recurring, then join the system.
- **Error taxonomy (established, enforced):** toast = operation feedback; form variant = form errors; inline = field errors; page = fatal. Gate blockers are none of these — they're the checklist pattern from §3, a first-class component to be designed once and reused at every gate.
- **Color carries meaning or nothing.** Status states get the fixed vocabulary; semantic warning/success where earned; decoration nowhere. A mostly-monochrome product where color *means something* reads as more trustworthy, not less finished.

## 8. External views are the thesis, presented to a skeptic

The director and accountant token views are TrueBid's argument to people who owe it no benefit of the doubt.

- Zero learning curve: the document explains itself — provenance header, walkable citations, traceable rates.
- Read-only must feel authoritative, not degraded. These are the product's best screens, not its afterthought.
- The hash and provenance header is the trust handshake: *this is artifact 6d0e17…, generated from confirmed intelligence, totals conserve, every line cites.* M2's hardest and most worthwhile problem is making that read as craftsmanship rather than clutter.

## 9. M1 / M2 discipline

- **M1:** every principle above that governs structure, state, gates, and sources — in full force. Grayscale acceptable. Correctness is the aesthetic.
- **M2:** typography scale, color system, spacing rhythm, the visual character of ceremony and provenance. M2 touches no data path and changes no contract.
- If a design idea requires a new read or command, it isn't a design idea — it goes back through a screen contract revision.

## 10. What this product never looks like

Not a dashboard (no vanity metrics, no charts for charts' sake). Not a form wizard (review, not data entry). Not a spreadsheet skin (structure and provenance are the value Excel can't offer). Not enterprise-busy (no icon soup, no toolbar sprawl). When in doubt, remove.
