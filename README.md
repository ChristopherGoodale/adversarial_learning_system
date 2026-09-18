# learn

[![video](assets/thumbnail.png)](https://www.youtube.com/watch?v=kzcI5F4tGiU)

My AI learning system from this video: [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU).

This is a personal system I built for myself, shared as-is. Built as a pi configuration: the teaching philosophy encoded in a skill, a few small extensions, and agent definitions.

## What's in it

- `skills/teach/` — the philosophy and the process
- `skills/review/` — revisit a subject you already studied: find what decayed, re-teach only that
- `skills/synthesize/` — teach across two subjects, but only where the connection survives verification
- `skills/graph/` — the on-disk format for persisted graphs, bridges, and the mastery ledger
- `skills/visualize/` — adds a correct, minimal diagram to a lesson when an idea is clearer as a picture
- `extensions/ask-user-question/` — the agent asks you questions through a UI popup
- `extensions/quiz/` — graded questions with instant feedback (✓/✗, correct answer, explanation)
- `extensions/md-log/` — link a markdown file to the session
- `extensions/mastery-ledger/` — records graph-tagged quiz outcomes so review knows what decayed
- `extensions/visual-tools/` — tools for visualization subagents
- `agents/` — `researcher`, `svg-maker`, `mermaid-maker`: the subagents the system delegates to

## Three modes

| Mode | Say | What happens |
|---|---|---|
| **Learn** | "teach me integration by parts" | The original probe → plan → teach loop. Now also writes its dependency map to `graphs/<subject>.md`. |
| **Review** | "review calc 2" | Ranks the stored graph by decay risk, probes to find what rotted, re-teaches only those nodes. |
| **Combine** | "connect calc 2 and finance" | Finds a bridge between two graphs, **verifies it with the researcher before teaching it**, then teaches the joined path. |

Mode 1 is the system as originally built — the pedagogy is untouched. Modes 2 and 3 are additive and depend on the graph files mode 1 now leaves behind.

### Why bridges are verified, not reasoned

A cross-domain connection is trivially easy to generate and hard to check, and a false one is worse than an ordinary wrong fact because it gets hung between two true nodes. So every bridge is typed by how strong its evidence must be — a `formal` one where the same object literally appears in both domains is nearly free, while a `terminological` or `etymological` one (a Chinese character's history, a term's origin) needs a real citation and is never accepted on reasoning alone. Candidates that fail are recorded as `rejected` so no later session re-proposes them.

### Where your data lives

```
graphs/
  calc2.md          # nodes and edges for one subject
  chinese.md
  _bridges.md       # cross-domain connections, single source of truth
  .mastery.jsonl    # append-only quiz outcomes, written automatically
```

The graph files are plain markdown with a mermaid body, so they render and stay editable in Obsidian. The ledger is owned by the extension — don't hand-edit it. Validate any time with:

```bash
node skills/graph/validate.mjs graphs/
```

You don't need a separate project per subject: one vault, one `.pi`, one graph file per subject.

## Install

This repo **is** a `.pi` directory. From your learning project's root:

```bash
git clone https://github.com/amosblomqvist/learn .pi
```

Then open pi in that directory. (Or copy the pieces you want into your existing project config.)

## Requirements

- [pi](https://github.com/earendil-works/pi)
- A subagent implementation, so the system can spawn the researcher and the visual makers. Recommended: [pi-interactive-subagents](https://github.com/amosblomqvist/pi-interactive-subagents) (tmux only). With it, everything works out of the box. Any other implementation works too, but expect to adapt the agent definitions, e.g. `agents/researcher.md` lists `safe_bash` in its tools, which is specific to that extension.
- `ask-user-question` — use the copy bundled here. If your setup already has an `ask-user-question` extension, use **this** one in its place. Popups from different extensions serialize through a shared UI lock, which only works when it's the same implementation.
- Node 22.19+ (pi 0.85 requires it).

## Running on Windows

Run it inside **WSL2**, not native Windows. The subagent runner is tmux-only, and tmux has no native Windows build — without it you lose the researcher and the diagram makers, which means no bridge verification in combine mode.

```bash
# inside WSL (Ubuntu)
nvm install 22                                   # a LINUX node — see the gotcha below
npm i -g @earendil-works/pi-coding-agent
sudo apt install -y tmux librsvg2-bin chromium-browser   # diagram rendering
cd extensions/visual-tools && npm install        # bundles mermaid-cli
```

**Gotcha:** in a fresh WSL install, `npm` often resolves to your *Windows* nvm binary through PATH interop while `node` is missing from the Linux PATH entirely. Check with `which node npm` — both must be under your Linux home, not `/mnt/c/...`. Install a Linux node before anything else or you'll get confusing failures.

Keep the vault under `/mnt/c/...` so Obsidian reads it natively from Windows. These are small markdown files, so the filesystem-bridge cost is irrelevant, and `\\wsl$\` mounts are flakier for Obsidian.

If mermaid can't find your browser, set `PUPPETEER_EXECUTABLE_PATH` (or `CHROME_PATH`) to it — browser discovery checks that first, then known install paths, then your PATH.

## Notes

You can run the system without subagents. The main session does the teaching. You just lose the researcher (truth verification) and the generated visuals.

The teaching skill is written for one learner (me). Edit the skill to fit how you learn best.
