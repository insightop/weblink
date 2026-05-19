import { describe, expect, it, vi } from "vitest";
import type { FlashPlan } from "@/core/types/download";
import { Esp32SerialProtocol } from "@/protocols/esp32/serial/Esp32SerialProtocol";
import type { SerialTransport } from "@/transports/types";

vi.mock("@/features/flasher/services/flasherLogger", () => ({
  flasherLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const writeFlashMock = vi.fn();
vi.mock("@/protocols/esp32/adapters/EsptoolJsAdapter", () => ({
  EsptoolJsAdapter: vi.fn().mockImplementation(() => ({
    connect: vi.fn(async () => ({ chipName: "ESP32-MOCK" })),
    writeFlash: writeFlashMock,
    reset: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
  })),
}));

function createTransport(): SerialTransport {
  return {
    name: "mock",
    open: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    write: vi.fn(async () => undefined),
    read: vi.fn(async () => new Uint8Array()),
    getPort: vi.fn(() => ({} as SerialPort)),
  };
}

describe("Esp32SerialProtocol", () => {
  it("maps adapter progress to stage percent capped at 100", async () => {
    writeFlashMock.mockImplementationOnce(async (_plan: FlashPlan, onProgress: (w: number, t: number) => void) => {
      onProgress(50, 100);
      onProgress(100, 100);
    });

    const protocol = new Esp32SerialProtocol(createTransport(), { baudRate: 460800 });
    const plan: FlashPlan = {
      name: "p",
      segments: [{ address: 0x10000, data: new Uint8Array(100) }],
    };

    const samples: Array<{ totalPercent: number; bytesWritten: number; bytesTotal: number }> = [];
    await protocol.write(plan, (p) => {
      samples.push({
        totalPercent: p.totalPercent,
        bytesWritten: p.bytesWritten,
        bytesTotal: p.bytesTotal,
      });
    });

    expect(samples[0]).toMatchObject({ totalPercent: 50, bytesWritten: 50, bytesTotal: 100 });
    expect(samples[samples.length - 1]).toMatchObject({ totalPercent: 100, bytesWritten: 100, bytesTotal: 100 });
  });
});
