// Domain — types & interfaces
export type {
  HardwareType,
  SessionStatus,
  HardwareIdentity,
  PersistedHardwareIdentity,
} from './domain/types'

export type {
  Transport,
  SerialSignals,
  SerialTransport,
  UsbTransport,
} from './domain/transport'

export type { DeviceSelector } from './domain/selector'

export { TypedEventEmitter } from './domain/events'

// Application — DeviceSession
export { DeviceSession } from './application/DeviceSession'
export type {
  DeviceSessionEvents,
  DeviceSessionDeps,
} from './application/DeviceSession'

// Infrastructure
export { DeviceIdentityStore } from './infrastructure/DeviceIdentityStore'
export { SerialSelector } from './infrastructure/selectors/SerialSelector'
export { UsbSelector } from './infrastructure/selectors/UsbSelector'
export { HidSelector } from './infrastructure/selectors/HidSelector'
export { WebSerialTransport } from './infrastructure/transports/WebSerialTransport'
