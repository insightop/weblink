type ConnectStatus = {
    status: 'idle' | 'connecting' | 'connected' | 'disconnected';
    msg: string;
    error: boolean;
}
export type { ConnectStatus };
