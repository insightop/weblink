import { Cp2130Bridge } from "@/infrastructure/bridges/silabs/cp2130/Cp2130Bridge";
import type { WebUsbSession } from "@/infrastructure/usb/WebUsbSession";

export function createSilabsCp2130Bridge(session: WebUsbSession): Cp2130Bridge {
  return new Cp2130Bridge(session);
}
