# Screen Contract: Scope → Document Set Management

**Status:** Draft for Lapedra review, 2026-07-13
**Section:** Scope
**Gate complexity:** Low — feeds the extraction pipeline; no gates fired here

---

## Purpose

Where the solicitation enters the system. The user uploads the document set — PWS, instructions, Q&A, amendments — and the system classifies each document and establishes precedence for fact merging. This screen answers: *what documents does this proposal's intelligence derive from, and in what order of authority?* It replaces the old single-file upload (the API has supported multi-document sets since Phase 4B; the UI never caught up — this contract closes that gap).

## Reads (exhaustive)

| Data | Source | Rule |
|---|---|---|
| Document set | documents for the proposal | Filename, classification (pws / instructions / qa / amendment), upload date, page count, uploader |
| Classification + precedence | document set records | The precedence order used in fact merging, shown explicitly |
| Extraction linkage | intelligence versions derived from this set | Which version(s) were extracted from the current set; whether the set has changed since the last extraction |
| Document content | file preview | In-place viewer (the old UI's PDF pane pattern is fine here — it was never a problem) |

**Hard exclusion:** no extracted facts rendered here. This screen is about the *sources*; what was extracted from them lives on the review screen. Mixing the two re-creates the old Scope tab's confusion.

## Commands (exhaustive)

- Upload document(s)
- Set / correct classification (AI proposes classification per the labor-vs-judgment principle; user confirms or corrects)
- Reorder precedence within the rules the merge logic allows
- Remove document (only if no confirmed intelligence derives from it — otherwise the path is supersede, and the UI says so)
- Trigger extraction / re-extraction → creates a draft intelligence version, hands off to the review screen

## States the screen must represent

1. **Empty** → EmptyState: upload-first, with the classification taxonomy explained in one line
2. **Documents present, classification proposed** → AI-proposed classifications visually distinct from user-confirmed ones (same proposed-vs-accepted vocabulary as everywhere else)
3. **Set stable, extraction current** → the quiet state: set matches what the active intelligence version was extracted from
4. **Set changed since last extraction** → prominent, non-blocking notice: "2 documents added since the current intelligence was confirmed — re-extract to incorporate," with the re-extract action adjacent. This is a gate-legibility pattern in miniature: stale intelligence is announced, not discovered
5. **Extraction in flight** → progress state; the draft lands on the review screen when done

## Explicitly not on this screen

Extracted facts, the solicitation brief, periods, roles (→ extraction review). Anything downstream.

## Notes for design

The precedence concept needs one good explanatory treatment — most users won't know why Q&A outranks the PWS for conflicting facts. One sentence of inline explanation at the precedence display, not a help doc.
