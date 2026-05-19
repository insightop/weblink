/**
 * NMEA 解析与格式化模块
 * 封装 nmea-simple 库，提供统一的解析和中文友好展示接口
 */

// 浏览器工程化（Vite）下可直接 import；仍保留 fallback 解析兜底。
import * as nmeaSimple from "nmea-simple";
import {
  getGsaSystemId,
  gsaTierFromSentences,
  rmcTierFromSentence,
  ggaTierFromSentence,
  gsvSignalTierFromMetrics,
} from "../modules/nmeaSignalTier.js";

export { gsvSignalTierFromMetrics } from "../modules/nmeaSignalTier.js";

/**
 * NMEA 0183：校验 $ 与 * 之间各字节 XOR 是否等于 * 后两位十六进制。
 * @param {string} line - 单句，可含末尾 \\r
 */
export function isNmeaChecksumValid(line) {
  const s = line.replace(/\r?\n$/, "").trimEnd();
  if (!s.startsWith("$")) return false;
  const star = s.indexOf("*");
  if (star < 2 || star + 3 > s.length) return false;
  const hex = s.slice(star + 1, star + 3);
  if (!/^[0-9A-Fa-f]{2}$/.test(hex)) return false;
  let xor = 0;
  for (let i = 1; i < star; i++) xor ^= s.charCodeAt(i);
  return xor === parseInt(hex, 16);
}

/**
 * 解析固件返回的 nmea 字段（可能包含 \n 分隔的多句）
 * @param {string} raw - 原始 NMEA 字符串，多句用 \n 分隔
 * @returns {{ type: string, sentences: object[], raw: string, checksumRejected: string[] }}
 */
export function parseNmeaMessage(raw) {
  const empty = { type: "unknown", sentences: [], raw: raw || "", checksumRejected: [] };
  if (!raw || !raw.trim()) {
    return { ...empty, raw: "" };
  }

  const rawLines = raw.split("\n").filter((l) => l.startsWith("$"));
  if (rawLines.length === 0) {
    return { type: "unknown", sentences: [], raw, checksumRejected: [] };
  }

  /** @type {string[]} */
  const checksumRejected = [];
  /** @type {string[]} */
  const validLines = [];
  for (const line of rawLines) {
    const normalized = line.replace(/\r$/, "").trimEnd();
    if (!isNmeaChecksumValid(normalized)) {
      checksumRejected.push(normalized);
      continue;
    }
    validLines.push(normalized);
  }

  if (validLines.length === 0) {
    return { type: "unknown", sentences: [], raw, checksumRejected };
  }

  const type = detectNmeaType(validLines[0]);
  const sentences = validLines.map((l) => parseOneLine(l));

  return { type, sentences, raw, checksumRejected };
}

/**
 * 从 NMEA 句子前缀推断类型 key
 */
function detectNmeaType(sentence) {
  if (!sentence || sentence.length < 6) return "unknown";
  const id = sentence.substring(1, 6).toUpperCase();
  const map = {
    GNRMC: "gnrmc",
    GNGGA: "gngga",
    GNGSA: "gngsa",
    GPGSV: "gpgsv",
    GBGSV: "gbgsv",
    GAGSV: "gagsv",
    GLGSV: "glgsv",
    GNGSV: "gngsv",
    GQGSV: "gqgsv",
  };
  return map[id] || "unknown";
}

/**
 * 简易回退解析（当 nmea-simple 不可用时）
 */
function fallbackParse(line) {
  const parts = line.replace(/\*[0-9A-Fa-f]{2}$/, "").split(",");
  return {
    sentenceId: parts[0]?.substring(1) || "",
    fields: parts.slice(1),
    _raw: line,
  };
}

/**
 * nmea-simple 的 `parseNmeaSentence` 对 GSA/GSV 等句型会直接判为 invalid。
 * 这里优先使用 `parseUnsafeNmeaSentence`，再叠加 fallback 字段，保证 formatter 可用。
 * @param {string} line
 */
function parseOneLine(line) {
  const fallback = fallbackParse(line.replace(/\r$/, ""));
  try {
    const unsafe = nmeaSimple.parseUnsafeNmeaSentence(line);
    return { ...unsafe, ...fallback };
  } catch {
    return fallback;
  }
}

