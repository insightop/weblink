import type { UsbTransport } from "@/transports/types";
import { flashWithDapLink, type DapLinkProgressHandler } from "@/integrations/dapjs/dapLinkFlash";

export interface DaplinkAdapter {
  connect(): Promise<void>;
  flash(image: Uint8Array, onProgress?: DapLinkProgressHandler): Promise<void>;
  disconnect(): Promise<void>;
}

export function createDaplinkAdapter(transport: UsbTransport): DaplinkAdapter {
  return {
    async connect(): Promise<void> {
      await transport.open();
      transport.getDevice();
    },
    async flash(image: Uint8Array, onProgress?: DapLinkProgressHandler): Promise<void> {
      const device = transport.getDevice();
      await flashWithDapLink(device, image, onProgress);
    },
    async disconnect(): Promise<void> {
      await transport.close();
    },
  };
}
