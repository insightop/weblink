/** Minimal shape for rtcConfiguration.iceServers */
export type RTCIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};
