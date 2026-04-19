import { Cp2112Bridge } from "@/infrastructure/bridges/silabs/cp2112/Cp2112Bridge";
import type { WebHidSession } from "@/infrastructure/hid/WebHidSession";

export function createSilabsCp2112Bridge(session: WebHidSession): Cp2112Bridge {
  return new Cp2112Bridge(session);
}