/**
 * 将解析结果转为中文友好的键值对数组，供面板渲染
 * @param {string} type - gnrmc/gngga/gngsa/gpgsv/gbgsv/gagsv/glgsv/gngsv/gqgsv
 * @param {object[]} sentences - parseNmeaMessage 返回的 sentences
 * @returns {{ rows: Array<{label:string, value:string, tooltip?: string}>, summary: string, signalTier?: 'green'|'blue'|'yellow'|'red'|null, gsv?: { validCount: number, visibleCount: number, avgSnr: number, tier: 'green'|'blue'|'yellow'|'red' } }}
 */
export function formatNmeaForDisplay(type, sentences) {
  if (!sentences || sentences.length === 0) {
    return {
      rows: [{ label: "状态", value: "无数据" }],
      summary: "无数据",
      signalTier: null,
    };
  }

  switch (type) {
    case "gnrmc":
      return formatRmc(sentences[0]);
    case "gngga":
      return formatGga(sentences[0]);
    case "gngsa":
      return formatGsa(sentences);
    case "gpgsv":
      return formatGsv(sentences);
    case "gbgsv":
      return formatGsv(sentences);
    case "gagsv":
      return formatGsv(sentences);
    case "glgsv":
      return formatGsv(sentences);
    case "gngsv":
      return formatGsv(sentences);
    case "gqgsv":
      return formatGsv(sentences);
    default:
      return {
        rows: [{ label: "原始", value: sentences[0]?._raw || "--" }],
        summary: "未知类型",
        signalTier: null,
      };
  }
}

function fmt(v, digits = 6) {
  if (v == null || v === "" || isNaN(v)) return "--";
  return Number(v).toFixed(digits);
}

function dmmToDecimal(dmmStr, dir) {
  if (!dmmStr) return "--";
  const v = parseFloat(dmmStr);
  if (isNaN(v)) return "--";
  const deg = Math.floor(v / 100);
  const min = v - deg * 100;
  let dec = deg + min / 60;
  if (dir === "S" || dir === "W") dec = -dec;
  return dec.toFixed(6) + "°";
}

function formatRmc(s) {
  const isLib = !!s.datetime;
  let rows;
  if (isLib) {
    const statusText = s.status === "valid" ? "有效定位(A)" : "无效(V)";
    const utc = s.datetime ? new Date(s.datetime).toISOString().substring(11, 19) : "--";
    rows = [
      { label: "UTC 时间", value: utc },
      { label: "定位状态", value: statusText },
      {
        label: "纬度",
        value: s.latitude != null ? fmt(s.latitude) + "°" : "--",
      },
      {
        label: "经度",
        value: s.longitude != null ? fmt(s.longitude) + "°" : "--",
      },
      {
        label: "速度",
        value:
          s.speedKnots != null
            ? `${fmt(s.speedKnots, 1)} 节 (${fmt(s.speedKnots * 1.852, 1)} km/h)`
            : "--",
      },
      {
        label: "航向",
        value: s.trackTrue != null ? fmt(s.trackTrue, 1) + "°" : "--",
      },
      {
        label: "日期",
        value: s.datetime ? new Date(s.datetime).toISOString().substring(0, 10) : "--",
      },
    ];
    const statusShort = s.status === "valid" ? "有效" : "无效";
    const summary = `${statusShort} | ${s.latitude != null ? fmt(s.latitude, 4) : "--"}°, ${s.longitude != null ? fmt(s.longitude, 4) : "--"}°`;
    return { rows, summary, signalTier: rmcTierFromSentence(s) };
  }
  const f = s.fields || [];
  const statusText = f[1] === "A" ? "有效定位(A)" : "无效(V)";
  const utcRaw = f[0] || "--";
  const utc =
    utcRaw.length >= 6
      ? `${utcRaw.slice(0, 2)}:${utcRaw.slice(2, 4)}:${utcRaw.slice(4, 6)}`
      : utcRaw;
  rows = [
    { label: "UTC 时间", value: utc },
    { label: "定位状态", value: statusText },
    { label: "纬度", value: dmmToDecimal(f[2], f[3]) },
    { label: "经度", value: dmmToDecimal(f[4], f[5]) },
    { label: "速度", value: f[6] ? `${f[6]} 节` : "--" },
    { label: "航向", value: f[7] || "--" },
    {
      label: "日期",
      value: f[8]
        ? `${f[8].slice(0, 2)}/${f[8].slice(2, 4)}/20${f[8].slice(4, 6)}`
        : "--",
    },
  ];
  const statusShort = f[1] === "A" ? "有效" : "无效";
  return {
    rows,
    summary: `${statusShort} | ${dmmToDecimal(f[2], f[3])}, ${dmmToDecimal(f[4], f[5])}`,
    signalTier: rmcTierFromSentence(s),
  };
}

