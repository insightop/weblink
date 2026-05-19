import { ErrorCode, type DownloadError } from "@/core/errors/ErrorCode";
import { i18n } from "@/i18n";
import { Logger } from "../../../vendor/protocols/webstlink/src/lib/package.js";
import WebStlink from "../../../vendor/protocols/webstlink/src/webstlink.js";

export interface StlinkTargetVariant {
  type: string;
  freq?: number;
  flash_size?: number;
  sram_size?: number;
  eeprom_size?: number;
}

export interface StlinkDebugConfig {
  debugInterface: "swd" | "jtag";
  debugClockHz: number;
}

interface ProgressTracker {
  baseAddress: number;
  totalBytes: number;
}

/** ST-Link V2 debug API (aligned with vendor/protocols/webstlink); kept in app code to avoid patching submodule. */
const STLINK_DEBUG_COMMAND = 0xf2;
const STLINK_DEBUG_APIV2_ENTER = 0x30;
const STLINK_DEBUG_ENTER_JTAG = 0x00;

type StlinkVendorConnector = {
  xfer: (cmd: number[] | ArrayBuffer, opts: { rx_len: number }) => Promise<ArrayBufferView>;
};

type StlinkVendorRaw = {
  set_swd_freq?: (hz: number) => Promise<void>;
  leave_state?: () => Promise<void>;
  enter_debug_swd?: () => Promise<void>;
  _connector?: StlinkVendorConnector;
};

async function enterDebugJtag(connector: StlinkVendorConnector): Promise<void> {
  await connector.xfer([STLINK_DEBUG_COMMAND, STLINK_DEBUG_APIV2_ENTER, STLINK_DEBUG_ENTER_JTAG], { rx_len: 2 });
}

export interface StlinkAdapter {
  connect(
    pickVariant?: (candidates: StlinkTargetVariant[]) => Promise<string | null>,
    debugConfig?: StlinkDebugConfig,
  ): Promise<void>;
  setProgressTracker(tracker: ProgressTracker): void;
  setProgressHandler(handler: (writtenBytes: number, totalBytes: number) => void): void;
  flash(address: number, data: Uint8Array): Promise<void>;
  reset(): Promise<void>;
  disconnect(): Promise<void>;
}

export function createStlinkAdapter(device: USBDevice): StlinkAdapter {
  class AdapterLogger extends Logger {
    private tracker: ProgressTracker = { baseAddress: 0, totalBytes: 0 };
    private progressHandler: (writtenBytes: number, totalBytes: number) => void = () => undefined;
    private writeStageActive = false;

    setProgressTracker(tracker: ProgressTracker): void {
      this.tracker = tracker;
    }

    setProgressHandler(handler: (writtenBytes: number, totalBytes: number) => void): void {
      this.progressHandler = handler;
    }

    bargraph_start(message: string): void {
      this.writeStageActive = message === "Writing FLASH";
    }

    bargraph_update({ value = 0 }: { value?: number }): void {
      if (!this.writeStageActive || this.tracker.totalBytes <= 0) return;
      const written = Math.max(
        0,
        Math.min(this.tracker.totalBytes, Math.floor(value - this.tracker.baseAddress)),
      );
      this.progressHandler(written, this.tracker.totalBytes);
    }

    bargraph_done(): void {
      if (!this.writeStageActive || this.tracker.totalBytes <= 0) return;
      this.progressHandler(this.tracker.totalBytes, this.tracker.totalBytes);
      this.writeStageActive = false;
    }
  }

  const logger = new AdapterLogger(1, null);
  const stlink = new WebStlink(logger);

  function targetSelectionCancelled(): DownloadError {
    return {
      code: ErrorCode.UserCancelled,
      userMessage: String(i18n.global.t("target.selectionCancelled")),
    };
  }

  return {
    async connect(pickVariant, debugConfig = { debugInterface: "swd", debugClockHz: 1800000 }) {
      await stlink.attach(device);

      const raw = (stlink as unknown as { _stlink?: StlinkVendorRaw })._stlink;
      if (raw) {
        if (debugConfig.debugClockHz > 0 && raw.set_swd_freq) {
          await raw.set_swd_freq(debugConfig.debugClockHz);
        }
        if (raw.leave_state) {
          await raw.leave_state();
        }
        if (debugConfig.debugInterface === "jtag" && raw._connector) {
          await enterDebugJtag(raw._connector);
        } else if (raw.enter_debug_swd) {
          await raw.enter_debug_swd();
        }
      }

      const wrappedPick = pickVariant
        ? async (candidates: StlinkTargetVariant[]) => {
            const picked = await pickVariant(candidates);
            if (picked === null || picked === undefined) {
              await stlink.detach().catch(() => undefined);
              throw targetSelectionCancelled();
            }
            return picked;
          }
        : undefined;
      await stlink.detect_cpu([], wrappedPick ?? null);
    },
    setProgressTracker(tracker) {
      logger.setProgressTracker(tracker);
    },
    setProgressHandler(handler) {
      logger.setProgressHandler(handler);
    },
    async flash(address, data) {
      await stlink.flash(address, data);
    },
    async reset() {
      await stlink.reset(false);
    },
    async disconnect() {
      await stlink.detach();
    },
  };
}
