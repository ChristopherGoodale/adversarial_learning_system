/**
 * Shared helpers for the visual-tools authoring loops (mermaid_tools.ts,
 * svg_tools.ts): a subprocess runner, a per-session managed source file, an
 * exact-match editor (pi-edit semantics), and publishing a chosen render into
 * <cwd>/viz with a unique filename.
 *
 * Each tool file keeps its OWN session state (importing the type/helpers here),
 * so mermaid and svg never share a source file.
 */

import { spawn } from "node:child_process"
import { tmpdir } from "node:os"
import { basename, delimiter, dirname, join } from "node:path"
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"

// Augment PATH so the child pi process (which may have inherited a thin PATH)
// still resolves rsvg-convert / magick. macOS scatters them across MacPorts
// (/opt/local/bin) and Homebrew (/opt/homebrew/bin); Linux keeps them in the
// standard bin dirs, with snap packages off in /snap/bin.
export const EXTRA_PATH = ["/opt/local/bin", "/usr/local/bin", "/opt/homebrew/bin", "/usr/bin", "/snap/bin"]

// Transient session/preview files live under the OS temp dir (NOT the vault),
// so only the PUBLISHED PNG ever lands inside the Obsidian vault (viz/).
export const STAGING_ROOT = join(tmpdir(), "pi-visual-tools")
export const FILES_DIRNAME = "viz"

/** Windows install roots, read from the environment rather than hardcoding C:. */
function windowsChromeCandidates(): string[] {
  const roots = [
    process.env.PROGRAMFILES,
    process.env["PROGRAMFILES(X86)"],
    process.env.LOCALAPPDATA,
  ].filter((r): r is string => Boolean(r))

  const suffixes = [
    join("Google", "Chrome", "Application", "chrome.exe"),
    join("Chromium", "Application", "chrome.exe"),
    join("Microsoft", "Edge", "Application", "msedge.exe"),
  ]

  return roots.flatMap((root) => suffixes.map((s) => join(root, s)))
}

export const CHROME_CANDIDATES = [
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  // Linux / WSL
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
  // Windows
  ...windowsChromeCandidates(),
]

// Bare names the PATH scan tries. The .exe entries matter on Windows, where the
// binary is never called `google-chrome`.
const CHROME_BINARIES = [
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
  "chrome.exe",
  "msedge.exe",
]

/**
 * Locate a browser for mermaid-cli to drive. Checked in priority order:
 * an explicit env override, then known install paths, then a PATH scan —
 * distro and nix packages land in directories we cannot enumerate up front.
 * Returning undefined is not fatal: the caller omits `executablePath` and
 * lets puppeteer try its own bundled browser.
 */
export function findChrome(): string | undefined {
  const override = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH
  if (override && existsSync(override)) return override

  for (const c of CHROME_CANDIDATES) if (existsSync(c)) return c

  for (const dir of [...EXTRA_PATH, ...(process.env.PATH ?? "").split(delimiter)]) {
    if (!dir) continue
    for (const bin of CHROME_BINARIES) {
      const full = join(dir, bin)
      if (existsSync(full)) return full
    }
  }
  return undefined
}

export interface RunResult {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

export function run(
  cmd: string,
  args: string[],
  opts: { cwd: string; timeoutMs: number; env?: Record<string, string> },
): Promise<RunResult> {
  return new Promise((resolveRun) => {
    const augmentedPath = [...EXTRA_PATH, process.env.PATH ?? ""].join(delimiter)
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...(opts.env ?? {}), PATH: augmentedPath },
    })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, opts.timeoutMs)
    child.stdout.on("data", (d) => (stdout += d.toString()))
    child.stderr.on("data", (d) => (stderr += d.toString()))
    child.on("error", (err) => {
      clearTimeout(timer)
      resolveRun({ code: null, stdout, stderr: stderr + String(err), timedOut })
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolveRun({ code, stdout, stderr, timedOut })
    })
  })
}

/** Per-session managed source file, one per child pi process (pid-keyed). */
export interface Session {
  workDir: string
  bodyPath: string
}

/** Per-session work dir under the OS temp dir, keyed by pid + a group name. */
export function sessionDir(group: string): string {
  return join(STAGING_ROOT, `${group}-${process.pid}`)
}

/** Write the full source to the managed file, creating the session work dir. */
export function writeBody(group: string, bodyFileName: string, source: string): Session {
  const workDir = sessionDir(group)
  mkdirSync(workDir, { recursive: true })
  const bodyPath = join(workDir, bodyFileName)
  writeFileSync(bodyPath, source, "utf8")
  return { workDir, bodyPath }
}

/**
 * Exact-match single replacement on the current source, matching pi's built-in
 * edit: old_text must appear exactly once. Returns the updated content and the
 * match offset, or throws a precise error.
 */
export function applyEdit(current: string, oldText: string, newText: string): { updated: string; index: number } {
  if (oldText === "") throw new Error("`old_text` must be non-empty.")
  if (oldText === newText) throw new Error("`old_text` and `new_text` are identical.")
  const first = current.indexOf(oldText)
  if (first === -1) {
    throw new Error("`old_text` not found in the current source — match it exactly.")
  }
  const second = current.indexOf(oldText, first + 1)
  if (second !== -1) {
    let n = 0
    let i = current.indexOf(oldText)
    while (i !== -1) {
      n++
      i = current.indexOf(oldText, i + oldText.length)
    }
    throw new Error(`\`old_text\` appears ${n} times — add surrounding context to make it unique.`)
  }
  const updated = current.slice(0, first) + newText + current.slice(first + oldText.length)
  return { updated, index: first }
}

/** A small numbered window of `content` around char offset `index`. */
export function snippetAround(content: string, index: number, contextLines = 3): string {
  const before = content.slice(0, index)
  const hitLine = before.split("\n").length - 1
  const lines = content.split("\n")
  const start = Math.max(0, hitLine - contextLines)
  const end = Math.min(lines.length - 1, hitLine + contextLines)
  const width = String(end + 1).length
  const out: string[] = []
  for (let i = start; i <= end; i++) out.push(`${String(i + 1).padStart(width)}  ${lines[i]}`)
  return out.join("\n")
}

/** Copy a rendered PNG into <cwd>/viz with a unique, slugified name. */
export function publish(pngPath: string, slug: string): { filename: string; path: string } {
  const filesDir = join(process.cwd(), FILES_DIRNAME)
  mkdirSync(filesDir, { recursive: true })
  const clean =
    slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "viz"
  const filename = `viz-${clean}-${Date.now()}.png`
  const dest = join(filesDir, filename)
  copyFileSync(pngPath, dest)
  return { filename, path: dest }
}

export { basename, delimiter, dirname, join, existsSync, mkdirSync, readFileSync, writeFileSync }
