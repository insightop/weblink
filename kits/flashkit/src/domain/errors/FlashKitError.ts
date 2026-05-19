export const FlashKitErrorCode = {
  USB_NOT_SUPPORTED: "USB_NOT_SUPPORTED",
  HID_NOT_SUPPORTED: "HID_NOT_SUPPORTED",
  HID_TRANSFER_FAILED: "HID_TRANSFER_FAILED",
  DEVICE_NOT_SELECTED: "DEVICE_NOT_SELECTED",
  BRIDGE_NOT_SUPPORTED: "BRIDGE_NOT_SUPPORTED",
  BUS_NOT_SUPPORTED: "BUS_NOT_SUPPORTED",
  USB_TRANSFER_FAILED: "USB_TRANSFER_FAILED",
  CHIP_MISMATCH: "CHIP_MISMATCH",
  VERIFY_FAILED: "VERIFY_FAILED",
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  OPERATION_ABORTED: "OPERATION_ABORTED",
} as const;

export type FlashKitErrorCode = (typeof FlashKitErrorCode)[keyof typeof FlashKitErrorCode];

export class FlashKitError extends Error {
  readonly code: FlashKitErrorCode;
  readonly cause?: unknown;

  constructor(code: FlashKitErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "FlashKitError";
    this.code = code;
    this.cause = cause;
  }
}
