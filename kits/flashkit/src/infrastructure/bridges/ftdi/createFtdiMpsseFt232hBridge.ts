import { FtdiMpsseBridge } from "./FtdiMpsseBridge";
import type { WebUsbSession } from "../../usb/WebUsbSession";

export function createFtdiMpsseFt232hBridge(session: WebUsbSession): FtdiMpsseBridge {
  return new FtdiMpsseBridge(session);
}
