import type { ClientToServerMessage, ServerToClientMessage } from "./messageTypes";

export type SignalingTransport = {
  connect: (url: string) => Promise<void>;
  disconnect: () => void;
  send: (msg: ClientToServerMessage) => void;
  onMessage: (handler: (msg: ServerToClientMessage) => void) => void;
  onClose: (handler: (code: number, reason: string) => void) => void;
  onError: (handler: (err: unknown) => void) => void;
  readonly connected: boolean;
};
