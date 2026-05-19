import { FtdiMpsseBridge } from "@/infrastructure/bridges/ftdi/FtdiMpsseBridge";
import type { WebUsbSession } from "@/infrastructure/usb/WebUsbSession";

export function createFtdiMpsseFt232hBridge(session: WebUsbSession): FtdiMpsseBridge {
  return new FtdiMpsseBridge(session);
}
