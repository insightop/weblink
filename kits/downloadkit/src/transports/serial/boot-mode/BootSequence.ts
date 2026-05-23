export interface SerialSignals {
  dataTerminalReady?: boolean;
  requestToSend?: boolean;
  break?: boolean;
}

export interface BootStep {
  signals: SerialSignals;
  delayMs: number;
  description: string;
}

export interface BootSequence {
  name: string;
  steps: BootStep[];
  handshakeByte: number;
  handshakeTimeoutMs: number;
  handshakeRetries: number;
  /** 信号完成后、握手前的额外等待时间（ms），让 MCU 充分启动。默认 500 */
  postSignalDelayMs?: number;
}

export interface BootAttemptInfo {
  sequenceName: string;
  attempt: number;
  totalAttempts: number;
  description: string;
}

export interface BootModeOptions {
  sequences?: BootSequence[];
  onAttempt?: (info: BootAttemptInfo) => void;
  preferredSequence?: string;
}

// ─── 电路模型 ───────────────────────────────────────────────

/**
 * USB-UART 桥接芯片 DTR/RTS 引脚到 STM32 NRST/BOOT0 的电路拓扑。
 *
 * ┌─────────────────────┬──────────┬────────────┬───────────────────────────┐
 * │ 拓扑                │ 复位有效   │ BOOT0=1    │ 典型场景                  │
 * ├─────────────────────┼──────────┼────────────┼───────────────────────────┤
 * │ 直连（非反相）        │ LOW      │ HIGH       │ 无晶体管，电平直驱         │
 * │ NPN 反相（常见）      │ HIGH     │ LOW        │ DTR→NPN→NRST（Blue Pill） │
 * │ PNP 反相（较少见）    │ LOW      │ HIGH       │ 反相器但无上拉             │
 * └─────────────────────┴──────────┴────────────┴───────────────────────────┘
 *
 * USB-UART 的 DTR/RTS 信号是低电平有效型（active-low），即：
 *   `false` = pin 拉低（asserted）
 *   `true`  = pin 拉高（deasserted）
 *
 * 注：PNP 与直连在逻辑上极性相同（都是非反相），只是驱动方式不同。
 */

/** 复位信号极性：invReset=false → 信号 LOW = NRST LOW = 复位；invReset=true → 信号 HIGH = NRST LOW = 复位（NPN/PNP 反相） */
const ResetPolarity = { DIRECT: false, INVERTED: true } as const;

/** BOOT0 信号极性：invBoot=false → 信号 HIGH = BOOT0 HIGH；invBoot=true → 信号 LOW = 上拉使 BOOT0 HIGH（NPN/PNP 反相） */
const BootPolarity = { DIRECT: false, INVERTED: true } as const;

type SignalKey = keyof SerialSignals;

function signalLabel(key: SignalKey): string {
  switch (key) {
    case "dataTerminalReady":
      return "DTR";
    case "requestToSend":
      return "RTS";
    case "break":
      return "BRK";
  }
}

/**
 * 根据电路配置生成一条 boot 序列。
 *
 * 规则：
 * 1. 先将复位引脚拉到复位电平 + BOOT0 引脚拉到 boot 电平
 * 2. 释放复位引脚（复位引脚翻转），BOOT0 引脚保持 boot 电平
 *
 * @param resetSig  接 NRST 的 USB-UART 信号
 * @param bootSig   接 BOOT0 的 USB-UART 信号（另一个）
 * @param invReset  复位路径是否反相（NPN/PNP：信号 HIGH → NRST LOW）
 * @param invBoot   BOOT0 路径是否反相（NPN/PNP：信号 LOW → 上拉 → BOOT0 HIGH）
 */
function buildSequence(
  resetSig: SignalKey,
  bootSig: SignalKey,
  invReset: boolean,
  invBoot: boolean,
): BootSequence {
  // 反相时信号 HIGH→复位生效，非反相时信号 LOW→复位生效
  const resetActive = invReset;
  // 反相时信号 LOW→BOOT0=1（NPN 截止+上拉），非反相时信号 HIGH→BOOT0=1
  const bootActive = !invBoot;

  const step1: SerialSignals = { [resetSig]: resetActive, [bootSig]: bootActive };
  const step2: SerialSignals = { [resetSig]: !resetActive, [bootSig]: bootActive };

  const rLabel = signalLabel(resetSig);
  const bLabel = signalLabel(bootSig);
  const rType = invReset ? "npn" : "direct";
  const bType = invBoot ? "npn" : "direct";

  return {
    name: `${rLabel}-${rType}-reset_${bLabel}-${bType}-boot`,
    steps: [
      {
        signals: step1,
        delayMs: 50,
        description: `${rLabel}=${step1[resetSig] ? "H" : "L"}(${rType} ${invReset ? "→NRST=L" : "→NRST=L"}), ${bLabel}=${step1[bootSig] ? "H" : "L"}(${bType} ${invBoot ? "→BOOT0=H(pull-up)" : "→BOOT0=H"})`,
      },
      {
        signals: step2,
        delayMs: 100,
        description: `${rLabel}=${step2[resetSig] ? "H" : "L"}(release), ${bLabel}=${step2[bootSig] ? "H" : "L"}(${bType})`,
      },
    ],
    handshakeByte: 0x7f,
    handshakeTimeoutMs: 1000,
    handshakeRetries: 2,
    postSignalDelayMs: 500,
  };
}

/** 生成 2×2×2 = 8 种完整电路拓扑的 boot 序列。 */
function generateCircuitSequences(): BootSequence[] {
  const assignments: Array<{ reset: SignalKey; boot: SignalKey }> = [
    { reset: "dataTerminalReady", boot: "requestToSend" },
    { reset: "requestToSend", boot: "dataTerminalReady" },
  ];

  const seqs: BootSequence[] = [];
  for (const { reset, boot } of assignments) {
    for (const resetHigh of [false, true]) {
      for (const bootHigh of [false, true]) {
        seqs.push(buildSequence(reset, boot, resetHigh, bootHigh));
      }
    }
  }
  return seqs;
}

function resetOnlyEdgeCase(): BootSequence {
  return {
    name: "dtr-reset-only",
    steps: [
      { signals: { dataTerminalReady: false }, delayMs: 50, description: "DTR=low(reset)" },
      { signals: { dataTerminalReady: true }, delayMs: 100, description: "DTR=high(release reset)" },
    ],
    handshakeByte: 0x7f,
    handshakeTimeoutMs: 1000,
    handshakeRetries: 2,
    postSignalDelayMs: 500,
  };
}

function noControlEdgeCase(): BootSequence {
  return {
    name: "no-control",
    steps: [],
    handshakeByte: 0x7f,
    handshakeTimeoutMs: 1000,
    handshakeRetries: 2,
    postSignalDelayMs: 0,
  };
}

/**
 * STM32 UART ISP (AN3155) boot mode entry sequences。
 *
 * 优先遍历 8 种完整电路拓扑（覆盖 2 种引脚分配 × 2 种复位极性 × 2 种 BOOT0 极性），
 * 然后降级到纯复位脉冲（无 BOOT0 控制），最后是无信号控制（已在 bootloader 模式）。
 */
export const STM32_UART_ISP_SEQUENCES: BootSequence[] = [
  ...generateCircuitSequences(),
  resetOnlyEdgeCase(),
  noControlEdgeCase(),
];
