/**
 * Live check that needs no model and no LLM provider key.
 *
 *   ZENROWS_API_KEY=... pnpm check:live
 *
 * Calls each tool's execute() directly against the Zenrows API — the same code
 * path a model takes, minus the model. Covers the happy paths, the options that
 * force a browser, and the error paths.
 */
import type { ToolExecutionOptions } from "ai";
import { createZenrowsTools } from "../src/index.js";

const apiKey = process.env.ZENROWS_API_KEY;
if (!apiKey) throw new Error("Set ZENROWS_API_KEY.");

const SHOP = "https://www.scrapingcourse.com/ecommerce/";
const PROTECTED = "https://www.scrapingcourse.com/antibot-challenge";

// The tools declare no context schema, so the runtime never reads `context`.
const ctx = {
  toolCallId: "local",
  messages: [],
} as unknown as ToolExecutionOptions<never>;

const tools = createZenrowsTools({ apiKey });
const stealthOff = createZenrowsTools({ apiKey, adaptiveStealth: false });

let failures = 0;

type Out = Record<string, unknown>;

async function check(label: string, run: () => unknown, expect: (out: Out) => string | true) {
  const started = Date.now();
  let out: Out;
  try {
    out = (await run()) as Out;
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${label} — threw: ${String(error).slice(0, 160)}`);
    return;
  }
  const verdict = expect(out);
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const cost = out.creditsSpent ? ` ${out.creditsSpent}cr` : "";
  if (verdict === true) {
    console.log(`ok    ${label} (${secs}s${cost})`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label} (${secs}s) — ${verdict}`);
    console.log(`      got: ${JSON.stringify(out).slice(0, 300)}`);
  }
}

const hasContent = (min: number) => (out: Out) =>
  typeof out.content === "string" && out.content.length >= min
    ? true
    : `expected >=${min} chars of content`;

const isError = (match: RegExp) => (out: Out) =>
  typeof out.error === "string" && match.test(out.error)
    ? true
    : `expected an error matching ${match}`;

// --- scrapeUrl -------------------------------------------------------------
await check(
  "scrape markdown (adaptive stealth)",
  () => tools.scrapeUrl.execute?.({ url: SHOP }, ctx),
  hasContent(500),
);

await check(
  "scrape html",
  () => tools.scrapeUrl.execute?.({ url: SHOP, responseType: "html" }, ctx),
  hasContent(5000),
);

await check(
  "scrape plaintext",
  () => tools.scrapeUrl.execute?.({ url: SHOP, responseType: "plaintext" }, ctx),
  hasContent(200),
);

await check(
  "scrape stealth off",
  () => stealthOff.scrapeUrl.execute?.({ url: SHOP }, ctx),
  hasContent(500),
);

await check(
  "scrape wait-for-selector (forces a browser, drops stealth)",
  () => tools.scrapeUrl.execute?.({ url: SHOP, waitForSelector: ".product" }, ctx),
  hasContent(500),
);

await check(
  "scrape proxy country (forces a premium proxy, drops stealth)",
  () => tools.scrapeUrl.execute?.({ url: SHOP, proxyCountry: "de" }, ctx),
  hasContent(500),
);

await check(
  "scrape a protected page",
  async () => {
    // Zenrows returns an empty 200 on this page often enough that a single
    // attempt is not a fair check. Retry, but say so — a silent retry turns
    // a product problem into a green tick and we stop seeing how often it
    // actually happens.
    let out: Out | undefined;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      out = (await tools.scrapeUrl.execute?.({ url: PROTECTED }, ctx)) as Out;
      if (!out?.error) {
        if (attempt > 1) console.log(`      (passed on attempt ${attempt})`);
        return out;
      }
      console.log(`      attempt ${attempt} failed: ${String(out.error).slice(0, 120)}`);
    }
    return out as Out;
  },
  (out) =>
    typeof out.content === "string" && /bypassed/i.test(out.content)
      ? true
      : "expected the antibot page to be bypassed",
);

await check(
  "scrape truncates at maxContentLength",
  () =>
    createZenrowsTools({ apiKey, maxContentLength: 1000 }).scrapeUrl.execute?.(
      { url: SHOP, responseType: "html" },
      ctx,
    ),
  (out) =>
    out.truncated === true && (out.content as string).length === 1000
      ? true
      : "expected exactly 1000 chars and truncated: true",
);

// --- extractData -----------------------------------------------------------
await check(
  "extract auto",
  () => tools.extractData.execute?.({ url: SHOP }, ctx),
  (out) => (out.data && !out.error ? true : "expected data"),
);

await check(
  "extract css selectors",
  () =>
    tools.extractData.execute?.(
      { url: SHOP, cssSelectors: { title: ".product-name", price: ".price" } },
      ctx,
    ),
  (out) => (out.data && !out.error ? true : "expected data"),
);

await check(
  "extract outputs",
  () => tools.extractData.execute?.({ url: SHOP, outputs: ["links", "images"] }, ctx),
  (out) => (out.data && !out.error ? true : "expected data"),
);

await check(
  "extract with selectors that match nothing",
  () =>
    tools.extractData.execute?.({ url: SHOP, cssSelectors: { nope: ".definitely-not-here" } }, ctx),
  (out) => (out.note ? true : "expected the empty-result note"),
);

// --- takeScreenshot --------------------------------------------------------
await check(
  "screenshot png",
  () => tools.takeScreenshot.execute?.({ url: SHOP }, ctx),
  (out) =>
    typeof out.image === "string" && (out.bytes as number) > 10_000 && out.mediaType === "image/png"
      ? true
      : "expected a png over 10kB",
);

await check(
  "screenshot full page jpeg",
  () => tools.takeScreenshot.execute?.({ url: SHOP, fullPage: true, format: "jpeg" }, ctx),
  (out) =>
    out.mediaType === "image/jpeg" && (out.bytes as number) > 10_000
      ? true
      : "expected a jpeg over 10kB",
);

// --- error paths -----------------------------------------------------------
await check(
  "bad api key",
  () => createZenrowsTools({ apiKey: "not-a-real-key" }).scrapeUrl.execute?.({ url: SHOP }, ctx),
  isError(/./),
);

await check(
  "unreachable host",
  () => tools.scrapeUrl.execute?.({ url: "https://this-domain-does-not-exist-zr.invalid/" }, ctx),
  isError(/./),
);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
