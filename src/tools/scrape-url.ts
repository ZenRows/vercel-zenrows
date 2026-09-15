import { type Tool, tool } from "ai";
import { z } from "zod";
import {
  DEFAULT_MAX_CONTENT_LENGTH,
  createClient,
  describeFailure,
  resolveTier,
  truncate,
} from "../client.js";
import type { ZenrowsScrapeOptions } from "../types.js";

const scrapeUrlInput = z.object({
  url: z.string().url().describe("Full URL to read, including https://."),
  responseType: z
    .enum(["markdown", "plaintext", "html"])
    .optional()
    .describe(
      "markdown (default) is the cheapest to read and best for reasoning. " +
        "Ask for html only when you need the raw source, e.g. to find attributes.",
    ),
  proxyCountry: z
    .string()
    .length(2)
    .optional()
    .describe(
      "ISO 3166-1 alpha-2 country code (us, gb, de) when the page differs by country. " +
        "Uses a premium proxy, which costs more.",
    ),
  waitForSelector: z
    .string()
    .optional()
    .describe(
      "CSS selector to wait for before reading. Only use it when a first attempt came " +
        "back missing content that loads after the page does.",
    ),
});

export type ScrapeUrlInput = z.infer<typeof scrapeUrlInput>;

export interface ScrapeUrlOutput {
  content?: string;
  truncated?: boolean;
  url?: string;
  finalUrl?: string;
  creditsSpent?: string;
  error?: string;
}

export function scrapeUrl(options: ZenrowsScrapeOptions): Tool<ScrapeUrlInput, ScrapeUrlOutput> {
  const client = createClient(options);
  const adaptiveStealth = options.adaptiveStealth ?? true;
  const defaultResponseType = options.defaultResponseType ?? "markdown";
  const maxContentLength = options.maxContentLength ?? DEFAULT_MAX_CONTENT_LENGTH;

  return tool({
    description:
      "Read the full content of a web page and return it as Markdown, plain text or HTML. " +
      "Use this whenever you need to read, summarise or reason over a live page. " +
      "Works on JavaScript-rendered pages, anti-bot protected sites and geo-restricted " +
      "content — Zenrows picks the configuration the target needs, so do not try to " +
      "tune that yourself. Returns the content, the URL after redirects, and the credits spent.",
    inputSchema: scrapeUrlInput,
    execute: async ({
      url,
      responseType,
      proxyCountry,
      waitForSelector,
    }): Promise<ScrapeUrlOutput> => {
      const format = responseType ?? defaultResponseType;
      const response = await client.fetch(url, {
        ...(format !== "html" ? { response_type: format } : {}),
        ...(proxyCountry ? { proxy_country: proxyCountry.toLowerCase() } : {}),
        ...(waitForSelector ? { wait_for: waitForSelector } : {}),
        ...resolveTier({
          adaptiveStealth,
          premiumProxy: Boolean(proxyCountry),
          needsBrowser: Boolean(waitForSelector),
        }),
      });

      if (!response.ok) {
        return { error: await describeFailure(response, url) };
      }

      const body = await response.text();
      if (!body) {
        return {
          error: [
            `Zenrows returned an empty body for ${url} with HTTP ${response.status}.`,
            "Retry once; if it stays empty the page is probably built client-side —",
            "pass waitForSelector for an element you expect.",
          ].join(" "),
        };
      }

      const { text, truncated } = truncate(body, maxContentLength);
      return {
        content: text,
        truncated,
        url,
        finalUrl: response.headers.get("zr-final-url") ?? url,
        creditsSpent: response.headers.get("x-request-cost") ?? undefined,
      };
    },
  });
}
