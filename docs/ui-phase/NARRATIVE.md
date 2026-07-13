# TrueBid M1 — Flow Narrative

*Companion to the screen contracts. This is the story the UI must tell; the contracts are its enforcement.*

**Status:** Approved by Lapedra, 2026-07-13
**Packet:** narrative (this doc) · PRINCIPLES.md · contracts/ · IA-SKELETON.md

---

## The principle

TrueBid's users never do labor a machine could do, and machines never make a judgment a human must own. Every workflow is the same shape: **AI proposes → human reviews → human accepts → acceptance is recorded and hashed.** The user is the auditor of record, not the data-entry clerk. This is what separates TrueBid from Excel: a spreadsheet makes you produce the structure and gives you no way to prove it's grounded; TrueBid produces the structure for you and makes your verification of it the product.

The corollary boundary: AI proposes, but never accepts. Confirm, approve, and snapshot are human-only acts — they are signatures, not chores. No future feature may automate them.

The UI's core job follows from this: **make the state machine legible.** At every moment the user should know where they are in the lifecycle, what is confirmed versus proposed, and what — specifically, fixably — blocks the next gate. Gates are announced before they're hit, never discovered as errors.

---

## The lifecycle

**Upload → Extract → Confirm → Structure → Price → Approve → Generate → Snapshot → Share**

Three sections carry it: **Scope** (what the document says), **Staff** (what the work is and who does it), **Deliver** (the immutable record). Money appears only in Staff's pricing view and Deliver's artifacts — never on structural screens.

---

## Lapedra's journey (primary persona: proposal owner)

### 1. Scope — establishing the facts

She uploads the solicitation document set — PWS, instructions, Q&A — and the system classifies them and merges facts by precedence. Extraction produces a *draft* intelligence version: contract type, periods, staffing model, roles with utilizations, and a solicitation brief (what they want, why it matters, key challenges, evaluation emphasis) whose factual claims cite verbatim passages from the source.

She reviews the draft in explicit review mode — unmistakably marked as unconfirmed, diffed against the prior confirmed version if this is a supersede. A blocker checklist tells her, before she touches the Confirm button, everything that would stop it: staffing model needs resolution, a role is missing hours/month. Each blocker offers its fix inline. When the checklist clears, she confirms — and the version freezes under a SHA-256 hash. Everything downstream builds on this and only this.

*Why it's built this way:* the July 13 ceremony failed not because the gate blocked — blocking was correct — but because the reason was invisible and the fix undiscoverable. Gate legibility is a hard requirement, not polish.

### 2. Staff — structuring the work

From the confirmed intelligence, the AI proposes a WBS: tasks in hierarchy, each carrying proposed links to the requirements it satisfies, each link carrying the evidence that suggested it. Lapedra's work here is review: accept candidates, edit where her judgment differs (her edits win), reject what's wrong. She assigns staffing — role, period, hours basis — from the 27-role catalog, with unmapped titles surfaced as a first-class condition rather than silently defaulted.

Every task row shows two badges: **cited** (linked to n requirements) and **staffed** (covered in which periods). A rollup banner keeps the running answer to "could I generate a BOE right now?" — N tasks unlinked, M unstaffed, each count a filter. This screen shows hours and coverage; it never shows a dollar figure.

*Why:* citations became load-bearing in Phase 6B — an unlinked task will fail BOE generation. The banner converts that gate from a Deliver-screen surprise into a Staff-screen checklist. And the no-money rule is structural: the screen that edits structure cannot compute totals, which is precisely how the old UI produced a $2.28M phantom.

### 3. Staff → Pricing — computing the cost

The pricing view renders scenarios from the one engine: per-line calculation traces showing the full cascade — base salary, fringe, overhead on base+fringe, G&A, profit, ÷2,080 — exactly as stored in `pricing_lines`. Bid-time salaries are frozen as assignment overrides. When the numbers are right, she approves the scenario. Approval is a signature: the scenario's rate config snapshots, and it becomes the sole legitimate source of totals anywhere in the product.

### 4. Deliver — creating the record

A pre-flight panel shows the four gates as a live checklist: intelligence confirmed, WBS active, scenario approved, every estimate line cited — each unmet condition linking to the screen that fixes it. She generates. The artifact is immutable: sections, line tables with cost and fee broken out DCAA-style, per-line traces, per-line citations navigable to the requirement and the source quote, conservation asserted, content hashed, provenance stamped (which versions, which engine, when, by whom).

If generation fails on citations anyway, the error is a worklist, not a message: every uncited line named, deep-linked into the WBS editor filtered to the offending tasks.

When the proposal ships, she creates a **snapshot** — the as-submitted record pinning intelligence version, WBS version, scenario, and artifacts under one composite hash. It cannot be edited or deleted by anyone, including her. That's not a limitation; it's the point.

### 5. Share

Token links now resolve to artifacts and snapshots — frozen, hash-verifiable documents — never to live tables. Nothing a reviewer sees can change while they're looking at it.

---

## The external journeys

**The director (WBS review, token link).** She opens a link scoped to WBS assignments: tasks, staffing, hours, the evidence behind them. Provenance is visible without hunting — what version this reflects, when it was generated. She's judging whether the right people are on the right work; the interface gives her structure and grounding, not a login and not a spreadsheet export.

**The accountant (read-only BOE, token link).** He opens the artifact itself: rate build-ups line by line, cost/fee separation, every estimate citing its requirement, hash in the header. His questions — *where did this rate come from, what justifies these hours* — are answered by the document, because the document carries its own audit trail. This link is the product thesis delivered to a skeptic: not "trust us," but "verify."

---

## What the UI never does

- Renders draft data outside explicit review mode, or merges draft with confirmed in one display
- Computes a total anywhere except from an approved scenario or a stored artifact
- Recomputes artifact content "for freshness" — freshness means a new artifact
- Presents a dead button that errors on click — every gate is announced with its blockers and their fixes
- Asks the user to type what the AI could have proposed
- Accepts, confirms, approves, or snapshots anything without a human act

---

## M1 / M2 boundary

**M1 is function:** every screen above, plain, correct, single-source, gates legible, states honest. Grayscale is acceptable. Acceptance: the lifecycle runs end-to-end on PM-HCD with real requirement links, and the Staff screen's total agrees with the artifact's total because they are the same number from the same source.

**M2 is form:** the visual system — Pentagram-benchmark restraint, Linear/Vercel/GitHub density and confidence, provenance presented as quality rather than clutter. M2 touches no data path.
