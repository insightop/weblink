import { Cp2112Bridge } from "./Cp2112Bridge";
import type { WebHidSession } from "../../../hid/WebHidSession";

export function createSilabsCp2112Bridge(session: WebHidSession): Cp2112Bridge {
  return new Cp2112Bridge(session);
}
