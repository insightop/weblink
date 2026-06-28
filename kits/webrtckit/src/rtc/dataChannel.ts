const DEBUG_LABEL = "webrtckit-debug";

export function createDebugDataChannel(pc: RTCPeerConnection): RTCDataChannel {
  const ch = pc.createDataChannel(DEBUG_LABEL, { ordered: true });
  return ch;
}

export function acceptDebugDataChannel(
  pc: RTCPeerConnection,
  onOpen: (ch: RTCDataChannel) => void,
): void {
  pc.addEventListener("datachannel", (ev) => {
    if (ev.channel.label === DEBUG_LABEL) {
      onOpen(ev.channel);
    }
  });
}
