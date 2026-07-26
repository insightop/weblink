export const ErrorCode = {
  ConnectionFailed: "CONNECTION_FAILED",
  AuthFailed: "AUTH_FAILED",
  RoomNotFound: "ROOM_NOT_FOUND",
  TrackPublishFailed: "TRACK_PUBLISH_FAILED",
  InvalidOperation: "INVALID_OPERATION",
  NotSupported: "NOT_SUPPORTED",
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

export class RoomError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "RoomError"
    this.code = code
  }
}
