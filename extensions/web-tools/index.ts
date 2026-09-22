/**
 * web-tools — `web_search` and `web_fetch` for pi.
 *
 * pi ships four tools: read, write, edit, bash. There is no web capability at
 * all, which is why `agents/researcher.md` never worked — it declared
 * `web_search`/`web_fetch` that nothing provided, so the researcher fell back
 * on model memory. That matters most in synthesize mode, whose entire premise
 * is that a cross-domain bridge must be VERIFIED before it is taught.
 *
 * Provider is chosen at call time from the environment, so you can switch
 * without touching code:
 *
 *   TAVILY_API_KEY  -> Tavily   (https://tavily.com)         preferred
 *   BRAVE_API_KEY   -> Brave    (https://brave.com/search/api/)
 *
 * Tavily is preferred when both are set: its search returns extracted page
 * text and it has a dedicated extract endpoint, so neither tool has to parse
 * HTML. Brave returns snippets and URLs, so `web_fetch` fetches the page and
 * strips markup itself.
 *
 * This is a normal auto-discovered extension (`.pi/extensions/web-tools/index.ts`),
 * which is what makes the tools reach subagents: under the upstream subagents
 * package a child pi inherits ordinary extension discovery.
 *
 * No npm dependencies — `fetch` is built into Node 18+.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { Type } from "typebox"

const TIMEOUT_MS = 30_000
const DEFAULT_RESULTS = 5
// Roughly 5k tokens of prose. Enough to judge a source, small enough that three
// fetches don't crowd out the research itself.
const MAX_FETCH_CHARS = 20_000

type Provider = "tavily" | "brave"

interface SearchResult {
  title: string
  url: string
  snippet: string
}

/**
 * Deliberately phrased for the model that receives it: the failure mode we most
 * need to prevent is a researcher quietly answering from memory when the search
 * tool is unavailable, which looks identical to a real finding.
 */
const NO_PROVIDER =
  "No search provider is configured, so web search is UNAVAILABLE.\n" +
  "Set TAVILY_API_KEY (https://tavily.com) or BRAVE_API_KEY (https://brave.com/search/api/) " +
  "in the environment and restart pi.\n" +
  "Do NOT substitute your own knowledge for a search result. Report that the search " +
  "could not be run."

function activeProvider(): Provider | null {
  if (process.env.TAVILY_API_KEY) return "tavily"
  if (process.env.BRAVE_API_KEY) return "brave"
  return null
}

function unavailable() {
  return {
    content: [{ type: "text" as const, text: NO_PROVIDER }],
    details: { ok: false, reason: "no-provider" },
  }
}

async function asJson(res: Response, label: string): Promise<unknown> {
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 400)
    throw new Error(`${label} returned ${res.status} ${res.statusText}. ${body}`)
  }
  return await res.json()
}

// ── Tavily ──────────────────────────────────────────────────────────────────

async function tavilySearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({ query, max_results: maxResults, search_depth: "advanced" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const data = (await asJson(res, "Tavily search")) as {
    results?: Array<{ title?: string; url?: string; content?: string }>
  }
  return (data.results ?? []).map((r) => ({
    title: r.title ?? "(untitled)",
    url: r.url ?? "",
    snippet: (r.content ?? "").trim(),
  }))
}

async function tavilyFetch(url: string): Promise<string> {
  const res = await fetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({ urls: [url] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const data = (await asJson(res, "Tavily extract")) as {
    results?: Array<{ raw_content?: string }>
    failed_results?: Array<{ url?: string; error?: string }>
  }
  const text = data.results?.[0]?.raw_content?.trim()
  if (!text) {
    const why = data.failed_results?.[0]?.error ?? "no content returned"
    throw new Error(`Tavily could not extract ${url}: ${why}`)
  }
  return text
}

// ── Brave ───────────────────────────────────────────────────────────────────

async function braveSearch(query: string, maxResults: number): Promise<SearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search")
  url.searchParams.set("q", query)
  url.searchParams.set("count", String(maxResults))
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-subscription-token": process.env.BRAVE_API_KEY as string,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const data = (await asJson(res, "Brave search")) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> }
  }
  return (data.web?.results ?? []).map((r) => ({
    title: r.title ?? "(untitled)",
    url: r.url ?? "",
    snippet: (r.description ?? "").replace(/<[^>]+>/g, "").trim(),
  }))
}

/** Crude but dependency-free markup stripping. Good enough to judge a source. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

async function braveFetch(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; pi-web-tools/1.0)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`GET ${url} returned ${res.status} ${res.statusText}`)
  const text = htmlToText(await res.text())
  if (!text) throw new Error(`No readable text found at ${url}`)
  return text
}

// ── Extension ───────────────────────────────────────────────────────────────

export default function webTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web and return ranked results with titles, URLs and snippets. " +
      "Use it to find sources, check a fact you are unsure of, or assess whether a " +
      "claim is actually documented anywhere. Follow up with web_fetch on the most " +
      "promising URLs to read them in full. If this returns an 'UNAVAILABLE' " +
      "message, the search did not run — say so rather than answering from memory.",
    parameters: Type.Object({
      query: Type.String({ description: "The search query. Vary your angle across calls rather than repeating one phrasing." }),
      max_results: Type.Optional(
        Type.Number({ description: `Number of results to return (default ${DEFAULT_RESULTS}).` }),
      ),
    }),
    async execute(_id, params) {
      const which = activeProvider()
      if (!which) return unavailable()

      const query = String(params.query ?? "").trim()
      if (!query) throw new Error("`web_search` requires a non-empty `query`.")
      const max = Math.min(Math.max(Number(params.max_results) || DEFAULT_RESULTS, 1), 20)

      const results = which === "tavily" ? await tavilySearch(query, max) : await braveSearch(query, max)

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No results for "${query}" (provider: ${which}). This is a real empty result, not an error — if the claim you are checking is undocumented, that is itself a finding.`,
            },
          ],
          details: { ok: true, provider: which, query, count: 0 },
        }
      }

      const text = results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
        .join("\n\n")

      return {
        content: [{ type: "text" as const, text: `${results.length} result(s) via ${which}:\n\n${text}` }],
        details: { ok: true, provider: which, query, count: results.length, results },
      }
    },
  })

  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Fetch one URL and return its readable text. Use it on the 2-3 most promising " +
      "URLs from web_search when a snippet is not enough to judge the source. " +
      "Long pages are truncated.",
    parameters: Type.Object({
      url: Type.String({ description: "The absolute http(s) URL to fetch." }),
    }),
    async execute(_id, params) {
      const which = activeProvider()
      if (!which) return unavailable()

      const url = String(params.url ?? "").trim()
      if (!/^https?:\/\//i.test(url)) throw new Error("`web_fetch` requires an absolute http(s) URL.")

      const full = which === "tavily" ? await tavilyFetch(url) : await braveFetch(url)
      const truncated = full.length > MAX_FETCH_CHARS
      const text = truncated ? `${full.slice(0, MAX_FETCH_CHARS)}\n\n[truncated]` : full

      return {
        content: [{ type: "text" as const, text }],
        details: { ok: true, provider: which, url, chars: full.length, truncated },
      }
    },
  })
}
