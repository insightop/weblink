import { Ch341VendorBulkBridge } from "@/infrastructure/bridges/ch341/Ch341VendorBulkBridge";
import type { WebUsbSession } from "@/infrastructure/usb/WebUsbSession";

export function createCh341VendorBulkBridge(session: WebUsbSession): Ch341VendorBulkBridge {
  return new Ch341VendorBulkBridge(session);
}
