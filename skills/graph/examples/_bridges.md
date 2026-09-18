---
bridges:
  - from: calc2:definite-integral
    to: finance:present-value
    kind: formal
    claim: The present value of a continuous cash-flow stream is literally a definite integral of the discounted rate over the term.
    status: verified
    evidence: [https://en.wikipedia.org/wiki/Present_value]
    checked: 2026-09-18

  - from: chinese:compound-word-formation
    to: swe:qualified-name
    kind: structural
    claim: Both build meaning compositionally by ordering morphemes from general to specific, so the trailing element carries the head meaning.
    status: candidate
    evidence: []
    checked: 2026-09-18

  - from: chinese:radical
    to: swe:namespace
    kind: etymological
    claim: REJECTED - no source supports any historical link between the person radical and computing's use of "user"; the resemblance is coincidental and the claim was reasoning-only.
    status: rejected
    evidence: []
    checked: 2026-09-18
---

# Bridge index

Cross-domain connections. One entry per connection, in this file only — never duplicated into the domain graphs.

Statuses: `candidate` (proposed, not yet verified), `verified` (researched, evidence attached, safe to teach), `rejected` (failed verification, kept so it is not re-proposed).

The third entry above is the shape of a rejection worth keeping: the claim was superficially plausible, had no source, and is recorded so no future session spends research killing it twice.
