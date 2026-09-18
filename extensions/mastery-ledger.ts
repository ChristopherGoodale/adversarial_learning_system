/**
 * mastery-ledger — record every graph-tagged quiz outcome to an append-only log.
 *
 * The teaching system builds a dependency graph of what he knows; the domain
 * graph files say what the nodes ARE, and this ledger says how he has actually
 * performed on them. The review skill ranks nodes by decay using this file, and
 * the synthesize skill checks it before hanging a bridge off a node he may not
 * hold.
 *
 * Why an extension rather than asking the agent to write it down: this is
 * high-frequency factual state about the learner. An agent that forgets one
 * append, or "remembers" an outcome slightly wrong, produces a ledger that is
 * worse than no ledger — it would be confidently wrong about what he knows.
 * Hooking the tool result makes the record a byproduct of the quiz actually
 * happening, so it cannot drift from what occurred.
 *
 * Writes ONE json line per tagged quiz to <cwd>/graphs/.mastery.jsonl:
 *   {"ts":"...","subject":"calc2","node":"riemann-sum","correct":true,"dontKnow":false}
 *
 * Quizzes without `subject`/`node` are ignored entirely, so ordinary untagged
 * teaching sessions behave exactly as they did before this extension existed.
 *
 * Commands:
 *   /mastery [subject]  — show current state per node (last entry wins).
 *
 * Modeled on md-log.ts: same event hook, same serialized-append discipline.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

const GRAPHS_DIRNAME = "graphs";
const LEDGER_FILENAME = ".mastery.jsonl";

interface LedgerEntry {
	ts: string;
	subject: string;
	node: string;
	correct: boolean;
	dontKnow: boolean;
	note?: string;
}

export default function masteryLedger(pi: ExtensionAPI) {
	function ledgerPath(ctx: any): string {
		return path.join(ctx.cwd, GRAPHS_DIRNAME, LEDGER_FILENAME);
	}

	// --- Serialization: quiz results can land close together; keep appends ordered ---

	let writeLock: Promise<void> = Promise.resolve();
	function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
		const prev = writeLock;
		let release: () => void;
		writeLock = new Promise<void>((r) => {
			release = r;
		});
		return prev.then(fn).finally(() => release!());
	}

	function append(file: string, entry: LedgerEntry): void {
		try {
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, "utf-8");
		} catch {
			// A failed append must never take down the lesson in progress.
		}
	}

	function readEntries(file: string): LedgerEntry[] {
		if (!fs.existsSync(file)) return [];
		const out: LedgerEntry[] = [];
		for (const line of fs.readFileSync(file, "utf-8").split("\n")) {
			if (!line.trim()) continue;
			try {
				out.push(JSON.parse(line) as LedgerEntry);
			} catch {
				// Skip a corrupt line rather than discarding the whole history.
			}
		}
		return out;
	}

	// A node's current state is its most recent entry; earlier ones are history.
	function latestByNode(entries: LedgerEntry[]): Map<string, LedgerEntry> {
		const latest = new Map<string, LedgerEntry>();
		for (const entry of entries) {
			if (!entry.subject || !entry.node) continue;
			const key = `${entry.subject}:${entry.node}`;
			const prev = latest.get(key);
			if (!prev || Date.parse(entry.ts) >= Date.parse(prev.ts)) latest.set(key, entry);
		}
		return latest;
	}

	// --- Capture ---

	pi.on("tool_result", async (event, ctx) => {
		const toolName = (event as any).toolName;
		if (toolName !== "quiz") return;

		const details = (event as any).details;
		// Untagged quiz (plain teaching, or a probe not tied to a stored graph):
		// nothing to record. This is the no-op path that keeps mode 1 unchanged.
		if (!details || !details.subject || !details.node) return;
		if (details.status !== "answered") return;

		const entry: LedgerEntry = {
			ts: new Date().toISOString(),
			subject: String(details.subject),
			node: String(details.node),
			correct: details.correct === true,
			dontKnow: details.dontKnow === true,
		};
		if (details.note) entry.note = String(details.note);

		await withLock(() => append(ledgerPath(ctx), entry));
	});

	// --- Status ---

	pi.on("session_start", async (_event, ctx) => {
		const entries = readEntries(ledgerPath(ctx));
		if (entries.length === 0) return;
		const tracked = latestByNode(entries).size;
		const theme = ctx.ui.theme;
		ctx.ui.setStatus("mastery", theme.fg("accent", "\u{1F4CA} ") + theme.fg("dim", `${tracked} nodes`));
	});

	// --- Commands ---

	pi.registerCommand("mastery", {
		description: "Show recorded quiz outcomes per graph node (optionally for one subject)",
		handler: async (args, ctx: any) => {
			const file = ledgerPath(ctx);
			const filter = args.trim();
			const entries = readEntries(file);

			if (entries.length === 0) {
				ctx.ui.notify(`No mastery records yet (${file})`, "warning");
				return;
			}

			const all = [...latestByNode(entries).entries()]
				.filter(([key]) => !filter || key.startsWith(`${filter}:`))
				.sort(([a], [b]) => a.localeCompare(b));

			if (all.length === 0) {
				ctx.ui.notify(`No records for subject "${filter}"`, "warning");
				return;
			}

			// Count total attempts per node — a node that keeps breaking is fragile
			// even when its most recent answer happened to be correct.
			const misses = new Map<string, number>();
			for (const e of entries) {
				if (e.correct) continue;
				const key = `${e.subject}:${e.node}`;
				misses.set(key, (misses.get(key) ?? 0) + 1);
			}

			const lines = all.map(([key, entry]) => {
				const state = entry.dontKnow ? "unknown" : entry.correct ? "solid  " : "shaky  ";
				const missCount = misses.get(key) ?? 0;
				const history = missCount > 1 ? ` (${missCount} misses)` : "";
				return `${state}  ${key}  ${entry.ts.slice(0, 10)}${history}`;
			});

			ctx.ui.notify(`${lines.length} node(s)\n${lines.join("\n")}`, "info");
		},
	});
}
