/**
 * Runnable end-to-end example.
 *
 *   ZENROWS_API_KEY=... ANTHROPIC_API_KEY=... pnpm example
 *
 * Exercises all three tools against the live Zenrows API through a real model
 * tool-call loop, which is also how the package is verified before a release.
 */
import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs } from "ai";
import { createZenrowsTools } from "../src/index.js";

const apiKey = process.env.ZENROWS_API_KEY;
if (!apiKey) throw new Error("Set ZENROWS_API_KEY.");
if (!process.env.ANTHROPIC_API_KEY) throw new Error("Set ANTHROPIC_API_KEY.");

const zenrows = createZenrowsTools({ apiKey });
const MODEL = "claude-sonnet-4-5";

async function run(label: string, prompt: string) {
  console.log(`\n--- ${label} ---`);
  const started = Date.now();
  const { text, steps } = await generateText({
    model: anthropic(MODEL),
    prompt,
    tools: zenrows,
    stopWhen: stepCountIs(4),
  });

  for (const step of steps) {
    for (const call of step.toolCalls) {
      const result = step.toolResults.find((r) => r.toolCallId === call.toolCallId);
      const output = result?.output as Record<string, unknown> | undefined;
      const note = output?.error
        ? `ERROR: ${output.error}`
        : `ok${output?.creditsSpent ? ` — ${output.creditsSpent} credits` : ""}${
            output?.truncated ? " (truncated)" : ""
          }`;
      console.log(`  ${call.toolName}(${JSON.stringify(call.input)}) -> ${note}`);
    }
  }

  console.log(`  ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(text.slice(0, 500));
}

await run("scrapeUrl", "Read https://www.scrapingcourse.com/ecommerce/ and name three products.");

await run(
  "extractData",
  "Extract the product titles and prices from https://www.scrapingcourse.com/ecommerce/ " +
    'using the CSS selectors {"title":".product-name","price":".price"}. List the first three.',
);

await run(
  "takeScreenshot",
  "Take a screenshot of https://www.scrapingcourse.com/ecommerce/ and describe the layout " +
    "in two sentences. Do not read the page as text.",
);

await run(
  "protected page",
  "Read https://www.scrapingcourse.com/antibot-challenge and tell me exactly what the page says.",
);

console.log("\ndone");
