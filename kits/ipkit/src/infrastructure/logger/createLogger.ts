import { createLogger as _createLogger } from "@weblink/utils/logger";
import type { Logger } from "@weblink/utils/logger";

export type { Logger };

export function createLogger(scope: string): Logger {
  return _createLogger(`ipkit:${scope}`);
}
