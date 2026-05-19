import { describe, expect, it, vi } from "vitest";
import { DownloadSession } from "@/core/session/DownloadSession";
import type { FlasherProtocol } from "@/protocols/types";
import type { FlashPlan } from "@/core/types/download";
import type { Transport } from "@/transports/types";

const fakePlan: FlashPlan = {
  name: "fake",
  segments: [],
};

function createProtocol(): FlasherProtocol {
  return {
    probe: vi.fn(async () => ({ chipFamily: "stm32", chipName: "STM32" })),
    sync: vi.fn(async () => undefined),
    buildPlan: vi.fn(async () => fakePlan),
    erase: vi.fn(async () => undefined),
    write: vi.fn(async () => undefined),
  };
}

describe("DownloadSession", () => {
  it("skips transport.open when protocol.defersTransportOpen and device is ready", async () => {
    const open = vi.fn(async () => undefined);
    const transport = {
      name: "mock",
      open,
      isDeviceReady: () => true,
      close: vi.fn(async () => undefined),
      write: vi.fn(async () => undefined),
      read: vi.fn(async () => new Uint8Array()),
      releaseSession: vi.fn(async () => undefined),
    } as Transport & { isDeviceReady: () => boolean; releaseSession: () => Promise<void> };
    const protocol: FlasherProtocol = {
      defersTransportOpen: true,
      probe: vi.fn(async () => ({ chipFamily: "esp32", chipName: "ESP32" })),
      sync: vi.fn(async () => undefined),
      buildPlan: vi.fn(async () => fakePlan),
      erase: vi.fn(async () => undefined),
      write: vi.fn(async () => undefined),
    };
    const session = new DownloadSession({ transport, protocol });
    await session.run({});
    expect(open).not.toHaveBeenCalled();
  });

  it("releases session resources without disconnecting selected device", async () => {
    const releaseSession = vi.fn(async () => undefined);
    const close = vi.fn(async () => undefined);
    const transport = {
      name: "mock",
      open: vi.fn(async () => undefined),
      close,
      write: vi.fn(async () => undefined),
      read: vi.fn(async () => new Uint8Array()),
      releaseSession,
    } as Transport & { releaseSession: () => Promise<void> };
    const protocol = createProtocol();
    const session = new DownloadSession({ transport, protocol });

    await session.run({});

    expect(releaseSession).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });
});
