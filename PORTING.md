# Porting — pi ↔ Claude Code

This repo carries **two live implementations** of the same teaching system:

| | pi | Claude Code |
|---|---|---|
| Config tree | `skills/`, `agents/`, `extensions/` | `.claude/skills/`, `.claude/agents/` |
| Installed as | `.pi/` in the vault | `.claude/` in the vault |
| Platform | macOS / Linux / WSL | Windows / macOS / Linux, native |

Both are maintained. This file exists so mirroring a change is mechanical rather than archaeological.

**Drift is the known cost of this choice.** The bodies cannot be identical — they name different tools — so a change to the pedagogy has to be made twice, by hand, and nothing enforces it. If that stops being worth it, freeze one tree and say so here.

## File pairs

| pi | Claude Code | Relationship |
|---|---|---|
| `skills/teach/SKILL.md` | `.claude/skills/teach/SKILL.md` | Philosophy and phases identical; quiz mechanics and persistence differ |
| `skills/review/SKILL.md` | `.claude/skills/review/SKILL.md` | Ranking logic identical; CC notes the option cap |
| `skills/synthesize/SKILL.md` | `.claude/skills/synthesize/SKILL.md` | Identical except verification, which actually works on CC |
| `skills/graph/SKILL.md` | `.claude/skills/graph/SKILL.md` | Format spec identical; **ledger ownership differs** (see below) |
| `skills/graph/validate.mjs` | `.claude/skills/graph/validate.mjs` | **Verbatim copy** — must stay byte-identical |
| `skills/graph/examples/` | `.claude/skills/graph/examples/` | Verbatim copies |
| `skills/visualize/SKILL.md` | `.claude/skills/visualize/SKILL.md` | Substantially different — see below |
| `agents/researcher.md` | `.claude/agents/researcher.md` | Same output contract, different tools/model |
| `agents/mermaid-maker.md`, `agents/svg-maker.md` | *(none)* | Drove pi's custom render tools; no CC equivalent |
| `extensions/*.ts` | *(none)* | pi-specific; their behaviour is folded into the CC skills |

Check the verbatim pair any time:

```bash
diff skills/graph/validate.mjs .claude/skills/graph/validate.mjs
diff -r skills/graph/examples .claude/skills/graph/examples
```

## Tool mapping

| pi | Claude Code |
|---|---|
| `quiz` (graded TUI extension) | `AskUserQuestion` + grading in the following message |
| `ask_user_question` | `AskUserQuestion` |
| `subagent(agent="x", task=…)` | `Agent` tool, `subagent_type: "x"` |
| `web_search`, `web_fetch` | `WebSearch`, `WebFetch` |
| `read` | `Read` |
| `safe_bash` | `Bash` |
| `/md-log <file>` | Write the lesson note directly with `Write`/`Edit` |
| `write_mermaid` / `render_mermaid` | A ```mermaid``` block in the note; Obsidian renders it |
| `write_svg` / `render_svg` | *(no equivalent — capability lost)* |

## The three differences that are not cosmetic

**1. Quiz grading.** pi's `quiz` extension shuffled options, graded against a value-keyed answer, offered a built-in "I don't know" and a note field, and returned a structured result. Claude Code has none of that — the model asks with `AskUserQuestion` and grades in its next message.

Consequences to keep in mind when editing either side:
- `AskUserQuestion` allows only **2–4 options**. With "I don't know" taking one, that's the correct answer plus two distractors. pi allowed more. The CC skills compensate by asking more, smaller, adaptive questions.
- The option-construction procedure (bare claims, mutate the correct claim into distractors, no asymmetric bolding) is **prompt guidance and ports verbatim**. It lives in `teach/SKILL.md` on both sides. This is the part actually worth protecting.

**2. Ledger ownership.** pi's `extensions/mastery-ledger.ts` hooked the quiz tool result, so the record could not drift from what happened. Claude Code has no such hook: the model writes `graphs/.mastery.jsonl` itself.

This is strictly weaker, and both `graph` skills should keep saying so. The validator catches a malformed line or a bad node id; **nothing catches a line that was never written.** The CC skills mitigate by requiring the append in the same turn as the quiz-check, never batched.

If you ever want the pi guarantee back on CC, a `PostToolUse` hook on `AskUserQuestion` is the place to start — but it would need the answer key somewhere the hook can see it, which reintroduces a leak problem. Not attempted.

**3. Diagram verification.** pi dispatched `mermaid-maker`/`svg-maker`, which rendered to PNG, **looked at the image**, and iterated before publishing. Claude Code writes mermaid straight into the note with nothing verifying it.

`.claude/skills/visualize/SKILL.md` compensates with a hard rule: never assert anything in a diagram that isn't already established in the surrounding prose, and omit any edge you aren't sure of. Hand-authored SVG geometry is the capability genuinely lost.

## When you change the pedagogy

1. Edit the pi file.
2. Mirror it into the Claude Code file, remapping tool names via the table above.
3. If you touched `validate.mjs` or `examples/`, copy rather than re-edit, then run both `diff`s above.
4. Run the validator against both example trees.
