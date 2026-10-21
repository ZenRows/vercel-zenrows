import { afterEach, describe, expect, it, vi } from "vitest";
import { describeFailure, readCostUsd, readCredits } from "../src/client.js";
import { createZenrowsTools } from "../src/index.js";

const url = "https://example.com/product/1";

function problem(
  status: number,
  code: string,
  detail = "",
  extra: { title?: string; reason?: string } = {},
): Response {
  return new Response(JSON.stringify({ code, detail, ...extra }), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

/** A REQS007 as the API sends it: the case is readable from `title`. */
function refusedPage(title: string, reason?: string): Response {
  return problem(403, "REQS007", "", { title: `${title} example.com (REQS007)`, reason });
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

  it("tells the caller to prepare the domain only when nothing is prepared", async () => {
    const message = await describeFailure(
      refusedPage("Extract is not prepared for the requested domain"),
      url,
    );
    expect(message).toMatch(/Nothing is prepared for this domain yet/);
    expect(message).toMatch(/Preparing it and retrying will work/);
    expect(message).not.toMatch(/API key/);
  });

  // The case the old single message got wrong: the domain IS prepared, so sending the
  // caller to prepare it returns this same 403.
  it("does not send the caller to prepare a domain that is already prepared", async () => {
    const message = await describeFailure(
      refusedPage("Extract did not recognise this page on"),
      url,
    );
    expect(message).toMatch(/does not recognise this page/);
    expect(message).toMatch(/Preparing the domain again returns the same answer/);
    expect(message).not.toMatch(/Preparing it and retrying will work/);
  });

  it("says preparing does not help when Extract is not enabled for the site", async () => {
    const message = await describeFailure(
      refusedPage("Extract is not enabled for the requested domain"),
      url,
    );
    expect(message).toMatch(/not enabled for this site/);
    expect(message).toMatch(/preparing the domain does not change that/);
  });

  it("prefers reason over title once the API sends it", async () => {
    const message = await describeFailure(
      refusedPage("Extract is not prepared for the requested domain", "page_not_recognised"),
      url,
    );
    expect(message).toMatch(/does not recognise this page/);
    expect(message).not.toMatch(/Nothing is prepared for this domain yet/);
  });

  it("names no cause for a REQS007 that identifies none of the three", async () => {
    const message = await describeFailure(problem(403, "REQS007"), url);
    expect(message).toMatch(/Extract refused/);
    expect(message).toMatch(/not charged/);
    expect(message).toMatch(/It can mean/);
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
