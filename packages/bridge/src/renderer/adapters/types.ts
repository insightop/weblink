/**
 * @weblink/bridge — IPC Adapter Interface
 *
 * Abstracts the platform-specific IPC mechanism.
 * Both Electron and Tauri adapters implement this interface.
 */

export interface IpcAdapter {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
}
