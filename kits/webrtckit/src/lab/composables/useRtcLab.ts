import { computed, onUnmounted, ref, shallowRef } from "vue";
import { DEFAULT_ICE_SERVERS, parseIceServersInput } from "../../rtc/ice";
import { createLogEntry } from "@weblink/ui-vue";
import type { LogEntry, LogLevel } from "@weblink/ui-vue";
import { createDoRoomService } from "../../room-service/adapters/do-adapter";
import type { RoomSession, ConnectionState, TrackPublication } from "../../room-service/types";
import { captureDisplayMedia, captureUserMedia } from "../../rtc/mediaCapture";
import { randomPeerId, randomRoomId } from "../../utils/id";

const LOG_CAP = 800;

export function useRtcLab() {
  // === Config / Identity ===
  const roomId = ref("");
  const localPeerId = ref(randomPeerId());
  const iceServersText = ref("");
  const useCamera = ref(true);
  const useMic = ref(true);

  // === Connection ===
  const connected = ref(false);

  // === Media ===
  const sharingScreen = ref(false);
  const localStream = shallowRef<MediaStream | null>(null);
  const previewStream = computed(() => {
    if (sharingScreen.value && screenCapture?.stream) return screenCapture.stream;
    return localStream.value;
  });
  const remoteStreams = ref<Map<string, MediaStream>>(new Map());

  // === Stats ===
  const peerStats = ref<Record<string, { connectionState: string; iceConnectionState: string }>>({});

  // === Logging ===
  const logLevel = ref<LogLevel | "all">("all");
  const logKeyword = ref("");
  const logs = ref<LogEntry[]>([]);
  const displayedLogs = computed(() => {
    const kw = logKeyword.value.trim().toLowerCase();
    return logs.value.filter((e) => {
      if (logLevel.value !== "all" && e.level !== logLevel.value) return false;
      if (!kw) return true;
      return e.message.toLowerCase().includes(kw) || (e.scope?.toLowerCase().includes(kw) ?? false);
    });
  });

  // === Internal ===
  const roomService = createDoRoomService();
  let session: RoomSession | null = null;
  let localMedia: { stream: MediaStream; stop: () => void } | null = null;
  let screenCapture: { stream: MediaStream; stop: () => void } | null = null;
  let publishedTracks = new Map<string, TrackPublication>();
  let subs: (() => void)[] = [];

  // ---- logging helper ----
  function log(level: LogLevel, scope: string, message: string, data?: unknown): void {
    logs.value = [...logs.value, createLogEntry({ level, scope, message, data })].slice(-LOG_CAP);
  }

  function iceServers(): RTCIceServer[] {
    const parsed = parseIceServersInput(iceServersText.value);
    return parsed ?? DEFAULT_ICE_SERVERS;
  }

  // ---- subscribe to session events ----
  function wireSession(s: RoomSession): void {
    subs = [
      s.onConnectionStateChanged((state: ConnectionState) => {
        connected.value = state === "connected" || state === "reconnecting";
        log("info", "session", `连接状态: ${state}`);
      }),

      s.onParticipantJoined((p) => {
        log("info", "room", `参与者加入: ${p.id.slice(0, 8)}…`);
      }),

      s.onParticipantLeft((p) => {
        log("info", "room", `参与者离开: ${p.id.slice(0, 8)}…`);
        const next = new Map(remoteStreams.value);
        next.delete(p.id);
        remoteStreams.value = next;
      }),

      s.onTrackSubscribed((track, participant) => {
        log("info", "media", `收到 ${participant.id.slice(0, 8)}… 的 ${track.kind} 轨道`);
        if (track.track) {
          const ms = new MediaStream([track.track]);
          const next = new Map(remoteStreams.value);
          next.set(participant.id, ms);
          remoteStreams.value = next;
        }
      }),

      s.onTrackUnsubscribed((track, participant) => {
        log("info", "media", `${participant.id.slice(0, 8)}… 的 ${track.kind} 轨道已移除`);
      }),
    ];
  }

  // ---- actions ----
  async function connect(): Promise<void> {
    const rid = roomId.value.trim();
    if (!rid) {
      log("error", "room", "请填写房间 ID");
      return;
    }

    // 1. Capture local media for preview
    if (useCamera.value || useMic.value) {
      try {
        localMedia = await captureUserMedia(useMic.value, useCamera.value);
        localStream.value = localMedia.stream;
      } catch (e) {
        log("error", "media", "媒体捕获失败", e);
      }
    }

    // 2. Join room (RoomService 自动连接信令)
    log("info", "session", `加入房间 ${rid}`);
    try {
      const result = await roomService.joinRoom(
        { id: localPeerId.value, name: localPeerId.value },
        { roomId: rid, iceServers: iceServers() },
      );
      session = result.session;
      wireSession(session);
      log("info", "session", "已加入房间");

      // 3. Publish local tracks
      if (localMedia) {
        for (const t of localMedia.stream.getTracks()) {
          const pub = await session.publishTrack(t);
          publishedTracks.set(t.id, pub);
        }
      }

      connected.value = true;
    } catch (e) {
      log("error", "session", "加入房间失败", e);
      if (localMedia) {
        localMedia.stop();
        localMedia = null;
        localStream.value = null;
      }
    }
  }

  function disconnect(): void {
    if (session) {
      session.disconnect();
      session = null;
    }
    subs.forEach((fn) => fn());
    subs = [];
    publishedTracks.clear();
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
    remoteStreams.value = new Map();
    peerStats.value = {};
    log("info", "room", "已断开");
  }

  async function toggleScreenShare(): Promise<void> {
    if (sharingScreen.value && screenCapture) {
      screenCapture.stop();
      screenCapture = null;
      sharingScreen.value = false;
      for (const [id, pub] of publishedTracks) {
        if (pub.source === "screen") {
          session?.unpublishTrack(pub);
          publishedTracks.delete(id);
        }
      }
      log("info", "media", "已停止屏幕共享");
      return;
    }

    if (!sharingScreen.value) {
      try {
        screenCapture = await captureDisplayMedia(true);
        sharingScreen.value = true;
        const vt = screenCapture.stream.getVideoTracks()[0];
        if (vt && session) {
          const pub = await session.publishTrack(vt);
          publishedTracks.set(vt.id, pub);
        }
        vt?.addEventListener("ended", () => {
          void toggleScreenShare();
        });
        log("info", "media", "屏幕共享中");
      } catch (e) {
        log("error", "media", "屏幕共享失败", e);
      }
    }
  }

  function regeneratePeerId(): void {
    if (connected.value) return;
    localPeerId.value = randomPeerId();
  }

  function newRoomId(): void {
    if (connected.value) return;
    roomId.value = randomRoomId();
  }

  function sendDcPing(): void {
    log("debug", "datachannel", "sendDcPing 已废弃 — RoomService 内部管理 DataChannel");
  }

  function clearLogs(): void {
    logs.value = [];
  }

  // ---- lifecycle ----
  onUnmounted(() => {
    disconnect();
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
