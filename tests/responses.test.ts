import { afterEach, describe, expect, it, vi } from "vitest";
import { describeFailure, readCostUsd, readCredits } from "../src/client.js";
import { createZenrowsTools } from "../src/index.js";

const url = "https://example.com/product/1";

function problem(status: number, code: string, detail = ""): Response {
  return new Response(JSON.stringify({ code, detail }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

describe("readCredits / readCostUsd", () => {
  it("reads credits from X-Request-Credits and dollars from X-Request-Cost", () => {
    const response = new Response("{}", {
      headers: { "x-request-credits": "25", "x-request-cost": "0.0003625" },
    });
    expect(readCredits(response)).toBe(25);
    expect(readCostUsd(response)).toBe(0.0003625);
  });

  it("returns undefined when a header is missing or not a number", () => {
    const response = new Response("{}", { headers: { "x-request-credits": "n/a" } });
    expect(readCredits(response)).toBeUndefined();
    expect(readCostUsd(response)).toBeUndefined();
  });
});

describe("describeFailure", () => {
  it("explains no_data_extracted as no data found, not a scrape failure", async () => {
    const message = await describeFailure(problem(422, "no_data_extracted"), url);
    expect(message).toMatch(/found no data/);
    expect(message).toMatch(/not charged/);
    expect(message).toMatch(/scrapeUrl/);
    expect(message).not.toMatch(/could not scrape/);
  });

  it("keeps the generic message for any other 422", async () => {
    const message = await describeFailure(problem(422, "RESP001", "Could not get content"), url);
    expect(message).toMatch(/could not scrape/);
  });

  it("explains REQS007 as a domain Extract is not prepared for, not as a bad key", async () => {
    const message = await describeFailure(problem(403, "REQS007"), url);
    expect(message).toMatch(/not prepared/);
    expect(message).not.toMatch(/API key/);
  });

  it("still blames the key for other 401/403 answers", async () => {
    const message = await describeFailure(problem(401, "AUTH002"), url);
    expect(message).toMatch(/API key/);
  });
});

describe("tool results", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports credits from X-Request-Credits and the dollar cost separately", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ parsed: { title: "Lamp" } }), {
          status: 200,
          headers: { "x-request-credits": "5", "x-request-cost": "0.0012" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { extractData } = createZenrowsTools({ apiKey: "test-key" });

    const out = await extractData.execute?.(
      { url },
      { toolCallId: "1", messages: [], context: {} },
    );

    expect(out).toMatchObject({ creditsSpent: 5, costUsd: 0.0012, url });
  });

  it("asks Zenrows once for a no_data_extracted answer and says so", async () => {
    const fetchMock = vi.fn(async () => problem(422, "no_data_extracted"));
    vi.stubGlobal("fetch", fetchMock);
    const { extractData } = createZenrowsTools({ apiKey: "test-key" });

    const out = await extractData.execute?.(
      { url },
      { toolCallId: "1", messages: [], context: {} },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ error: expect.stringMatching(/found no data/) });
  });
});
