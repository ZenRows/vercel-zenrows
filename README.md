# Zenrows tools for the Vercel AI SDK

Give your model the ability to read any page on the web — including
JavaScript-rendered, anti-bot protected and geo-restricted ones — with three
tools it can call from `generateText` and `streamText`.

```bash
npm install @zenrows/ai-sdk-tools
```

Requires `ai` v7 and `zod` as peer dependencies, and Node 22+.

## Quick start

```ts
import { generateText, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createZenrowsTools } from '@zenrows/ai-sdk-tools';

const zenrows = createZenrowsTools({ apiKey: process.env.ZENROWS_API_KEY! });

const { text } = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Read https://news.ycombinator.com and list the top three stories.',
  tools: zenrows,
  stopWhen: stepCountIs(5),
});

console.log(text);
```

Get an API key at [app.zenrows.com](https://app.zenrows.com/account/settings).
Set it as `ZENROWS_API_KEY`, or pass it however your app handles secrets — the
key is only ever read by the factory, never by the model.

## The tools

| Tool | What the model uses it for |
| --- | --- |
| `scrapeUrl` | Read a whole page as Markdown, plain text or HTML |
| `extractData` | Pull named fields out of a page as JSON, without reading all of it |
| `takeScreenshot` | Capture the page as an image a vision model can look at |

`createZenrowsTools` returns all three. Import them individually if you only
want one:

```ts
import { scrapeUrl } from '@zenrows/ai-sdk-tools';

const result = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Summarise https://example.com',
  tools: { scrapeUrl: scrapeUrl({ apiKey: process.env.ZENROWS_API_KEY! }) },
  stopWhen: stepCountIs(3),
});
```

## Next.js route handler

```ts
// app/api/chat/route.ts
import { streamText, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createZenrowsTools } from '@zenrows/ai-sdk-tools';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    system: 'You are a research assistant. When asked about a URL, read it before answering.',
    messages,
    tools: createZenrowsTools({ apiKey: process.env.ZENROWS_API_KEY! }),
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
```

## Options

Every option is set once, on the factory. The model never sees them.

| Option | Default | What it does |
| --- | --- | --- |
| `apiKey` | — | Required. Your Zenrows API key. |
| `adaptiveStealth` | `true` | Zenrows starts with the cheapest request that works and escalates only when the target needs it. |
| `defaultResponseType` | `'markdown'` | Format `scrapeUrl` returns when the model does not ask for one. |
| `maxContentLength` | `100_000` | Characters of page content handed to the model before truncation. |
| `concurrency` | `5` | Concurrent requests to Zenrows. |
| `retries` | `0` | Retries on 422/503/504 and network errors. |

### On Adaptive Stealth

Zenrows can decide per request whether a page needs JavaScript rendering or a
premium proxy, and bills for the configuration that worked. That is on by
default here, which is why the model is not given a `jsRender` or
`premiumProxy` knob to guess at.

Zenrows rejects adaptive stealth combined with an explicit tier flag, so an
option that needs a browser — a screenshot, a wait-for-selector, a country
proxy — drops it for that one call and sets what the option actually needs.
The model cannot produce a request Zenrows will refuse.

Turn it off with `adaptiveStealth: false` if you would rather pay a flat,
predictable cost per request and accept that protected pages will fail.

### On content length

A scraped page goes into the model's context and you pay for every character
of it. HTML routinely runs past 80,000 characters for an ordinary page, so
`scrapeUrl` truncates at `maxContentLength` and sets `truncated: true` rather
than quietly sending a large bill. Prefer `extractData` when you know which
fields you want.

## What the tools return

`scrapeUrl` returns `{ content, truncated, url, finalUrl, creditsSpent }`.
`extractData` returns `{ data, url, creditsSpent }`. Both return
`{ error }` instead when the call fails, with a message the model can act on —
they do not throw, so a failed scrape costs a step rather than the run.

`takeScreenshot` returns the image to your code as base64 in
`{ image, mediaType, bytes }`, and hands the model a real image part via
`toModelOutput`, so a vision-capable model actually sees the page rather than a
base64 string.

## Cost

Zenrows bills per request. Adaptive stealth means you pay for the configuration
that succeeded rather than for the most expensive one up front. Every tool
result carries `creditsSpent`, so the model can report what a piece of research
cost.

## Links

- [Zenrows documentation](https://docs.zenrows.com)
- [AI SDK tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [Source](https://github.com/ZenRows/vercel-zenrows) · [Issues](https://github.com/ZenRows/vercel-zenrows/issues)

## License

MIT
