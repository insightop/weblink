/**
 * 创建 AudioContext（在用户手势后调用以避免自动播放策略问题）。
 */
export function createAudioContext(): AudioContext {
  return new AudioContext();
}
