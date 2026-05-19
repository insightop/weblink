export type CanKitErrorCode =
  | "SERIAL_UNSUPPORTED"
  | "WEBUSB_UNSUPPORTED"
  | "USER_CANCELLED"
  | "PORT_OPEN_FAILED"
  | "PORT_NOT_OPEN"
  | "WRITE_FAILED"
  | "READ_FAILED"
  | "SLCAN_PARSE"
  | "INVALID_ARGUMENT"
  | "USB_CLAIM_FAILED"
  | "USB_TRANSFER"
  | "GSUSB_DECODE"
  | "GSUSB_UNSUPPORTED_BITRATE";

export class CanKitError extends Error {
  readonly code: CanKitErrorCode;
  readonly cause?: unknown;

  constructor(
    code: CanKitErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = "CanKitError";
    this.code = code;
    this.cause = options?.cause;
  }
}

export class SlcanParseError extends CanKitError {
  readonly rawLine: string;

  constructor(message: string, rawLine: string) {
    super("SLCAN_PARSE", message, {});
    this.name = "SlcanParseError";
    this.rawLine = rawLine;
  }
}
