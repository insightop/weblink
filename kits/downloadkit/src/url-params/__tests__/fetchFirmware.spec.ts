import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchFirmware } from "../fetchFirmware";

describe("fetchFirmware", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockRestore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches binary and returns filename from URL", async () => {
    const mockData = new Uint8Array([0x00, 0x01, 0x02]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob([mockData], { type: "application/octet-stream" })),
      headers: new Headers({ "content-type": "application/octet-stream" }),
    } as Response);

    const result = await fetchFirmware("https://example.com/firmware.bin");

    expect(result.name).toBe("firmware.bin");
    expect(result.size).toBe(3);
  });

  it("derives filename from URL path with .hex extension", async () => {
    const mockData = new Uint8Array([0x00]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob([mockData], { type: "application/octet-stream" })),
      headers: new Headers({ "content-type": "text/plain" }),
    } as Response);

    const result = await fetchFirmware("https://example.com/path/to/fw.hex");
    expect(result.name).toBe("fw.hex");
  });

  it("throws on HTTP error status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      blob: () => Promise.reject(new Error("should not call blob")),
      headers: new Headers(),
    } as Response);

    await expect(fetchFirmware("https://example.com/missing.bin")).rejects.toThrow(
      /HTTP 404/,
    );
  });

  it("passes pre-aborted signal and rejects", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(fetchFirmware("https://example.com/fw.bin", controller.signal)).rejects.toThrow();
  });

  it("preserves Blob data integrity", async () => {
    const original = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob([original])),
      headers: new Headers({ "content-type": "application/octet-stream" }),
    } as Response);

    const result = await fetchFirmware("https://example.com/data.bin");
    const resultBytes = new Uint8Array(await result.blob.arrayBuffer());
    expect(resultBytes).toEqual(original);
  });
});
