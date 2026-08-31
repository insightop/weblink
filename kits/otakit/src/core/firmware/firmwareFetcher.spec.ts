import { describe, it, expect, vi } from "vitest";
import { fetchFirmwareFromUrl, readFirmwareFile } from "./firmwareFetcher";

describe("firmwareFetcher", () => {
  it("fetchFirmwareFromUrl returns text on success", async () => {
    const mockFetch = vi.fn(
      async () =>
        ({
          ok: true,
          headers: { get: () => null },
          text: async () => ":020000040000FA\n:00000001FF\n",
        }) as unknown as Response,
    );
    vi.stubGlobal("fetch", mockFetch);
    const text = await fetchFirmwareFromUrl("https://example.com/app.hex");
    expect(text).toContain(":020000040000FA");
    vi.unstubAllGlobals();
  });

  it("fetchFirmwareFromUrl streams and reports progress", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(":020000040000FA\n"));
        controller.close();
      },
    });
    const mockFetch = vi.fn(
      async () =>
        ({
          ok: true,
          headers: { get: () => "16" },
          body,
          text: async () => ":020000040000FA\n",
        }) as unknown as Response,
    );
    vi.stubGlobal("fetch", mockFetch);
    const onProgress = vi.fn();
    const text = await fetchFirmwareFromUrl("https://example.com/app.hex", onProgress);
    expect(text).toContain(":020000040000FA");
    expect(onProgress).toHaveBeenCalled();
    const lastCall = onProgress.mock.calls.at(-1)?.[0];
    expect(typeof lastCall).toBe("number");
    vi.unstubAllGlobals();
  });

  it("fetchFirmwareFromUrl throws on non-ok", async () => {
    const mockFetch = vi.fn(
      async () => ({ ok: false, status: 404 }) as unknown as Response,
    );
    vi.stubGlobal("fetch", mockFetch);
    await expect(fetchFirmwareFromUrl("https://example.com/x.hex")).rejects.toThrow();
    vi.unstubAllGlobals();
  });

  it("readFirmwareFile reads file text", async () => {
    const file = new File([":020000040000FA\n"], "app.hex", { type: "text/plain" });
    const text = await readFirmwareFile(file);
    expect(text).toContain(":020000040000FA");
  });
});
