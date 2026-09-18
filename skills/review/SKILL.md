---
name: review
description: Review a subject he has already studied — find what has decayed since the last session and re-teach only that. Use when he asks to review, revisit, refresh, or check what he still remembers about a subject he has a stored graph for. Not for new material; that is the teach skill.
---

# Review — find the decay, fix the decay

Mode 2. The premise: he studied this weeks ago, most of it is still there, and re-teaching the whole subject would waste the session on nodes he holds cold. The job is to find the specific nodes that rotted and repair those.

**Load the `graph` skill first.** It owns the file format and the ledger read rules. Everything below assumes you have it.

## What this mode is, in terms of the existing system

This is not a new pedagogy. It is:

- **teach Phase 1a** (probe to locate the edge) — but aimed at a *stored* graph instead of an unknown learner, and
- **teach Phase 3** (the motivate → establish → connect → quiz-check loop) — run only on the nodes that failed.

Everything the teach skill says about probing and about building a node still applies verbatim. Do not reimplement either; use them.

**Skip teach Phase 1b entirely.** That phase exists to find out what he's reaching for when the goal is unclear. Here the goal is already encoded in the graph he built last time. Asking him again is wasted motion.

## Step 1 — Load

Identify the subject from what he said ("review calc 2" → `calc2`). Read `graphs/<subject>.md` and `graphs/.mastery.jsonl`.

**If there is no graph for that subject**, say so plainly and offer the teach skill instead — there is nothing to review. Do not invent a graph from memory and start quizzing against it; that tests your guesses, not his knowledge.

## Step 2 — Rank by decay risk

Build the probe order before asking anything. Highest risk first:

1. **Never quizzed** — no ledger line at all. Unknown, not assumed-good. These are usually nodes a past session introduced but never confirmed.
2. **Last outcome was `dontKnow`** — a declared gap that was never closed.
3. **Last outcome was incorrect** — known shaky.
4. **Repeatedly shaky** — two or more misses anywhere in its history, even if the most recent answer was correct. A node that keeps breaking is fragile regardless of the last data point.
5. **Stale** — longest time since it was last touched.
6. **Recently solid** — lowest priority. Sample a couple as a control, don't grind through them.

**Then reorder within that list so roots come before their dependents.** If an `unconditional-truth` node has decayed, every node resting on it is suspect and questions aimed at the dependents will produce misleading answers — you will read a broken foundation as a broken conclusion. Check foundations first; the teach skill's whole point is that you never build on sand.

## Step 3 — Probe

Quiz down the ranked list, tagging every call with `subject` and `node` so the ledger records it.

Apply teach Phase 1a's bracketing doctrine as written: **a run of correct answers means the questions were too easy, not that the review is done.** Escalate on that node until something breaks or you are satisfied it is genuinely solid. One correct answer to an easy question about a node proves very little.

Keep the session bounded — roughly 6–10 nodes is a real review; trying to sweep an entire subject produces a shallow pass over everything and a repair of nothing. Tell him what you're covering and what you're deferring.

**A miss is a coordinate, not a diagnosis.** Same as in teach: probe around it before concluding. A slip, an isolated gap, and a genuine misconception need different repairs, and the third one has to be actively dislodged rather than topped up.

## Step 4 — Repair

For each node that actually broke, run the teach skill's Phase 3 loop unchanged: **motivate → establish → connect → quiz-check.**

Two review-specific notes:

- **Re-motivate, don't just restate.** He has heard the explanation before and it did not hold. Repeating it louder is unlikely to work. Reach for a different motivating problem or a different discovery path than the one in the graph — if the first framing had stuck, you would not be here.
- **Repair the foundation before the thing built on it.** If a root failed, fix the root and then re-test the dependents; they may recover on their own once the base is solid again.

The `quiz-check` at the end of each repair is what writes the new ledger entry proving the node is back. Do not skip it — an unconfirmed repair is indistinguishable from no repair.

## Step 5 — Housekeeping

- The ledger updates itself. The `mastery-ledger` extension captures every tagged quiz result; you never write `.mastery.jsonl` by hand.
- **Update the graph only if the review genuinely changed it** — you split a node that turned out to be two ideas, or found a missing dependency edge that explains why something kept collapsing. Follow the `graph` skill's merge rule: match by id, never rewrite wholesale, never rename an existing id.
- Close with what is now solid, what is still shaky, and what you deferred. That last part matters — it is the starting point for the next review.
