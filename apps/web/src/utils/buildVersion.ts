declare const __BUILD_TIME__: string

export function formatBuildTag(date: Date): string {
  const y = String(date.getFullYear()).slice(2)
  const M = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  return `${y}${M}${d}${h}${m}`
}

const dt = new Date(__BUILD_TIME__)
export const BUILD_VERSION = formatBuildTag(dt)
export const SITE_TITLE = `Weblink(${BUILD_VERSION})`