/* GNGGA is fused fix (GPS+BDS etc.); label fix quality as fusion, not GPS-only */
const GGA_FIX_LABELS_LIB = {
  none: "无效(0)",
  fix: "融合定位(1)",
  "dgps-fix": "DGPS(2)",
  "pps-fix": "PPS(3)",
  "rtk-fixed": "RTK(4)",
  "rtk-float": "RTK浮点(5)",
  estimated: "估算(6)",
};
const GGA_FIX_MAP_RAW = {
  0: "无效(0)",
  1: "融合定位(1)",
  2: "DGPS(2)",
  4: "RTK(4)",
  5: "RTK浮点(5)",
};

function formatGga(s) {
  const isLib = s.fixType !== undefined;
  if (isLib) {
    const fixLabels = GGA_FIX_LABELS_LIB;
    const utc = s.time ? new Date(s.time).toISOString().substring(11, 19) : "--";
    const rows = [
      { label: "UTC 时间", value: utc },
      {
        label: "纬度",
        value: s.latitude != null ? fmt(s.latitude) + "°" : "--",
      },
      {
        label: "经度",
        value: s.longitude != null ? fmt(s.longitude) + "°" : "--",
      },
      { label: "定位质量", value: fixLabels[s.fixType] || String(s.fixType) },
      {
        label: "使用卫星数",
        value: s.satellitesInView != null ? String(s.satellitesInView) : "--",
      },
      {
        label: "HDOP",
        value: s.horizontalDilution != null ? fmt(s.horizontalDilution, 2) : "--",
      },
      {
        label: "海拔",
        value: s.altitudeMeters != null ? fmt(s.altitudeMeters, 1) + " m" : "--",
      },
      {
        label: "大地水准面差",
        value: s.geoidalSeperation != null ? fmt(s.geoidalSeperation, 1) + " m" : "--",
      },
    ];
    const summary = `${fixLabels[s.fixType] || s.fixType} | ${s.satellitesInView ?? "--"} | ${s.altitudeMeters != null ? fmt(s.altitudeMeters, 1) + "m" : "--"}`;
    return { rows, summary, signalTier: ggaTierFromSentence(s) };
  }
  const f = s.fields || [];
  const fixMap = GGA_FIX_MAP_RAW;
  const rows = [
    {
      label: "UTC 时间",
      value:
        f[0]?.length >= 6
          ? `${f[0].slice(0, 2)}:${f[0].slice(2, 4)}:${f[0].slice(4, 6)}`
          : "--",
    },
    { label: "纬度", value: dmmToDecimal(f[1], f[2]) },
    { label: "经度", value: dmmToDecimal(f[3], f[4]) },
    { label: "定位质量", value: fixMap[f[5]] || f[5] || "--" },
    { label: "使用卫星数", value: f[6] || "--" },
    { label: "HDOP", value: f[7] || "--" },
    { label: "海拔", value: f[8] ? `${f[8]} m` : "--" },
    { label: "大地水准面差", value: f[10] ? `${f[10]} m` : "--" },
  ];
  return {
    rows,
    summary: `${fixMap[f[5]] || "--"} | ${f[6] || "--"} | ${f[8] ? `${f[8]}m` : "--"}`,
    signalTier: ggaTierFromSentence(s),
  };
}

/** Output order for system IDs: GPS, GLONASS, Galileo, BDS */
const GSA_SYSID_ORDER = [1, 2, 3, 4];

