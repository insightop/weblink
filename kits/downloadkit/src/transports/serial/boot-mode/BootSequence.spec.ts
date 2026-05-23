import { describe, expect, it } from "vitest";
import { STM32_UART_ISP_SEQUENCES } from "./BootSequence";

describe("BootSequence", () => {
  it("defines at least 4 sequences", () => {
    expect(STM32_UART_ISP_SEQUENCES.length).toBeGreaterThanOrEqual(4);
  });

  it("last sequence has empty steps (no-control fallback)", () => {
    const last = STM32_UART_ISP_SEQUENCES[STM32_UART_ISP_SEQUENCES.length - 1];
    expect(last.steps.length).toBe(0);
    expect(last.name).toBe("no-control");
  });

  it("all sequences have handshakeByte 0x7F", () => {
    for (const seq of STM32_UART_ISP_SEQUENCES) {
      expect(seq.handshakeByte).toBe(0x7f);
    }
  });

  it("all sequences have positive handshakeTimeoutMs", () => {
    for (const seq of STM32_UART_ISP_SEQUENCES) {
      expect(seq.handshakeTimeoutMs).toBeGreaterThan(0);
    }
  });

  it("all sequences have positive handshakeRetries", () => {
    for (const seq of STM32_UART_ISP_SEQUENCES) {
      expect(seq.handshakeRetries).toBeGreaterThan(0);
    }
  });

  it("each step has a delayMs >= 0", () => {
    for (const seq of STM32_UART_ISP_SEQUENCES) {
      for (const step of seq.steps) {
        expect(step.delayMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("each step has a non-empty description", () => {
    for (const seq of STM32_UART_ISP_SEQUENCES) {
      for (const step of seq.steps) {
        expect(step.description.length).toBeGreaterThan(0);
      }
    }
  });
});
