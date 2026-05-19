export enum IpKitErrorCode {
  VALIDATION = "VALIDATION",
  NETWORK = "NETWORK",
  ABORTED = "ABORTED",
  PARSE = "PARSE",
  NOT_SUPPORTED = "NOT_SUPPORTED",
  SIZE_LIMIT = "SIZE_LIMIT",
  WEBSOCKET = "WEBSOCKET",
}

export class IpKitError extends Error {
  readonly code: IpKitErrorCode;
  readonly cause?: unknown;
  readonly details?: Record<string, string>;

  constructor(
    code: IpKitErrorCode,
    message: string,
    options?: { cause?: unknown; details?: Record<string, string> },
  ) {
    super(message);
    this.name = "IpKitError";
    this.code = code;
    this.cause = options?.cause;
    this.details = options?.details;
  }

  static fromUnknown(code: IpKitErrorCode, err: unknown, fallbackMessage: string): IpKitError {
    if (err instanceof IpKitError) {
      return err;
    }
    const message = err instanceof Error ? err.message : fallbackMessage;
    return new IpKitError(code, message, { cause: err });
  }

  toUserMessage(): string {
    if (this.details?.hint) {
      return `${this.message}（${this.details.hint}）`;
    }
    return this.message;
  }
}