const GSA_TOOLTIP_PDOP =
  "PDOP（Position DOP）：位置精度衰减因子，无量纲。数值越小，可见卫星的空间几何分布越好，定位精度越有保障。";
const GSA_TOOLTIP_HDOP =
  "HDOP（Horizontal DOP）：水平精度衰减因子，无量纲。数值越小，水平方向精度因子越好。";
const GSA_TOOLTIP_VDOP =
  "VDOP（Vertical DOP）：垂直精度衰减因子，无量纲。数值越小，高程方向精度因子越好。";

function formatGsaDopLib(v) {
  if (v == null || Number.isNaN(v)) return "--";
  return fmt(v, 2);
}

function formatGsaDopRaw(field) {
  if (field == null || field === "" || String(field).trim() === "") return "--";
  return String(field).trim();
}

function formatGsa(sentences) {
  const bySysId = {};
  for (const s of sentences) {
    const sysId = getGsaSystemId(s);
    const key = sysId >= 1 && sysId <= 4 ? sysId : 0;
    if (!bySysId[key]) bySysId[key] = [];
    bySysId[key].push(s);
  }

  const allRows = [];
  const summaryParts = [];
  const modeLabels = { manual: "手动(M)", automatic: "自动(A)" };
  const fixLabels = { 1: "无定位", 2: "2D定位", 3: "3D定位" };
  const fixMap = { 1: "无定位", 2: "2D定位", 3: "3D定位" };
  const modeMap = { M: "手动(M)", A: "自动(A)" };

  for (const sysId of GSA_SYSID_ORDER) {
    const group = bySysId[sysId];
    if (!group || group.length === 0) continue;
    const s = group[0];
    const sysLabel = sysIdLabel(String(sysId));
    const prefix = Object.keys(bySysId).length > 1 ? `${sysLabel} · ` : "";

    const isLib = s.mode !== undefined && s.fixType !== undefined;
    if (isLib) {
      const prns = (s.satellites || []).join(",") || "--";
      allRows.push(
        { label: `${prefix}定位模式`, value: modeLabels[s.mode] || s.mode },
        {
          label: `${prefix}定位类型`,
          value: fixLabels[s.fixType] || String(s.fixType),
        },
        { label: `${prefix}PRN`, value: prns },
        {
          label: `${prefix}PDOP`,
          value: formatGsaDopLib(s.PDOP),
          tooltip: GSA_TOOLTIP_PDOP,
        },
        {
          label: `${prefix}HDOP`,
          value: formatGsaDopLib(s.HDOP),
          tooltip: GSA_TOOLTIP_HDOP,
        },
        {
          label: `${prefix}VDOP`,
          value: formatGsaDopLib(s.VDOP),
          tooltip: GSA_TOOLTIP_VDOP,
        },
      );
      summaryParts.push(`${sysLabel}:${fixLabels[s.fixType] || "--"}`);
    } else {
      const f = s.fields || [];
      const prns = f.slice(2, 14).filter(Boolean).join(",") || "--";
      allRows.push(
        { label: `${prefix}定位模式`, value: modeMap[f[0]] || f[0] || "--" },
        { label: `${prefix}定位类型`, value: fixMap[f[1]] || f[1] || "--" },
        { label: `${prefix}PRN`, value: prns },
        {
          label: `${prefix}PDOP`,
          value: formatGsaDopRaw(f[14]),
          tooltip: GSA_TOOLTIP_PDOP,
        },
        {
          label: `${prefix}HDOP`,
          value: formatGsaDopRaw(f[15]),
          tooltip: GSA_TOOLTIP_HDOP,
        },
        {
          label: `${prefix}VDOP`,
          value: formatGsaDopRaw(f[16]),
          tooltip: GSA_TOOLTIP_VDOP,
        },
      );
      summaryParts.push(`${sysLabel}:${fixMap[f[1]] || "--"}`);
    }
  }

  if (bySysId[0] && bySysId[0].length > 0) {
    const s = bySysId[0][0];
    const prefix = "其他 · ";
    const isLib = s.mode !== undefined && s.fixType !== undefined;
    if (isLib) {
      const prns = (s.satellites || []).join(",") || "--";
      allRows.push(
        { label: `${prefix}定位模式`, value: modeLabels[s.mode] || s.mode },
        {
          label: `${prefix}定位类型`,
          value: fixLabels[s.fixType] || String(s.fixType),
        },
        { label: `${prefix}PRN`, value: prns },
        {
          label: `${prefix}PDOP`,
          value: formatGsaDopLib(s.PDOP),
          tooltip: GSA_TOOLTIP_PDOP,
        },
        {
          label: `${prefix}HDOP`,
          value: formatGsaDopLib(s.HDOP),
          tooltip: GSA_TOOLTIP_HDOP,
        },
        {
          label: `${prefix}VDOP`,
          value: formatGsaDopLib(s.VDOP),
          tooltip: GSA_TOOLTIP_VDOP,
        },
      );
      summaryParts.push(fixLabels[s.fixType] || "--");
    } else {
      const f = s.fields || [];
      const prns = f.slice(2, 14).filter(Boolean).join(",") || "--";
      allRows.push(
        { label: `${prefix}定位模式`, value: modeMap[f[0]] || f[0] || "--" },
        { label: `${prefix}定位类型`, value: fixMap[f[1]] || f[1] || "--" },
        { label: `${prefix}PRN`, value: prns },
        {
          label: `${prefix}PDOP`,
          value: formatGsaDopRaw(f[14]),
          tooltip: GSA_TOOLTIP_PDOP,
        },
        {
          label: `${prefix}HDOP`,
          value: formatGsaDopRaw(f[15]),
          tooltip: GSA_TOOLTIP_HDOP,
        },
        {
          label: `${prefix}VDOP`,
          value: formatGsaDopRaw(f[16]),
          tooltip: GSA_TOOLTIP_VDOP,
        },
      );
      summaryParts.push(fixMap[f[1]] || "--");
    }
  }

  if (allRows.length === 0) {
    return {
      rows: [{ label: "状态", value: "无数据" }],
      summary: "无数据",
      signalTier: null,
    };
  }

  let summary;
  if (summaryParts.length === 1) {
    const p = summaryParts[0];
    summary = p.startsWith("其他") ? p : p.includes(":") ? p.slice(p.indexOf(":") + 1) : p;
  } else {
    summary = summaryParts.join(" · ");
  }
  return {
    rows: allRows,
    summary,
    signalTier: gsaTierFromSentences(sentences),
  };
}

