/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KIT_SERIAL_URL?: string;
  readonly VITE_KIT_WIRELESS_URL?: string;
  readonly VITE_KIT_DOWNLOAD_URL?: string;
  readonly VITE_KIT_CAPTURE_URL?: string;
  readonly VITE_KIT_GNSS_URL?: string;
  readonly VITE_KIT_MODBUS_URL?: string;
  readonly VITE_KIT_VKVM_URL?: string;
  readonly VITE_KIT_HID_URL?: string;
  readonly VITE_KIT_SENSOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
