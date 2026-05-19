function formatMs(ms: number, opts: { alwaysHours?: boolean } = {}): string {
  const sign = ms < 0 ? '-' : ''
  const totalSeconds = Math.floor(Math.abs(ms) / 1000)

  const s = totalSeconds % 60
  const m = Math.floor(totalSeconds / 60) % 60
  const h = Math.floor(totalSeconds / 3600)

  const pad2 = (n: number) => n.toString().padStart(2, '0')

  if (opts.alwaysHours || h > 0) {
    return `${sign}${h}:${pad2(m)}:${pad2(s)}` // h:mm:ss (hours can be 1+ digits)
  }
  return `${sign}${pad2(m)}:${pad2(s)}` // mm:ss
}
function debounce<T extends (...a: any[]) => void>(fn: T, ms = 200) {
  let t: any
  return (...a: Parameters<T>) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...a), ms)
  }
}

const hasProp = <T extends object, K extends PropertyKey>(
  obj: T,
  prop: K,
): obj is T & Record<K, unknown> => {
  return Object.prototype.hasOwnProperty.call(obj, prop)
}
export { formatMs, debounce, hasProp }