/** GNGSA 多系统时的星座/体制标识（与 NMEA 惯例一致） */
function sysIdLabel(id) {
  const map = { 1: "GPS", 2: "GLONASS", 3: "Galileo", 4: "BDS" };
  return map[String(id)] || `ID:${id}`;
}

/** 与诊断面板、GNSS 页共用的 GSV 句型集合 */
export const GSV_NMEA_TYPES = new Set([
  "gpgsv",
  "gbgsv",
  "gagsv",
  "glgsv",
  "gngsv",
  "gqgsv",
]);

/** 典型 C/N0 上限约 50dB-Hz 量级；明显超出视为截断/字段错位，避免显示成「26199dB」 */
const GSV_SNR_SANITY_MAX = 55;

const GSV_SNR_INVALID_DISPLAY = "--dB";

/** 仰角 0–90°：固定 2 位前导零（与 NMEA 常见字段一致） */
function fmtGsvElev(v) {
  if (v == null || v === "" || v === "--") return "--";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  const i = Math.round(n);
  if (i < 0 || i > 90) return String(v);
  return String(i).padStart(2, "0");
}

/** 方位角 0–359°：固定 3 位前导零 */
function fmtGsvAzim(v) {
  if (v == null || v === "" || v === "--") return "---";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  let i = Math.round(n) % 360;
  if (i < 0) i += 360;
  return String(i).padStart(3, "0");
}

/** GSV 单行 C/N0（SNR）；无效也带 dB 后缀便于列对齐 */
function fmtGsvSnr(v) {
  if (v == null || v === "" || v === "--") return GSV_SNR_INVALID_DISPLAY;
  const n = Number(v);
  if (!Number.isFinite(n)) return GSV_SNR_INVALID_DISPLAY;
  if (n > GSV_SNR_SANITY_MAX) return GSV_SNR_INVALID_DISPLAY;
  if (n <= 0) return GSV_SNR_INVALID_DISPLAY;
  return Number.isInteger(n) ? `${n}dB` : `${n.toFixed(1)}dB`;
}

