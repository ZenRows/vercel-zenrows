import { type Tool, tool } from "ai";
import { z } from "zod";
import { createClient, describeFailure, resolveTier } from "../client.js";
import type { ZenrowsExtractOptions } from "../types.js";

const extractDataInput = z.object({
  url: z.string().url().describe("Full URL to extract from, including https://."),
  cssSelectors: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      'Field name to CSS selector, e.g. {"title":"h1","price":".price"}. ' +
        "Use when you know the page structure and want named fields back.",
    ),
  outputs: z
    .array(z.enum(["emails", "phone_numbers", "links", "images", "headings", "tables"]))
    .optional()
    .describe("Collect every instance of these content types across the page."),
});

export type ExtractDataInput = z.infer<typeof extractDataInput>;

export interface ExtractDataOutput {
  data?: unknown;
  note?: string;
  url?: string;
  creditsSpent?: string;
  error?: string;
}

export function extractData(
  options: ZenrowsExtractOptions,
): Tool<ExtractDataInput, ExtractDataOutput> {
  const client = createClient(options);
  const adaptiveStealth = options.adaptiveStealth ?? true;

  return tool({
    description:
      "Pull specific structured data out of a web page as JSON, instead of reading the " +
      "whole page. Prefer this over scrapeUrl when you only need particular fields — it " +
      "returns far less text. With no options Zenrows decides what the page is about and " +
      "extracts it. Give cssSelectors to name exactly the fields you want, or outputs to " +
      "collect one kind of thing across the page.",
    inputSchema: extractDataInput,
    execute: async ({ url, cssSelectors, outputs }): Promise<ExtractDataOutput> => {
      const hasSelectors = cssSelectors && Object.keys(cssSelectors).length > 0;
      const tier = resolveTier({ adaptiveStealth });

      const response =
        hasSelectors || outputs?.length
          ? await client.fetch(url, {
              ...(hasSelectors ? { css_extractor: JSON.stringify(cssSelectors) } : {}),
              ...(outputs?.length ? { outputs: outputs.join(",") } : {}),
              ...tier,
            })
          : await client.extract(url, { adaptiveStealth });

      if (!response.ok) {
        return { error: await describeFailure(response, url) };
      }

      const body = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(body);
      } catch {
        data = body;
      }

      const empty =
        data == null ||
        (Array.isArray(data) && data.length === 0) ||
        (typeof data === "object" && Object.keys(data as object).length === 0);

      if (empty) {
        return {
          data,
          note:
            "Nothing matched. If you passed cssSelectors the selectors are probably wrong " +
            "for this page — read it with scrapeUrl using responseType html to find the " +
            "real ones, or call extractData again with no options.",
          url,
          creditsSpent: response.headers.get("x-request-cost") ?? undefined,
        };
      }

      return {
        data,
        url,
        creditsSpent: response.headers.get("x-request-cost") ?? undefined,
      };
    },
  });
}
