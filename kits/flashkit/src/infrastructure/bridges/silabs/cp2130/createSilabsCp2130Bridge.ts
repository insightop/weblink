import { Cp2130Bridge } from "./Cp2130Bridge";
import type { WebUsbSession } from "../../../usb/WebUsbSession";

export function createSilabsCp2130Bridge(session: WebUsbSession): Cp2130Bridge {
  return new Cp2130Bridge(session);
}
