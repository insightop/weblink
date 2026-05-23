import { toUserError, UserError } from "../errors/userErrors";

export type NfcStatus =
  | { state: "idle" }
  | { state: "scanning" }
  | { state: "stopped" };

export class NfcSession {
  private reader: NDEFReader | null = null;
  private abort: AbortController | null = null;

  async scan(onMessage: (msg: NDEFMessage, serialNumber: string) => void): Promise<void> {
    if (typeof window === "undefined" || !("NDEFReader" in window)) {
      throw new UserError("unsupported", "当前浏览器不支持 Web NFC");
    }

    try {
      const reader = new NDEFReader();
      const abort = new AbortController();
      this.reader = reader;
      this.abort = abort;

      reader.onreading = (ev: NDEFReadingEvent) => {
        onMessage(ev.message, ev.serialNumber);
      };
      reader.onreadingerror = () => {
        // Best-effort: surfaces as generic error via caller logs if needed
      };

      await reader.scan({ signal: abort.signal });
    } catch (e) {
      throw toUserError(e);
    }
  }

  stop(): void {
    if (this.abort) this.abort.abort();
    this.abort = null;
    this.reader = null;
  }

  async writeText(text: string): Promise<void> {
    if (!this.reader) {
      // Web NFC allows write without scanning; but we require a reader instance to unify flows
      if (typeof window === "undefined" || !("NDEFReader" in window)) {
        throw new UserError("unsupported", "当前浏览器不支持 Web NFC");
      }
      this.reader = new NDEFReader();
    }
    try {
      await this.reader.write({
        records: [
          {
            recordType: "text",
            data: String(text ?? ""),
            lang: "zh",
          },
        ],
      });
    } catch (e) {
      throw toUserError(e);
    }
  }

  async writeUrl(url: string): Promise<void> {
    if (!this.reader) {
      if (typeof window === "undefined" || !("NDEFReader" in window)) {
        throw new UserError("unsupported", "当前浏览器不支持 Web NFC");
      }
      this.reader = new NDEFReader();
    }
    try {
      await this.reader.write({
        records: [
          {
            recordType: "url",
            data: String(url ?? ""),
          },
        ],
      });
    } catch (e) {
      throw toUserError(e);
    }
  }
}

