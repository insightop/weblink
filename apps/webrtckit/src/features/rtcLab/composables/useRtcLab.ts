import { computed, onUnmounted, ref, shallowRef } from "vue";
import { DEFAULT_ICE_SERVERS, parseIceServersInput } from "@/domain/rtc/iceConfig";
import { MeshGraph } from "@/domain/rtc/meshGraph";
import { createLogEntry } from "@/domain/logs/logEntry";
import type { LogEntry, LogLevel } from "@/domain/logs/logEntry";
import type { SignalPayload } from "@/domain/signaling/messageTypes";
import type { ServerToClientMessage } from "@/domain/signaling/messageTypes";
import { isPolitePeer } from "@/domain/signaling/roomPolicy";
import { acceptDebugDataChannel, createDebugDataChannel } from "@/infrastructure/rtc/dataChannelFactory";
import { captureDisplayMedia, captureUserMedia } from "@/infrastructure/rtc/mediaCapture";
import { createPeerConnection } from "@/infrastructure/rtc/peerConnectionFactory";
import { PeerSession } from "@/infrastructure/rtc/peerSession";
import { createSignalingClient } from "@/infrastructure/signaling/signalingClient";
import { buildSignalingWsUrl } from "@/infrastructure/signaling/signalingUrl";
import { randomPeerId, randomRoomId } from "@/shared/utils/id";

const MAX_MESH_PEERS = 8;
const LOG_CAP = 800;

