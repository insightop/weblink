import type { EnhancedGamepadState } from "./types";
import { globalDriverRegistry } from "../drivers/registry";

/**
 * GamepadManager — 浏览器 Gamepad API 的单例封装。
 *
 * 职责：
 * 1. 通过 requestAnimationFrame 持续轮询 getGamepads()
 * 2. 自动检测手柄连接/断开（监听 gamepadconnected / gamepaddisconnected）
 * 3. 对每个手柄自动匹配对应的 Driver，并计算 mapped 视图
 * 4. 提供事件订阅和当前状态快照
 */
export class GamepadManager {
  private state: Map<number, EnhancedGamepadState> = new Map();
  private listeners: Set<(state: Map<number, EnhancedGamepadState>) => void> = new Set();
  private rafId: number | null = null;
  private polling = false;

  /** 浏览器是否支持 Gamepad API */
  static supported(): boolean {
    return typeof navigator !== "undefined" && "getGamepads" in navigator;
  }

  /** 获取单手柄状态 */
  getState(index: number): EnhancedGamepadState | undefined {
    return this.state.get(index);
  }

  /** 获取所有手柄状态 */
  getAllStates(): Map<number, EnhancedGamepadState> {
    return new Map(this.state);
  }

  /** 订阅状态变更 */
  subscribe(cb: (state: Map<number, EnhancedGamepadState>) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** 开始轮询 */
  start(): void {
    if (this.polling) return;
    this.polling = true;
    if (typeof window !== "undefined") {
      this.bindEvents();
    }
    this.tick();
  }

  /** 停止轮询 */
  stop(): void {
    this.polling = false;
    if (typeof window !== "undefined") {
      this.unbindEvents();
    }
    if (this.rafId !== null) {
      globalThis.cancelAnimationFrame?.(this.rafId);
      this.rafId = null;
    }
  }

  // ── private ──

  private handleConnect = () => {
    this.pollNow();
  };

  private handleDisconnect = (e: GamepadEvent) => {
    this.state.delete(e.gamepad.index);
    this.notify();
  };

  private bindEvents(): void {
    window.addEventListener("gamepadconnected", this.handleConnect);
    window.addEventListener("gamepaddisconnected", this.handleDisconnect);
  }

  private unbindEvents(): void {
    window.removeEventListener("gamepadconnected", this.handleConnect);
    window.removeEventListener("gamepaddisconnected", this.handleDisconnect);
  }

  private tick = (): void => {
    if (!this.polling) return;
    this.pollNow();
    this.rafId = globalThis.requestAnimationFrame?.(this.tick) ?? null;
  };

  private pollNow(): void {
    const raw = navigator.getGamepads();
    let changed = false;

    for (let i = 0; i < raw.length; i++) {
      const gp = raw[i];
      if (!gp || !gp.connected) {
        if (this.state.has(i)) {
          this.state.delete(i);
          changed = true;
        }
        continue;
      }

      const driver = globalDriverRegistry.detect(gp);
      const mappedButtons: Record<string, number> = {};
      const mappedAxes: Record<string, number> = {};

      for (let bi = 0; bi < gp.buttons.length; bi++) {
        const meta = driver?.mapButton(bi);
        if (meta) mappedButtons[meta.name] = gp.buttons[bi].value;
      }
      for (let ai = 0; ai < gp.axes.length; ai++) {
        const meta = driver?.mapAxis(ai);
        if (meta) mappedAxes[meta.name] = gp.axes[ai];
      }

      const enhanced: EnhancedGamepadState = {
        index: gp.index,
        id: gp.id,
        mapping: gp.mapping,
        connected: gp.connected,
        timestamp: gp.timestamp,
        driverId: driver?.id ?? "unknown",
        raw: {
          buttons: gp.buttons,
          axes: gp.axes,
        },
        mapped: {
          buttons: mappedButtons,
          axes: mappedAxes,
        },
      };

      const prev = this.state.get(i);
      if (!prev || hasChanged(prev, enhanced)) {
        this.state.set(i, enhanced);
        changed = true;
      }
    }

    if (changed) this.notify();
  }

  private notify(): void {
    const snapshot = this.getAllStates();
    for (const cb of this.listeners) {
      cb(snapshot);
    }
  }
}

function hasChanged(a: EnhancedGamepadState, b: EnhancedGamepadState): boolean {
  if (a.connected !== b.connected || a.driverId !== b.driverId) return true;
  // 只对比 mapped 值判断是否变化，避免每次 RAF 都触发不必要的重渲染
  return JSON.stringify(a.mapped) !== JSON.stringify(b.mapped);
}

/** 全局单例 */
export const gamepadManager = new GamepadManager();
