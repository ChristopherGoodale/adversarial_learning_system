# learn

[![video](assets/thumbnail.png)](https://www.youtube.com/watch?v=kzcI5F4tGiU)

An AI learning system, forked from [amosblomqvist/learn](https://github.com/amosblomqvist/learn) and the video [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU).

The original encoded a teaching philosophy as a [pi](https://github.com/earendil-works/pi) configuration. This fork adds two more modes — reviewing a subject for decay, and teaching across two subjects — persists what you've learned to disk so later sessions build on earlier ones, and adds a **Claude Code implementation that runs natively on Windows**.

## Quick start (Claude Code, Windows / macOS / Linux)

Your vault is an ordinary folder. The config goes inside it.

```bash
mkdir MyLearning && cd MyLearning
git clone https://github.com/ChristopherGoodale/adversarial_learning_system.git /tmp/als
cp -r /tmp/als/.claude .
mkdir graphs && touch calc2.md
claude
```

On Windows PowerShell, replace `/tmp/als` with `$env:TEMP\als` and `cp -r` with `Copy-Item -Recurse`.

Then say what you want — *"teach me integration by parts"*, *"review calc 2"*, *"connect calc 2 and finance"*. Open the same folder as an Obsidian vault to read the lessons rendered, with maths and diagrams.

Nothing else to install: subagents and web search are built into Claude Code.

**Keep your vault out of version control.** Graphs and lesson notes are personal; the config is what's shared.

## Three modes

| Mode | Say | What happens |
|---|---|---|
| **Learn** | "teach me integration by parts" | The original probe → plan → teach loop, now also writing its dependency map to `graphs/<subject>.md`. |
| **Review** | "review calc 2" | Ranks the stored graph by decay risk, probes to find what rotted, re-teaches only those nodes. |
| **Combine** | "connect calc 2 and finance" | Finds a bridge between two graphs, **verifies it before teaching it**, then teaches the joined path. |

Mode 1 is the system as originally built — the pedagogy is untouched. Modes 2 and 3 are additive and depend on the graph files mode 1 leaves behind.

### Why bridges are verified, not reasoned

A cross-domain connection is trivially easy to generate and hard to check, and a false one is worse than an ordinary wrong fact because it gets hung between two true nodes. So every bridge is typed by how strong its evidence must be — a `formal` one where the same object literally appears in both domains is nearly free, while a `terminological` or `etymological` one (a Chinese character's history, a term's origin) needs a real citation and is never accepted on reasoning alone. Candidates that fail are recorded as `rejected` so no later session re-proposes them.

### Where your data lives

```
graphs/
  calc2.md          # nodes and edges for one subject
  chinese.md
  _bridges.md       # cross-domain connections, single source of truth
  .mastery.jsonl    # append-only quiz outcomes
```

Graph files are plain markdown with a mermaid body, so they render and stay editable in Obsidian. Validate any time:

```bash
node .claude/skills/graph/validate.mjs graphs/     # Claude Code
node .pi/skills/graph/validate.mjs graphs/         # pi
```

It checks that node ids are unique and stable, dependencies resolve, the mermaid body agrees with the frontmatter in both directions, bridge endpoints point at real nodes, and `verified` bridges actually carry a source.

You don't need a separate project per subject: one vault, one config, one graph file per subject.

## What's in it

**Shared concepts** — the teaching philosophy, the graph format, the three modes. Both implementations carry these; see [PORTING.md](PORTING.md) for the file pairs.

**`.claude/`** — the Claude Code implementation.

- `skills/teach/` — the philosophy and the process
- `skills/review/` — find what decayed in a subject, re-teach only that
- `skills/synthesize/` — teach across two subjects, where the connection survives verification
- `skills/graph/` — the on-disk format for graphs, bridges, and the mastery ledger, plus the validator
- `skills/visualize/` — adds a minimal mermaid diagram when an idea is clearer as a picture
- `agents/researcher.md` — web research and fact verification

**`skills/`, `agents/`, `extensions/`** — the pi implementation.

- The same five skills, plus the subagents and TypeScript extensions pi needs
- `extensions/quiz/` — graded questions with instant ✓/✗ feedback in the terminal
- `extensions/md-log/` — mirrors the session into a markdown file automatically
- `extensions/mastery-ledger/` — records quiz outcomes by hooking the quiz tool result
- `extensions/visual-tools/` — renders mermaid and SVG to images for the diagram subagents
- `extensions/web-tools/` — `web_search` / `web_fetch`, so the researcher can actually verify things

## Choosing an implementation

| | [Claude Code](https://claude.com/claude-code) | [pi](https://github.com/earendil-works/pi) |
|---|---|---|
| Installs as | `.claude/` in your vault | `.pi/` in your vault |
| Windows | Native | Native (via WezTerm) |
| Setup | Clone and run | Node, a terminal multiplexer, a subagent package |
| Quizzes | Asked in chat, graded in the reply, 2–4 options | **Custom terminal UI, more options, instant ✓/✗** |
| Mastery ledger | Written by the model | **Captured automatically from the tool result** |
| Web research | Built in | Needs an API key (Tavily or Brave) |
| Diagrams | Mermaid written into the note | **Rendered to PNG and visually verified first** |

**Claude Code is the easier start** — clone, run, done, with web search already working.

**pi gives a better quiz experience, a more trustworthy ledger, and verified diagrams.** Its quiz is a real graded UI rather than a chat question; because an extension captures outcomes from the tool result, the record can't drift from what happened; and the diagram subagents look at the rendered image before returning it. On Claude Code the model writes the ledger itself — the validator catches a malformed entry, but nothing catches a forgotten one.

## Running the pi version

pi runs **natively on Windows** (it uses Git Bash), as well as macOS and Linux. Subagents need a terminal multiplexer, and WezTerm is the one that works everywhere.

Requirements:

- [pi](https://github.com/earendil-works/pi), and Node 22.19+ (pi 0.85 requires it)
- A multiplexer for the subagents: [WezTerm](https://wezfurlong.org/wezterm/) (all platforms), or cmux / tmux / zellij on Unix
- [pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents) — use **this upstream project**, which supports all four multiplexers. The `amosblomqvist` fork linked by the original README is explicitly tmux-only.
- The bundled `ask-user-question` extension. If your setup already has one, use **this** copy in its place: popups serialize through a shared UI lock that only works when it's the same implementation.
- A search API key, if you want the researcher to actually search (see below)

```bash
# in your vault
git clone https://github.com/ChristopherGoodale/adversarial_learning_system.git .pi
npm i -g @earendil-works/pi-coding-agent
cd .pi/extensions/visual-tools && npm install && cd ../../..
```

Then run `pi` **inside WezTerm** — no wrapper needed; it detects the multiplexer itself. On Unix you can instead use `tmux new -A -s pi 'pi'`, `cmux pi`, or `zellij --session pi`.

### Web search

pi ships no web tools at all, so `extensions/web-tools/` provides `web_search` and `web_fetch`. Set **one** of these and restart pi:

```bash
TAVILY_API_KEY=tvly-...     # https://tavily.com — preferred
BRAVE_API_KEY=BSA...        # https://brave.com/search/api/
```

Tavily is preferred when both are set: its results come with extracted page text, so neither tool has to parse HTML. With no key, both tools report that search is **unavailable** rather than returning nothing — so the researcher says it couldn't check, instead of quietly answering from memory.

### Diagram rendering

Mermaid needs a Chrome-family browser; SVG tries `rsvg-convert`, then that same browser, then ImageMagick. On Windows the browser is found automatically under `Program Files`; on Linux install `librsvg2-bin` and `chromium-browser`. If detection fails anywhere, set `PUPPETEER_EXECUTABLE_PATH` or `CHROME_PATH` — those are checked first.

## Notes

Both versions run without subagents — the main session does the teaching. You lose truth verification and generated visuals, which matters most in combine mode, where an unverified bridge is exactly the failure that mode exists to prevent.

The teaching skill was written for one learner. Edit it to fit how you learn best — that's the point of it being a config rather than a product.
