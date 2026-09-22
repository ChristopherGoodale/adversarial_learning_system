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

- [pi](https://github.com/earendil-works/pi) 0.87+, and Node 22.19+
- **A model provider.** A Claude Pro/Max subscription **will not work** — Anthropic no longer lets third-party apps draw on plan limits. See [Model provider](#model-provider) below.
- A multiplexer for the subagents: [WezTerm](https://wezfurlong.org/wezterm/) (all platforms), or cmux / tmux / zellij on Unix
- [pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents) — use **this upstream project**, which supports all four multiplexers. The `amosblomqvist` fork linked by the original README is explicitly tmux-only.
- The bundled `ask-user-question` extension. If your setup already has one, use **this** copy in its place: popups serialize through a shared UI lock that only works when it's the same implementation.
- A search API key, if you want the researcher to actually search (see below)

### Windows quickstart

Do these in order. Steps 1–5 are once, ever.

**1. Node and pi**

```powershell
nvm install 22.19.0
nvm use 22.19.0
npm i -g @earendil-works/pi-coding-agent
```

**2. WezTerm** — needed for subagents (researcher, diagram makers)

```powershell
winget install wez.wezterm
```

**3. The vault** — an ordinary folder; config goes inside it

```powershell
mkdir $HOME\Documents\MyLearning
cd $HOME\Documents\MyLearning
git clone https://github.com/ChristopherGoodale/adversarial_learning_system.git .pi
mkdir graphs
New-Item calc2.md
cd .pi\extensions\visual-tools; npm install; cd ..\..\..
```

**4. API keys** — set them *before* opening the terminal you'll run pi in

```powershell
setx OPENROUTER_API_KEY "sk-or-v1-..."
setx TAVILY_API_KEY "tvly-..."
```

**5. Point pi at the key instead of storing a copy.** Create or edit `%USERPROFILE%\.pi\agent\auth.json`:

```json
{ "openrouter": { "type": "api_key", "key": "$OPENROUTER_API_KEY" } }
```

pi resolves `$OPENROUTER_API_KEY` from the environment at call time, so the secret lives in one place and `auth.json` never holds it. **Do this rather than pasting the key into `/login`** — auth-file credentials take priority over environment variables, so a bad paste silently overrides a perfectly good variable.

**6. Every session** — open **WezTerm** (not VS Code's terminal), then:

```powershell
cd $HOME\Documents\MyLearning
pi.cmd
```

Two details that matter: it's `pi.cmd`, not `pi` (PowerShell blocks npm's `.ps1` shim unless you've changed your execution policy), and you **must `cd` into the vault first** — pi loads `.pi/` from the current directory, and launching elsewhere silently gives you no skills and no extensions.

You should see `graph, review, synthesize, teach, visualize` under `[Skills]` and six entries under `[Extensions]`. If not, you're in the wrong directory.

**7. Teach something**

```
/md-log calc2.md
teach me integration by parts
```

### On macOS and Linux

Same steps, minus the Windows-specific parts: `pi` rather than `pi.cmd`, `export` rather than `setx`. You can use any supported multiplexer — `tmux new -A -s pi 'pi'`, `cmux pi`, or `zellij --session pi` — or WezTerm, which needs no wrapper since pi detects it.

### Model provider

**A Claude Pro/Max subscription does not power pi.** Anthropic meters third-party apps against a separate "extra usage" balance rather than plan limits, so `/login anthropic` authenticates fine and then every request fails with a 400 telling you to add extra usage. This is policy, not a pi bug, and nothing in pi can work around it.

Working options:

- **OpenRouter** — one key, any model, swap freely with `Ctrl+L`. Prepaid; `:free`-tagged models cost nothing but are rate-limited. This is the most vendor-neutral choice and what the setup above assumes.
- **A free API tier** — Google Gemini, Groq, Cerebras and NVIDIA NIM are all in pi's provider list.
- **Anthropic extra usage** — top up at `claude.ai/settings/usage` if you want Claude specifically.

If you'd rather not deal with any of this, the Claude Code implementation is first-party and covered by a Claude subscription.

### Web search

pi ships no web tools at all, so `extensions/web-tools/` provides `web_search` and `web_fetch`. Set **one** of these and restart pi:

```bash
TAVILY_API_KEY=tvly-...     # https://tavily.com — preferred
BRAVE_API_KEY=BSA...        # https://brave.com/search/api/
```

Tavily is preferred when both are set: its results come with extracted page text, so neither tool has to parse HTML. With no key, both tools report that search is **unavailable** rather than returning nothing — so the researcher says it couldn't check, instead of quietly answering from memory.

### Diagram rendering

Mermaid needs a Chrome-family browser; SVG tries `rsvg-convert`, then that same browser, then ImageMagick. On Windows the browser is found automatically under `Program Files`; on Linux install `librsvg2-bin` and `chromium-browser`. If detection fails anywhere, set `PUPPETEER_EXECUTABLE_PATH` or `CHROME_PATH` — those are checked first.

### When it breaks

Every one of these was hit during a real Windows setup. None of them fails in an obvious way.

| Symptom | Cause | Fix |
|---|---|---|
| `pi.ps1 cannot be loaded because running scripts is disabled` | PowerShell blocks npm's `.ps1` shim | Use `pi.cmd`. Or `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` for plain `pi` |
| pi starts but `/md-log` isn't a command, and no skills are listed | Launched outside the vault, so `.pi/` was never found | `cd` into the vault, relaunch. Check `[Skills]` lists five |
| `400 … Third-party apps now draw from your extra usage` | Anthropic subscription can't power third-party apps | Use a different provider — see [Model provider](#model-provider) |
| `401 Missing Authentication header` | pi has no usable credential for the selected provider | Check `auth.json`: an empty or malformed `key` **overrides** your environment variable |
| `echo $env:YOUR_KEY` prints nothing right after `setx` | `setx` only affects *new* processes | Close the terminal, open a fresh one from the Start menu — not from another window |
| Key looks set in the registry but pi still 401s | A stale terminal passed an empty value into `/login`, which stored it | Use the `"key": "$YOUR_VAR"` form in `auth.json` instead of pasting |
| OAuth login fails with `EADDRINUSE 127.0.0.1:53692` | pi's callback port is hardcoded and something else holds it | Close whatever has it (VS Code is a common culprit) and retry |

The pattern behind most of these: **a stale environment.** `setx` writes to the registry, but every already-running process keeps the environment it was born with — including terminals, and anything launched from them. After setting a variable, open a genuinely new window before doing anything else.

## Notes

Both versions run without subagents — the main session does the teaching. You lose truth verification and generated visuals, which matters most in combine mode, where an unverified bridge is exactly the failure that mode exists to prevent.

The teaching skill was written for one learner. Edit it to fit how you learn best — that's the point of it being a config rather than a product.
