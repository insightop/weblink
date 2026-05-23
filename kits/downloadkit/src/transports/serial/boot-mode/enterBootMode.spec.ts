import { describe, expect, it, vi } from "vitest";
import { executeSequenceSignals } from "./enterBootMode";
import type { BootSequence } from "./BootSequence";

describe("executeSequenceSignals", () => {
  it("calls setSignals for each step in sequence", async () => {
    const setSignals = vi.fn().mockResolvedValue(undefined);
    const port = { setSignals } as unknown as SerialPort;

    const sequence: BootSequence = {
      name: "test",
      steps: [
        { signals: { dataTerminalReady: false }, delayMs: 1, description: "DTR=low" },
        { signals: { dataTerminalReady: true, requestToSend: false }, delayMs: 1, description: "DTR=high, RTS=low" },
      ],
      handshakeByte: 0x7f,
      handshakeTimeoutMs: 100,
      handshakeRetries: 1,
    };

    await executeSequenceSignals(port, sequence);

    expect(setSignals).toHaveBeenCalledTimes(2);
    expect(setSignals).toHaveBeenNthCalledWith(1, { dataTerminalReady: false });
    expect(setSignals).toHaveBeenNthCalledWith(2, { dataTerminalReady: true, requestToSend: false });
  });

  it("does nothing for empty steps (no-control fallback)", async () => {
    const setSignals = vi.fn().mockResolvedValue(undefined);
    const port = { setSignals } as unknown as SerialPort;

    const sequence: BootSequence = {
      name: "no-control",
      steps: [],
      handshakeByte: 0x7f,
      handshakeTimeoutMs: 100,
      handshakeRetries: 1,
    };

    await executeSequenceSignals(port, sequence);
    expect(setSignals).not.toHaveBeenCalled();
  });

  it("handles setSignals rejection gracefully", async () => {
    const setSignals = vi.fn().mockRejectedValue(new Error("port closed"));
    const port = { setSignals } as unknown as SerialPort;

    const sequence: BootSequence = {
      name: "test",
      steps: [
        { signals: { dataTerminalReady: false }, delayMs: 1, description: "DTR=low" },
      ],
      handshakeByte: 0x7f,
      handshakeTimeoutMs: 100,
      handshakeRetries: 1,
    };

    await expect(executeSequenceSignals(port, sequence)).rejects.toThrow("port closed");
  });

  it("respects delay between signal steps", async () => {
    const setSignals = vi.fn().mockResolvedValue(undefined);
    const port = { setSignals } as unknown as SerialPort;

    const sequence: BootSequence = {
      name: "test",
      steps: [
        { signals: { requestToSend: true }, delayMs: 50, description: "RTS=high" },
        { signals: { requestToSend: false }, delayMs: 50, description: "RTS=low" },
      ],
      handshakeByte: 0x7f,
      handshakeTimeoutMs: 100,
      handshakeRetries: 1,
    };

    const start = Date.now();
    await executeSequenceSignals(port, sequence);
    const elapsed = Date.now() - start;

    // each step has 50ms delay + 20ms settle, so at least ~120ms
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });
});
