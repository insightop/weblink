import { FlashKitError, FlashKitErrorCode } from "../../domain/errors/FlashKitError";
import { flashKitLogger } from "../../shared/logging/flashKitLogger";

function assertHidSupported(): void {
  if (!("hid" in navigator)) {
    throw new FlashKitError(FlashKitErrorCode.HID_NOT_SUPPORTED, "WebHID is not supported in this browser");
  }
}

export class WebHidSession {
  private device: HIDDevice | null = null;

  getDevice(): HIDDevice | null {
    return this.device;
  }

  setDevice(device: HIDDevice): void {
    this.device = device;
  }

  async requestDevice(filters: HIDDeviceFilter[]): Promise<HIDDevice> {
    assertHidSupported();
    const hid = navigator.hid as HID;
    const list = await hid.requestDevice({ filters });
    const first = list[0];
    if (!first) {
      throw new FlashKitError(FlashKitErrorCode.DEVICE_NOT_SELECTED, "No HID device selected");
    }
    this.device = first;
    return first;
  }

  async open(): Promise<void> {
    const dev = this.device;
    if (!dev) {
      throw new FlashKitError(FlashKitErrorCode.DEVICE_NOT_SELECTED, "HID device is not selected");
    }
    if (!dev.opened) {
      await dev.open();
    }
    flashKitLogger.info({ hid: true }, "HID device opened");
  }

  async close(): Promise<void> {
    const dev = this.device;
    if (dev?.opened) {
      await dev.close().catch(() => undefined);
    }
  }

  clearDevice(): void {
    this.device = null;
  }

  /**
   * 发送 HID Output 报告（reportId 与载荷分离，与 Chromium `sendReport` 一致）。
   */
  async sendOutputReport(reportId: number, payload: Uint8Array): Promise<void> {
    const dev = this.device;
    if (!dev?.opened) {
      throw new FlashKitError(FlashKitErrorCode.DEVICE_NOT_SELECTED, "HID device is not open");
    }
    try {
      await dev.sendReport(reportId, new Uint8Array(payload));
    } catch (e) {
      throw new FlashKitError(FlashKitErrorCode.HID_TRANSFER_FAILED, "HID sendReport failed", e);
    }
  }

  async sendFeatureReport(reportId: number, payload: Uint8Array): Promise<void> {
    const dev = this.device;
    if (!dev?.opened) {
      throw new FlashKitError(FlashKitErrorCode.DEVICE_NOT_SELECTED, "HID device is not open");
    }
    try {
      await dev.sendFeatureReport(reportId, new Uint8Array(payload));
    } catch (e) {
      throw new FlashKitError(FlashKitErrorCode.HID_TRANSFER_FAILED, "HID sendFeatureReport failed", e);
    }
  }

  async receiveFeatureReport(reportId: number): Promise<DataView> {
    const dev = this.device;
    if (!dev?.opened) {
      throw new FlashKitError(FlashKitErrorCode.DEVICE_NOT_SELECTED, "HID device is not open");
    }
    try {
      return await dev.receiveFeatureReport(reportId);
    } catch (e) {
      throw new FlashKitError(FlashKitErrorCode.HID_TRANSFER_FAILED, "HID receiveFeatureReport failed", e);
    }
  }

  /**
   * 等待下一条 input 报告；可选按 reportId 过滤。
   */
  async waitForInputReport(expectedReportId: number | null, timeoutMs: number): Promise<HIDInputReportEvent> {
    const dev = this.device;
    if (!dev?.opened) {
      throw new FlashKitError(FlashKitErrorCode.DEVICE_NOT_SELECTED, "HID device is not open");
    }
    return await new Promise<HIDInputReportEvent>((resolve, reject) => {
      const t = window.setTimeout(() => {
        cleanup();
        reject(new FlashKitError(FlashKitErrorCode.HID_TRANSFER_FAILED, "HID input report timeout"));
      }, timeoutMs);
      const handler = (ev: HIDInputReportEvent): void => {
        if (expectedReportId !== null && ev.reportId !== expectedReportId) {
          return;
        }
        cleanup();
        resolve(ev);
      };
      const cleanup = (): void => {
        window.clearTimeout(t);
        dev.removeEventListener("inputreport", handler as EventListener);
      };
      dev.addEventListener("inputreport", handler as EventListener);
    });
  }
}