/**
 * 从 parseOneLine 的 fields（已去掉句首 $XXGSV，f[0]=总段数,f[1]=段号,f[2]=可视星数,f[3]起为卫星四元组）解析各卫星行
 * @param {string[]} f
 * @returns {Array<{prn: string, elev: string, azim: string, snr: string}>}
 */
function gsvSatsFromFields(f) {
  const out = [];
  if (!Array.isArray(f) || f.length < 4) return out;
  for (let i = 3; i + 3 < f.length; i += 4) {
    if (!f[i]) continue;
    out.push({
      prn: f[i],
      elev: f[i + 1] || "--",
      azim: f[i + 2] || "--",
      snr: f[i + 3] || "--",
    });
  }
  return out;
}

/**
 * G*GSV：句型已区分星座；「可见」取 NMEA 报告的在视场星数。
 * 「有效（用于计数与均值）」：C/N0 为有限数值且 >0（0、空、非数值均不算）。
 * 均值：仅这些「有效且非零」参与；若无任一（全 0、部分 0 部分无效、全无效、无 PRN）则均值为 0。
 */
function formatGsv(sentences) {
  const allSats = [];
  let totalSats = "--";
  for (const s of sentences) {
    const f = s.fields;
    if (Array.isArray(f) && f.length >= 4) {
      if (totalSats === "--" && f[2]) totalSats = f[2];
      for (const row of gsvSatsFromFields(f)) {
        allSats.push(row);
      }
      continue;
    }
    const isLib = s.satellites !== undefined;
    if (isLib) {
      totalSats = s.satellitesInView ?? s.totalNumberOfSatellitesInView ?? totalSats;
      for (const sat of s.satellites || []) {
        allSats.push({
          prn: sat.prnNumber,
          elev: sat.elevationDegrees,
          azim: sat.azimuthTrue,
          snr: sat.SNRdB,
        });
      }
    }
  }

  // 过滤掉 nmea-simple 在 parseUnsafe 下可能产生的“占位卫星”（PRN=0 或 NaN）
  const filteredSats = allSats.filter((s) => {
    const prn = Number(s.prn);
    return Number.isFinite(prn) && prn > 0;
  });

  // 有效：C/N0（SNR）为数值且 >0；可见数取 NMEA 本句型报告的在视星数
  const validSats = filteredSats.filter((s) => {
    const n = Number(s.snr);
    return (
      Number.isFinite(n) && n > 0 && n <= GSV_SNR_SANITY_MAX
    );
  });
  const validCount = validSats.length;
  const totalStr =
    totalSats !== "--" && totalSats != null && String(totalSats).trim() !== ""
      ? String(totalSats)
      : "--";
  const ratio = `${validCount}/${totalStr}`;

  let avgSnrNum;
  let avgSnrStr;
  if (validSats.length > 0) {
    const sum = validSats.reduce((acc, s) => acc + Number(s.snr), 0);
    avgSnrNum = sum / validSats.length;
    avgSnrStr = avgSnrNum.toFixed(1);
  } else {
    avgSnrNum = 0;
    avgSnrStr = "0.0";
  }

  const visibleParsed = parseInt(String(totalStr), 10);
  const visibleCount = Number.isFinite(visibleParsed)
    ? visibleParsed
    : filteredSats.length;

  const tier = gsvSignalTierFromMetrics(validCount, avgSnrNum);

  const rows = [{ label: "卫星（有效/可见）", value: ratio }];
  for (const sat of filteredSats) {
    rows.push({
      label: `PRN ${sat.prn}`,
      value: `${fmtGsvElev(sat.elev)}°/${fmtGsvAzim(sat.azim)}°/${fmtGsvSnr(sat.snr)}`,
    });
  }

  const summary = `${ratio} · ${avgSnrStr}dB`;
  return {
    rows,
    summary,
    signalTier: tier,
    gsv: {
      validCount,
      visibleCount,
      avgSnr: avgSnrNum,
      tier,
    },
  };
}
