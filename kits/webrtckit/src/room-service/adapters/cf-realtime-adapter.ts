import type { RoomService, ParticipantInfo, JoinOptions, JoinResult } from "../types"
import { RoomError, ErrorCode } from "../errors"

/**
 * Cloudflare Realtime SFU adapter 预留骨架。
 *
 * 当前状态：**预留（预留）** — 尚无实际使用场景，计划待有需求时实现
 * WHIP/WHEP 协议流程。
 *
 * 实现数据通道的占位 RETURN 在此列：
 * - sendData: N/A（未实现前抛出 NotSupported）
 * - onDataReceived: N/A（未实现前抛出 NotSupported）
 */
export class CfRealtimeRoomService implements RoomService {
  async joinRoom(_participant: ParticipantInfo, _options?: JoinOptions): Promise<JoinResult> {
    throw new RoomError(ErrorCode.NotSupported, "CF Realtime SFU adapter not yet implemented")
  }
}
