import { IpKitError, IpKitErrorCode } from "@/domain/errors/IpKitError";

type WebTransportConstructor = new (
  url: string,
  options?: object,
) => {
  ready: Promise<void>;
  closed: Promise<unknown>;
  close: () => void;
};

export interface WebTransportProbeResult {
  supported: boolean;
  connected: boolean;
  message?: string;
}

export async function probeWebTransport(url: string): Promise<WebTransportProbeResult> {
  const WT = (globalThis as unknown as { WebTransport?: WebTransportConstructor }).WebTransport;
  if (!WT) {
    return { supported: false, connected: false, message: "当前环境不支持 WebTransport" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { supported: true, connected: false, message: "URL 无效" };
  }

  if (parsed.protocol !== "https:") {
    return { supported: true, connected: false, message: "WebTransport 需要 https: URL" };
  }

  const transport = new WT(parsed.href);

  try {
    await transport.ready;
    transport.close();
    return { supported: true, connected: true, message: "握手成功（已关闭连接）" };
  } catch (e) {
    try {
      transport.close();
    } catch {
      /* ignore */
    }
    const msg = e instanceof Error ? e.message : String(e);
    return {
      supported: true,
      connected: false,
      message: msg,
    };
  }
}

export function assertWebTransportAvailable(): void {
  const WT = (globalThis as unknown as { WebTransport?: unknown }).WebTransport;
  if (!WT) {
    throw new IpKitError(IpKitErrorCode.NOT_SUPPORTED, "浏览器不支持 WebTransport");
  }
}
