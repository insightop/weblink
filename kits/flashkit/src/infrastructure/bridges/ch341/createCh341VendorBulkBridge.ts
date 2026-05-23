import { Ch341VendorBulkBridge } from "./Ch341VendorBulkBridge";
import type { WebUsbSession } from "../../usb/WebUsbSession";

export function createCh341VendorBulkBridge(session: WebUsbSession): Ch341VendorBulkBridge {
  return new Ch341VendorBulkBridge(session);
}
