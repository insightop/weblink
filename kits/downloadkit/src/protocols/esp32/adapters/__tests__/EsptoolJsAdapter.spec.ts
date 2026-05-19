import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorCode } from "@/core/errors/ErrorCode";
import { EsptoolJsAdapter } from "@/protocols/esp32/adapters/EsptoolJsAdapter";
import type { FlashPlan } from "@/core/types/download";
import type { SerialTransport } from "@/transports/types";

const mainMock = vi.fn(async () => "ESP32-S3");
const writeFlashMock = vi.fn(async () => undefined);
const afterMock = vi.fn(async () => undefined);

vi.mock("@/protocols/esp32/esptool/loadEsptool", () => ({
  loadEsptool: vi.fn(async () => {
    class MockTransport {
      constructor(_port: unknown, _trace: boolean) {}
    }
    class MockESPLoader {
      constructor(_opts: unknown) {}
      main = mainMock;
      writeFlash = writeFlashMock;
      after = afterMock;
    }
    return { ESPLoader: MockESPLoader, Transport: MockTransport };
  }),
}));

function createSerialTransport(): SerialTransport {
  const port = {} as SerialPort;
  return {
    name: "mock-serial",
    open: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    write: vi.fn(async () => undefined),
    read: vi.fn(async () => new Uint8Array()),
    getPort: vi.fn(() => port),
  };
}

describe("EsptoolJsAdapter", () => {
  beforeEach(() => {
    mainMock.mockClear();
    writeFlashMock.mockClear();
    afterMock.mockClear();
  });

  it("connect uses getPort for esptool-js and returns chip name from loader.main (no duplicate WebSerial open)", async () => {
    const transport = createSerialTransport();
    const adapter = new EsptoolJsAdapter(transport, { debugLogging: true });
    const info = await adapter.connect(460800);
    expect(transport.getPort).toHaveBeenCalled();
    expect(transport.open).not.toHaveBeenCalled();
    expect(mainMock).toHaveBeenCalled();
    expect(info.chipName).toBe("ESP32-S3");
  });

  it("maps writeFlash fileArray from plan segments and aggregates progress across files", async () => {
    const transport = createSerialTransport();
    const adapter = new EsptoolJsAdapter(transport);
    await adapter.connect(115200);

    const plan: FlashPlan = {
      name: "t",
      segments: [
        { address: 0x1000, data: new Uint8Array(10) },
        { address: 0x8000, data: new Uint8Array(20) },
      ],
    };

    let captured: { fileArray: unknown; reportProgress?: (i: number, w: number, t: number) => void } | null =
      null;
    writeFlashMock.mockImplementationOnce(async (opts: { fileArray: unknown; reportProgress?: (i: number, w: number, t: number) => void }) => {
      captured = opts;
      opts.reportProgress?.(0, 10, 10);
      opts.reportProgress?.(1, 20, 20);
    });

    const writes: number[] = [];
    await adapter.writeFlash(plan, (w, _t) => {
      writes.push(w);
    });

    expect(captured?.fileArray).toEqual([
      { address: 0x1000, data: plan.segments[0].data },
      { address: 0x8000, data: plan.segments[1].data },
    ]);
    expect(writes).toEqual([10, 30, 30]);
  });

  it("throws ProbeFailed with i18n user message on connect failure", async () => {
    mainMock.mockRejectedValueOnce(new Error("uart"));
    const transport = createSerialTransport();
    const adapter = new EsptoolJsAdapter(transport);
    await expect(adapter.connect(460800)).rejects.toMatchObject({
      code: ErrorCode.ProbeFailed,
    });
  });
});
