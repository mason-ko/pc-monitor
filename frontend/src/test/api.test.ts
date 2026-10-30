import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchHealth, fetchSystem } from "../api";

// The UI banners show `usePolling`'s error string verbatim, so the message
// getJson builds on a failed response is user-visible: it must carry the
// backend's JSON `detail` (the FastAPI 500 shape) when there is one, and
// degrade to the status line when the body is not JSON.

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

describe("getJson success", () => {
  it("resolves the parsed JSON body", async () => {
    stubFetch(
      new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(fetchHealth()).resolves.toEqual({ status: "ok" });
  });
});

describe("getJson failure surfacing", () => {
  it("includes the backend's JSON detail in the thrown message", async () => {
    stubFetch(
      new Response(
        JSON.stringify({ detail: "system metrics collection failed: cpu sensor exploded" }),
        { status: 500 },
      ),
    );
    await expect(fetchSystem()).rejects.toThrow(
      /\/api\/system responded 500.*cpu sensor exploded/,
    );
  });

  it("falls back to the status line for a non-JSON error body", async () => {
    stubFetch(new Response("<h1>502 Bad Gateway</h1>", { status: 502 }));
    let message = "";
    try {
      await fetchSystem();
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/\/api\/system responded 502/);
    // HTML error pages must not be pasted into the UI banner.
    expect(message).not.toContain("<h1>");
  });

  it("propagates network failures without wrapping them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );
    await expect(fetchSystem()).rejects.toThrow("Failed to fetch");
  });
});
