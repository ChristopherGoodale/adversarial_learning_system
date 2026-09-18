#!/usr/bin/env node
/**
 * validate.mjs — structural checks for the persisted knowledge layer.
 *
 *   node skills/graph/validate.mjs graphs/
 *   node skills/graph/validate.mjs skills/graph/examples/
 *   node skills/graph/validate.mjs graphs/calc2.md
 *
 * Checks domain graphs (frontmatter vs mermaid agreement, dep resolution,
 * unique ids), the bridge index (endpoints resolve, verified bridges carry
 * evidence), and the mastery ledger (lines parse, nodes exist).
 *
 * Deliberately dependency-free: this repo has no installed node_modules and is
 * meant to be clonable straight into a `.pi` directory. The YAML parsed here is
 * the small, fixed subset the graph format uses — scalars, one list level, and
 * inline `[a, b]` arrays — not general YAML.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

const NODE_KINDS = new Set(["unconditional-truth", "derived"]);
const BRIDGE_KINDS = new Set(["formal", "structural", "terminological", "etymological"]);
const BRIDGE_STATUSES = new Set(["candidate", "verified", "rejected"]);
// Bare words the mermaid flowchart parser chokes on as node ids.
const MERMAID_RESERVED = new Set(["end", "graph", "o", "x", "subgraph", "click", "style"]);

const problems = [];
function fail(file, msg) {
	problems.push(`${file}: ${msg}`);
}

// ── YAML subset ─────────────────────────────────────────────────────────────

function parseScalar(raw) {
	const v = raw.trim();
	if (v === "") return "";
	if (v === "true") return true;
	if (v === "false") return false;
	if (v.startsWith("[") && v.endsWith("]")) {
		const inner = v.slice(1, -1).trim();
		if (!inner) return [];
		return inner.split(",").map((s) => stripQuotes(s.trim()));
	}
	return stripQuotes(v);
}

function stripQuotes(v) {
	if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
		return v.slice(1, -1);
	}
	return v;
}

/** Parse the constrained YAML subset: top-level scalars and one list level. */
function parseYaml(text) {
	const out = {};
	let listKey = null;
	let item = null;

	for (const line of text.split("\n")) {
		if (!line.trim() || line.trim().startsWith("#")) continue;

		const listItem = /^\s*-\s*([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
		if (listItem && listKey) {
			item = { [listItem[1]]: parseScalar(listItem[2]) };
			out[listKey].push(item);
			continue;
		}

		const indented = /^\s+([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
		if (indented && item) {
			item[indented[1]] = parseScalar(indented[2]);
			continue;
		}

		const top = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
		if (top) {
			const [, key, rest] = top;
			if (rest.trim() === "") {
				listKey = key;
				item = null;
				out[key] = [];
			} else {
				listKey = null;
				item = null;
				out[key] = parseScalar(rest);
			}
		}
	}
	return out;
}

function splitFrontmatter(text, file) {
	const normalized = text.replace(/^﻿/, "");
	if (!normalized.startsWith("---")) {
		fail(file, "no YAML frontmatter (file must start with ---)");
		return null;
	}
	const end = normalized.indexOf("\n---", 3);
	if (end === -1) {
		fail(file, "frontmatter is never closed with ---");
		return null;
	}
	return {
		front: normalized.slice(normalized.indexOf("\n") + 1, end),
		body: normalized.slice(end + 4),
	};
}

// ── mermaid ─────────────────────────────────────────────────────────────────

/** Collect node ids referenced in the file's mermaid block(s). */
function mermaidNodeIds(body) {
	const ids = new Set();
	const blocks = body.matchAll(/```mermaid\n([\s\S]*?)```/g);
	for (const [, block] of blocks) {
		for (const rawLine of block.split("\n")) {
			const line = rawLine.trim();
			if (!line || line.startsWith("%%")) continue;
			if (/^(graph|flowchart)\b/.test(line)) continue;
			// Split on any mermaid edge form: -->, ---, -.->, ==>
			for (const side of line.split(/-{2,3}>|-\.->|={2}>|-{3}/)) {
				const id = /^([A-Za-z0-9_-]+)/.exec(side.trim());
				if (id) ids.add(id[1]);
			}
		}
	}
	return ids;
}

// ── checks ──────────────────────────────────────────────────────────────────

function checkGraph(file, front, body) {
	const name = basename(file);
	for (const key of ["subject", "title", "updated"]) {
		if (!front[key]) fail(name, `missing required frontmatter key \`${key}\``);
	}
	const stem = basename(file, extname(file));
	if (front.subject && front.subject !== stem) {
		fail(name, `subject "${front.subject}" does not match filename stem "${stem}"`);
	}
	if (front.updated && !/^\d{4}-\d{2}-\d{2}$/.test(String(front.updated))) {
		fail(name, `updated "${front.updated}" is not an ISO date (YYYY-MM-DD)`);
	}

	const nodes = Array.isArray(front.nodes) ? front.nodes : [];
	if (nodes.length === 0) {
		fail(name, "no nodes declared");
		return { subject: front.subject || stem, ids: new Set() };
	}

	const ids = new Set();
	for (const node of nodes) {
		if (!node.id) {
			fail(name, `a node is missing \`id\` (label: ${node.label ?? "?"})`);
			continue;
		}
		if (ids.has(node.id)) fail(name, `duplicate node id "${node.id}"`);
		ids.add(node.id);

		if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(node.id)) {
			fail(name, `node id "${node.id}" is not stable kebab-case`);
		}
		if (MERMAID_RESERVED.has(node.id)) {
			fail(name, `node id "${node.id}" is a mermaid reserved word — prefix it`);
		}
		if (!node.label) fail(name, `node "${node.id}" is missing \`label\``);
		if (!NODE_KINDS.has(node.kind)) {
			fail(name, `node "${node.id}" has kind "${node.kind}" (expected one of: ${[...NODE_KINDS].join(", ")})`);
		}
		if (node.deps === undefined) fail(name, `node "${node.id}" is missing \`deps\` (use [] for a root)`);
	}

	for (const node of nodes) {
		const deps = Array.isArray(node.deps) ? node.deps : [];
		for (const dep of deps) {
			if (!ids.has(dep)) fail(name, `node "${node.id}" depends on unknown node "${dep}"`);
		}
		if (node.kind === "unconditional-truth" && deps.length > 0) {
			fail(name, `node "${node.id}" is an unconditional-truth but declares deps — roots have none`);
		}
		if (node.kind === "derived" && deps.length === 0) {
			fail(name, `node "${node.id}" is derived but has no deps — it would be an orphan`);
		}
	}

	// Body and frontmatter must agree in BOTH directions.
	const drawn = mermaidNodeIds(body);
	if (drawn.size === 0) fail(name, "no mermaid block found in the body");
	for (const id of drawn) {
		if (!ids.has(id)) fail(name, `mermaid draws "${id}" which is not declared in \`nodes\``);
	}
	for (const id of ids) {
		if (!drawn.has(id)) fail(name, `node "${id}" is declared but never drawn in the mermaid block`);
	}

	return { subject: front.subject || stem, ids };
}

function checkBridges(file, front, graphs) {
	const name = basename(file);
	const bridges = Array.isArray(front.bridges) ? front.bridges : [];
	if (bridges.length === 0) {
		fail(name, "no bridges declared");
		return;
	}

	const resolve = (ref, which, i) => {
		if (!ref) {
			fail(name, `bridge ${i}: missing \`${which}\``);
			return;
		}
		const parts = String(ref).split(":");
		if (parts.length !== 2) {
			fail(name, `bridge ${i}: \`${which}\` "${ref}" is not in subject:node form`);
			return;
		}
		const [subject, node] = parts;
		const graph = graphs.get(subject);
		if (!graph) {
			fail(name, `bridge ${i}: \`${which}\` references unknown subject "${subject}"`);
			return;
		}
		if (!graph.has(node)) {
			fail(name, `bridge ${i}: \`${which}\` references unknown node "${node}" in subject "${subject}"`);
		}
	};

	bridges.forEach((bridge, idx) => {
		const i = idx + 1;
		resolve(bridge.from, "from", i);
		resolve(bridge.to, "to", i);

		if (!BRIDGE_KINDS.has(bridge.kind)) {
			fail(name, `bridge ${i}: kind "${bridge.kind}" (expected one of: ${[...BRIDGE_KINDS].join(", ")})`);
		}
		if (!BRIDGE_STATUSES.has(bridge.status)) {
			fail(name, `bridge ${i}: status "${bridge.status}" (expected one of: ${[...BRIDGE_STATUSES].join(", ")})`);
		}
		if (!bridge.claim) fail(name, `bridge ${i}: missing \`claim\``);
		if (!bridge.checked) fail(name, `bridge ${i}: missing \`checked\``);

		const evidence = Array.isArray(bridge.evidence) ? bridge.evidence : [];
		// The core accuracy guarantee: nothing reaches a lesson without a source.
		if (bridge.status === "verified" && evidence.length === 0) {
			fail(name, `bridge ${i}: status is verified but \`evidence\` is empty — a verified bridge must cite a source`);
		}
	});
}

function checkLedger(file, text, graphs) {
	const name = basename(file);
	text.split("\n").forEach((line, idx) => {
		if (!line.trim()) return;
		const n = idx + 1;
		let entry;
		try {
			entry = JSON.parse(line);
		} catch {
			fail(name, `line ${n}: not valid JSON`);
			return;
		}
		for (const key of ["ts", "subject", "node"]) {
			if (!entry[key]) fail(name, `line ${n}: missing \`${key}\``);
		}
		if (entry.ts && Number.isNaN(Date.parse(entry.ts))) {
			fail(name, `line ${n}: ts "${entry.ts}" is not a parseable timestamp`);
		}
		const graph = graphs.get(entry.subject);
		if (graph && entry.node && !graph.has(entry.node)) {
			fail(name, `line ${n}: node "${entry.node}" does not exist in subject "${entry.subject}" (renamed id?)`);
		}
	});
}

// ── ledger state resolution (last entry wins) ───────────────────────────────

function summarizeLedger(text) {
	const latest = new Map();
	for (const line of text.split("\n")) {
		if (!line.trim()) continue;
		let entry;
		try {
			entry = JSON.parse(line);
		} catch {
			continue;
		}
		const key = `${entry.subject}:${entry.node}`;
		const prev = latest.get(key);
		if (!prev || Date.parse(entry.ts) >= Date.parse(prev.ts)) latest.set(key, entry);
	}
	return latest;
}

// ── entry ───────────────────────────────────────────────────────────────────

const target = process.argv[2];
if (!target) {
	console.error("usage: node skills/graph/validate.mjs <graphs-dir | file>");
	process.exit(2);
}

let files;
try {
	files = statSync(target).isDirectory()
		? readdirSync(target)
				.filter((f) => f.endsWith(".md") || f.endsWith(".jsonl"))
				.map((f) => join(target, f))
		: [target];
} catch (err) {
	console.error(`cannot read ${target}: ${err.message}`);
	process.exit(2);
}

// Two passes: domain graphs first, so bridges and ledger entries can resolve
// their references against real node ids.
const graphs = new Map();
const deferred = [];

for (const file of files) {
	if (file.endsWith(".jsonl")) {
		deferred.push({ kind: "ledger", file, text: readFileSync(file, "utf8") });
		continue;
	}
	const text = readFileSync(file, "utf8");
	const split = splitFrontmatter(text, basename(file));
	if (!split) continue;
	const front = parseYaml(split.front);

	if (front.bridges !== undefined) {
		deferred.push({ kind: "bridges", file, front });
	} else {
		const { subject, ids } = checkGraph(file, front, split.body);
		if (graphs.has(subject)) fail(basename(file), `subject "${subject}" is already defined by another file`);
		graphs.set(subject, ids);
	}
}

for (const job of deferred) {
	if (job.kind === "bridges") checkBridges(job.file, job.front, graphs);
	else checkLedger(job.file, job.text, graphs);
}

const graphCount = graphs.size;
const nodeCount = [...graphs.values()].reduce((n, ids) => n + ids.size, 0);

if (problems.length > 0) {
	console.error(`FAIL — ${problems.length} problem(s):\n`);
	for (const p of problems) console.error(`  - ${p}`);
	process.exit(1);
}

console.log(`OK — ${graphCount} graph(s), ${nodeCount} node(s), ${deferred.length} auxiliary file(s) checked.`);

for (const job of deferred) {
	if (job.kind !== "ledger") continue;
	const latest = summarizeLedger(job.text);
	if (latest.size === 0) continue;
	console.log(`\n${basename(job.file)} — current state (last entry wins):`);
	for (const [key, entry] of [...latest].sort()) {
		const state = entry.dontKnow ? "unknown" : entry.correct ? "solid  " : "shaky  ";
		console.log(`  ${state}  ${key}  (${entry.ts.slice(0, 10)})`);
	}
}
