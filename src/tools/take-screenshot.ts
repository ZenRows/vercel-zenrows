import { type Tool, tool } from "ai";
import { z } from "zod";
import { createClient, describeFailure, resolveTier } from "../client.js";
import type { ZenrowsScreenshotOptions } from "../types.js";

export interface ScreenshotResult {
  image?: string;
  mediaType?: string;
  bytes?: number;
  url?: string;
  creditsSpent?: string;
  error?: string;
}

const takeScreenshotInput = z.object({
  url: z.string().url().describe("Full URL to capture, including https://."),
  fullPage: z
    .boolean()
    .optional()
    .describe("Capture the whole scrollable page instead of just the first screen."),
  selector: z.string().optional().describe("CSS selector to capture only one element."),
  format: z
    .enum(["png", "jpeg"])
    .optional()
    .describe("png (default) is lossless; jpeg is smaller for photo-heavy pages."),
});

export type TakeScreenshotInput = z.infer<typeof takeScreenshotInput>;

export function takeScreenshot(
  options: ZenrowsScreenshotOptions,
): Tool<TakeScreenshotInput, ScreenshotResult> {
  const client = createClient(options);
  const adaptiveStealth = options.adaptiveStealth ?? true;

  return tool({
    description:
      "Capture a screenshot of a web page as an image you can then look at. Use this when " +
      "the question is about how a page looks — layout, design, a chart, something that is " +
      "not in the text. For reading content, use scrapeUrl instead: it is cheaper and the " +
      "text is more reliable than reading it off an image.",
    inputSchema: takeScreenshotInput,
    execute: async ({ url, fullPage, selector, format = "png" }): Promise<ScreenshotResult> => {
      const response = await client.fetch(url, {
        ...(fullPage
          ? { screenshot_fullpage: true }
          : selector
            ? { screenshot_selector: selector }
            : { screenshot: true }),
        ...(format === "jpeg" ? { screenshot_format: "jpeg" } : {}),
        // A screenshot always needs a browser, so this resolves to js_render
        // rather than adaptive stealth — the two cannot be sent together.
        ...resolveTier({ adaptiveStealth, needsBrowser: true }),
      });

      if (!response.ok) {
        return { error: await describeFailure(response, url) };
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0) {
        return { error: `Zenrows returned an empty image for ${url}. Retry.` };
      }

      return {
        image: Buffer.from(bytes).toString("base64"),
        mediaType: format === "jpeg" ? "image/jpeg" : "image/png",
        bytes: bytes.byteLength,
        url,
        creditsSpent: response.headers.get("x-request-cost") ?? undefined,
      };
    },
    // Hand the model the actual image rather than a base64 string it cannot see.
    toModelOutput: ({ output }) => {
      if (output.error || !output.image) {
        return { type: "error-text", value: output.error ?? "Screenshot failed." };
      }
      return {
        type: "content",
        value: [
          { type: "text", text: `Screenshot of ${output.url}` },
          {
            type: "file",
            data: { type: "data", data: output.image },
            mediaType: output.mediaType ?? "image/png",
          },
        ],
      };
    },
  });
}
