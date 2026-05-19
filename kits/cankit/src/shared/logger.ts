import { createLogger } from "@weblink/utils/logger";

const logger = createLogger("cankit");

export const logDebug = logger.debug;
export const logInfo = logger.info;
export const logWarn = logger.warn;
export const logError = logger.error;
