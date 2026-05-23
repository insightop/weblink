import type { BootSequence } from "./BootSequence";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 执行 boot sequence 的 DTR/RTS 信号序列（不含协议握手）。 */
export async function executeSequenceSignals(
  port: SerialPort,
  sequence: BootSequence,
): Promise<void> {
  for (const step of sequence.steps) {
    await port.setSignals(step.signals);
    await delay(step.delayMs);
  }
  const settle = sequence.postSignalDelayMs ?? 500;
  if (settle > 0) await delay(settle);
}
