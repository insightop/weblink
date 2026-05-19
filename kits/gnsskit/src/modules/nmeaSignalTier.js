// @ts-check

/**
 * NMEA 诊断图标档位（纯函数，零 DOM）
 * @typedef {'green'|'blue'|'yellow'|'red'} NmeaSignalTier
 */

/** 数值越小越差，用于多系统 GSA 合并 */
const TIER_RANK = /** @type {const} */ ({
  red: 0,
  yellow: 1,
  blue: 2,
  green: 3,
});

/**
 * @param {NmeaSignalTier[]} tiers
 * @returns {NmeaSignalTier | null}
 */
export function worstNmeaSignalTier(tiers) {
  const list = tiers.filter(
    (t) => t === "green" || t === "blue" || t === "yellow" || t === "red",
  );
  if (list.length === 0) return null;
  return list.reduce((worst, t) =>
    TIER_RANK[t] < TIER_RANK[worst] ? t : worst,
  );
}

/**
 * GSA 句中 systemId（NMEA 4.x 末字段）或 0
 * @param {any} s
 * @returns {number}
 */
export function getGsaSystemId(s) {
  if (s.systemId != null) return Number(s.systemId);
  const f = s.fields || [];
  if (f.length > 17 && f[17]) {
    const n = parseInt(f[17], 10);
    if (n >= 1 && n <= 4) return n;
  }
  return 0;
}

/**
 * GSA fix 1/2/3 → 档
 * @param {number} fix
 * @returns {NmeaSignalTier}
 */
export function gsaFixToTier(fix) {
  const n = Number(fix);
  if (n === 3) return "green";
  if (n === 2) return "yellow";
  return "red";
}

/**
 * @param {any[]} sentences
 * @returns {NmeaSignalTier | null}
 */
export function gsaTierFromSentences(sentences) {
  if (!sentences?.length) return null;
  const bySysId = {};
  for (const s of sentences) {
    const sysId = getGsaSystemId(s);
    const key = sysId >= 1 && sysId <= 4 ? sysId : 0;
    if (!bySysId[key]) bySysId[key] = [];
    bySysId[key].push(s);
  }

  const tiers = [];
  for (const key of [1, 2, 3, 4, 0]) {
    const group = bySysId[key];
    if (!group?.length) continue;
    const s = group[0];
    let fix;
    if (s.mode !== undefined && s.fixType !== undefined) {
      fix = s.fixType;
    } else {
      fix = parseInt(s.fields?.[1], 10);
    }
    if (!Number.isFinite(fix)) continue;
    tiers.push(gsaFixToTier(fix));
  }
  return worstNmeaSignalTier(tiers);
}

/**
 * @param {any} s
 * @returns {NmeaSignalTier}
 */
export function rmcTierFromSentence(s) {
  if (s.status === "valid") return "green";
  if (s.status === "invalid") return "red";
  const f = s.fields || [];
  return f[1] === "A" ? "green" : "red";
}

/** nmea-simple GGA fixType → 档 */
/** @type {Record<string, NmeaSignalTier>} */
const GGA_LIB_TIER = {
  none: "red",
  fix: "green",
  "dgps-fix": "blue",
  "pps-fix": "blue",
  "rtk-fixed": "green",
  "rtk-float": "yellow",
  estimated: "yellow",
};

/**
 * @param {any} s
 * @returns {NmeaSignalTier}
 */
export function ggaTierFromSentence(s) {
  if (s.fixType !== undefined) {
    return GGA_LIB_TIER[String(s.fixType)] ?? "red";
  }
  const f = s.fields || [];
  const n = parseInt(f[5], 10);
  if (!Number.isFinite(n) || n === 0) return "red";
  if (n === 1) return "green";
  if (n === 2 || n === 3) return "blue";
  if (n === 4) return "green";
  if (n === 5 || n === 6) return "yellow";
  return "red";
}

/**
 * GSV：与历史 gsvSignalTierFromMetrics 一致
 * @param {number} validCount
 * @param {number|null|undefined} avgSnr
 * @returns {NmeaSignalTier}
 */
export function gsvSignalTierFromMetrics(validCount, avgSnr) {
  if (avgSnr == null || !Number.isFinite(avgSnr)) {
    return "red";
  }
  if (validCount <= 0 || avgSnr <= 0) {
    return "red";
  }
  if (avgSnr >= 40) return "green";
  if (avgSnr >= 30) return "blue";
  if (avgSnr >= 20) return "yellow";
  return "red";
}
