/**
 * 将 DOMException / Error 转为面向用户的简短说明。
 */
export function mapMediaError(err: unknown): string {
  if (!(err instanceof DOMException) && !(err instanceof Error)) {
    return String(err);
  }
  const name = "name" in err ? err.name : "";
  switch (name) {
    case "NotAllowedError":
      return "已拒绝权限。请在浏览器地址栏允许摄像头/麦克风访问。";
    case "NotFoundError":
      return "未找到指定设备，请检查是否已连接或被占用。";
    case "NotReadableError":
      return "设备被占用或无法打开，请关闭其他使用该设备的应用。";
    case "OverconstrainedError":
      return "无法满足所选约束（分辨率/设备等），请尝试其他设备。";
    case "AbortError":
      return "操作已中止。";
    case "SecurityError":
      return "安全限制：请在 HTTPS 或 localhost 下使用。";
    default:
      return err.message || name || "未知错误";
  }
}