export function useRtcLab() {
  const roomId = ref("");
  const localPeerId = ref(randomPeerId());
  const connected = ref(false);
  const logLevel = ref<LogLevel | "all">("all");
  const logKeyword = ref("");
  const logs = ref<LogEntry[]>([]);
  const iceServersText = ref("");
  const useCamera = ref(true);
  const useMic = ref(true);
  const sharingScreen = ref(false);

  const localStream = shallowRef<MediaStream | null>(null);
  const remoteStreams = ref<Map<string, MediaStream>>(new Map());
  const mesh = shallowRef(new MeshGraph(localPeerId.value));
  const peerStats = ref<Record<string, { connectionState: string; iceConnectionState: string }>>({});

  const sessions = new Map<string, PeerSession>();
  let localMedia: { stream: MediaStream; stop: () => void } | null = null;
  let screenCapture: { stream: MediaStream; stop: () => void } | null = null;

  const signaling = createSignalingClient();

  function log(level: LogLevel, scope: string, message: string, detail?: unknown): void {
    logs.value = [...logs.value, createLogEntry(level, scope, message, detail)].slice(-LOG_CAP);
  }

  function iceServers(): RTCIceServer[] {
    const parsed = parseIceServersInput(iceServersText.value);
    return parsed ?? DEFAULT_ICE_SERVERS;
  }

  function emitSignal(to: string, payload: SignalPayload): void {
    signaling.send({ v: 1, type: "signal", to, payload });
  }

  function wireDataChannel(dc: RTCDataChannel, remotePeerId: string): void {
    dc.addEventListener("message", (ev) => {
      log("info", "datachannel", `[${remotePeerId.slice(0, 8)}] ${String(ev.data)}`);
    });
    dc.addEventListener("open", () => {
      log("info", "datachannel", `open ↔ ${remotePeerId.slice(0, 8)}`);
    });
  }

  function removePeer(remotePeerId: string): void {
    mesh.value.removePeer(remotePeerId);
    const s = sessions.get(remotePeerId);
    if (s) {
      s.dispose();
      sessions.delete(remotePeerId);
    }
    const next = new Map(remoteStreams.value);
    next.delete(remotePeerId);
    remoteStreams.value = next;
    const ps = { ...peerStats.value };
    delete ps[remotePeerId];
    peerStats.value = ps;
  }

  async function ensurePeer(remotePeerId: string): Promise<void> {
    if (remotePeerId === localPeerId.value) return;
    if (sessions.has(remotePeerId)) return;
    if (sessions.size >= MAX_MESH_PEERS) {
      log("warn", "mesh", `已达到建议上限 ${MAX_MESH_PEERS} 条连接`);
      return;
    }

    const pc = createPeerConnection(iceServers());
    const session = new PeerSession(
      remotePeerId,
      localPeerId.value,
      pc,
      (payload) => emitSignal(remotePeerId, payload),
      (ice) => emitSignal(remotePeerId, { kind: "candidate", ice }),
      (msg, detail) => log("debug", `pc:${remotePeerId.slice(0, 6)}`, msg, detail),
    );

    pc.addEventListener("track", (ev) => {
      const ms = ev.streams[0];
      if (ms) {
        const m = new Map(remoteStreams.value);
        m.set(remotePeerId, ms);
        remoteStreams.value = m;
      }
    });

    if (localMedia?.stream) {
      for (const t of localMedia.stream.getTracks()) {
        pc.addTrack(t, localMedia.stream);
      }
    }
    if (screenCapture?.stream) {
      const vt = screenCapture.stream.getVideoTracks()[0];
      if (vt) pc.addTrack(vt, screenCapture.stream);
    }

    if (isPolitePeer(localPeerId.value, remotePeerId)) {
      const dc = createDebugDataChannel(pc);
      wireDataChannel(dc, remotePeerId);
    } else {
      acceptDebugDataChannel(pc, (dc) => wireDataChannel(dc, remotePeerId));
    }

    sessions.set(remotePeerId, session);
  }

  function handleServerMessage(msg: ServerToClientMessage): void {
    if (msg.type === "welcome") {
      for (const p of msg.peers) {
        if (mesh.value.addPeer(p)) void ensurePeer(p);
      }
      return;
    }
    if (msg.type === "peer-joined") {
      if (mesh.value.addPeer(msg.peerId)) void ensurePeer(msg.peerId);
      log("info", "room", `peer 加入: ${msg.peerId.slice(0, 8)}…`);
      return;
    }
    if (msg.type === "peer-left") {
      log("info", "room", `peer 离开: ${msg.peerId.slice(0, 8)}…`);
      removePeer(msg.peerId);
      return;
    }
    if (msg.type === "error") {
      log("error", "signal", msg.message);
      return;
    }
    if (msg.type === "signal") {
      const s = sessions.get(msg.from);
      if (s) void s.handleRemoteSignal(msg.payload);
      return;
    }
  }

  signaling.onMessage((m) => handleServerMessage(m));

  signaling.onClose((code, reason) => {
    log("warn", "signal", `WebSocket 关闭 ${code} ${reason}`);
    connected.value = false;
  });

  signaling.onError((e) => {
    log("error", "signal", "WebSocket error", e);
  });

  let statsTimer: ReturnType<typeof setInterval> | null = null;

  function startStatsPolling(): void {
    stopStatsPolling();
    statsTimer = setInterval(() => {
      const out: Record<string, { connectionState: string; iceConnectionState: string }> = {};
      for (const [id, sess] of sessions) {
        const pc = sess.getPeerConnection();
        out[id] = {
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
        };
      }
      peerStats.value = out;
    }, 1500);
  }

  function stopStatsPolling(): void {
    if (statsTimer) {
      clearInterval(statsTimer);
      statsTimer = null;
    }
  }

  async function startLocalMedia(): Promise<void> {
    if (localMedia) {
      localMedia.stop();
      localMedia = null;
    }
    if (!useCamera.value && !useMic.value) {
      localStream.value = null;
      return;
    }
    localMedia = await captureUserMedia(useMic.value, useCamera.value);
    localStream.value = localMedia.stream;
  }

  async function connect(): Promise<void> {
    const rid = roomId.value.trim();
    if (!rid) {
      log("error", "room", "请填写房间 ID");
      return;
    }
    mesh.value = new MeshGraph(localPeerId.value);
    await startLocalMedia();
    const url = buildSignalingWsUrl(rid, localPeerId.value);
    log("info", "signal", `连接 ${url}`);
    try {
      await signaling.connect(url);
      connected.value = true;
      log("info", "signal", "信令已连接，等待成员…");
      startStatsPolling();
    } catch (e) {
      log("error", "signal", "连接失败", e);
      if (localMedia) {
        localMedia.stop();
        localMedia = null;
        localStream.value = null;
      }
    }
  }

  function disconnect(): void {
    stopStatsPolling();
    signaling.disconnect();
    connected.value = false;
    if (localMedia) {
      localMedia.stop();
      localMedia = null;
      localStream.value = null;
    }
    if (screenCapture) {
      screenCapture.stop();
      screenCapture = null;
      sharingScreen.value = false;
    }
    for (const id of [...sessions.keys()]) {
      removePeer(id);
    }
    sessions.clear();
    mesh.value = new MeshGraph(localPeerId.value);
    remoteStreams.value = new Map();
    peerStats.value = {};
    log("info", "room", "已断开");
  }

  async function toggleScreenShare(): Promise<void> {
    if (sharingScreen.value && screenCapture) {
      screenCapture.stop();
      screenCapture = null;
      sharingScreen.value = false;
      await replaceVideoOnPeers(null);
      log("info", "media", "已停止屏幕共享");
      return;
    }
    try {
      screenCapture = await captureDisplayMedia(true);
      sharingScreen.value = true;
      const vtrack = screenCapture.stream.getVideoTracks()[0];
      if (vtrack) {
        await replaceVideoOnPeers(vtrack);
        for (const sess of sessions.values()) {
          const pc = sess.getPeerConnection();
          const hasVideo = pc.getSenders().some((s) => s.track?.kind === "video");
          if (!hasVideo) {
            pc.addTrack(vtrack, screenCapture!.stream);
          }
        }
      }
      log("info", "media", "屏幕共享中");
      vtrack?.addEventListener("ended", () => {
        void toggleScreenShare();
      });
    } catch (e) {
      log("error", "media", "屏幕共享失败", e);
    }
  }

  async function replaceVideoOnPeers(track: MediaStreamTrack | null): Promise<void> {
    for (const sess of sessions.values()) {
      const pc = sess.getPeerConnection();
      const senders = pc.getSenders().filter((s) => s.track?.kind === "video");
      if (track && senders.length > 0) {
        for (const s of senders) {
          await s.replaceTrack(track);
        }
      } else if (!track && senders.length > 0) {
        for (const s of senders) {
          await s.replaceTrack(null);
        }
      }
    }
  }

  function regeneratePeerId(): void {
    if (connected.value) return;
    localPeerId.value = randomPeerId();
    mesh.value = new MeshGraph(localPeerId.value);
  }

  function newRoomId(): void {
    if (connected.value) return;
    roomId.value = randomRoomId();
  }

  function sendDcPing(): void {
    signaling.send({ v: 1, type: "ping" });
  }

  const displayedLogs = computed(() => {
    const kw = logKeyword.value.trim().toLowerCase();
    return logs.value.filter((e) => {
      if (logLevel.value !== "all" && e.level !== logLevel.value) return false;
      if (!kw) return true;
      return e.message.toLowerCase().includes(kw) || e.scope.toLowerCase().includes(kw);
    });
  });

  function clearLogs(): void {
    logs.value = [];
  }

  const previewStream = computed(() => {
    if (sharingScreen.value && screenCapture?.stream) return screenCapture.stream;
    return localStream.value;
  });

  onUnmounted(() => {
    disconnect();
    if (localMedia) localMedia.stop();
    if (screenCapture) screenCapture.stop();
  });

  return {
    roomId,
    localPeerId,
    connected,
    logLevel,
    logKeyword,
    logs: displayedLogs,
    rawLogs: logs,
    iceServersText,
    useCamera,
    useMic,
    sharingScreen,
    localStream,
    previewStream,
    remoteStreams,
    peerStats,
    connect,
    disconnect,
    regeneratePeerId,
    newRoomId,
    toggleScreenShare,
    sendDcPing,
    clearLogs,
    log,
  };
}
