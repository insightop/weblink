// @ts-check

import {
  NMEA_SNAPSHOT_GSA_COALESCE_MS,
  RAW_FLUSH_INTERVAL_MS,
  RAW_LINE_MAX_LENGTH,
  RAW_MAX_LINES,
} from "./constants.js";

/**
 * 解析快照分层：内部随时累积（working），UI 只用 published。
 * - GNRMC/GNGGA：单句即完整，push 时即发布。
 * - GNGSA：多系统连续到达，静默合并结束（coalesce）时发布。
 * - G*GSV：多段收齐时发布；半组不发布，界面保持上一帧。
 */
const GSV_SNAPSHOT_TYPES = new Set([
  "gpgsv",
  "gbgsv",
  "gagsv",
  "glgsv",
  "gngsv",
  "gqgsv",
]);
import { parseNmeaMessage, formatNmeaForDisplay } from "../utils/nmea.js";

/**
 * @typedef {Object} NmeaUiBlock
 * @property {Array<{label: string, value: string}>} rows
 * @property {string} summary
 */

/**
 * @typedef {Object} PipelineUpdate
 * @property {string[]=} rawLines
 * @property {import("./state.js").getState extends any ? never : any} _unused
 * @property {any=} snapshot
 */

export function createGnssNmeaPipeline() {
  /** @type {(u: {rawLines?: Array<{id: number, tsMs: number, text: string}>, snapshot?: any}) => void} */
  let onUpdate = () => {};

  let buffer = "";
  /** @type {Array<{id: number, tsMs: number, text: string}>} */
  let rawLines = [];
  /** @type {Array<{id: number, tsMs: number, text: string}>} */
  let pendingRaw = [];
  let nextRawId = 1;

  /** @type {ReturnType<typeof setTimeout> | null} */
  let flushTimer = null;

  const snapshot = createSnapshotReducer();

  /** @type {ReturnType<typeof setTimeout> | null} */
  let gsaCoalesceTimer = null;
  function flushSnapshotToUi() {
    onUpdate({ snapshot: snapshot.toUiSnapshot() });
  }

  function scheduleGsaCoalesce() {
    if (gsaCoalesceTimer) clearTimeout(gsaCoalesceTimer);
    gsaCoalesceTimer = setTimeout(() => {
      gsaCoalesceTimer = null;
      snapshot.commitGsaPublish();
      flushSnapshotToUi();
    }, NMEA_SNAPSHOT_GSA_COALESCE_MS);
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      if (pendingRaw.length === 0) return;

      rawLines = rawLines.concat(pendingRaw);
      pendingRaw = [];
      if (rawLines.length > RAW_MAX_LINES) {
        rawLines = rawLines.slice(-RAW_MAX_LINES);
      }
      onUpdate({ rawLines });
    }, RAW_FLUSH_INTERVAL_MS);
  }

  /**
   * @param {string} chunkText
   */
  function pushChunk(chunkText) {
    if (!chunkText) return;
    buffer += chunkText;

    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      try {
        handleLine(line);
      } catch (err) {
        // 避免单条异常中断上游串口读循环
        console.error("[GNSS] handleLine 异常，已忽略:", err);
      }
    }
  }

  /**
   * @param {string} line
   */
  function handleLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("$")) return;

    const safeLine =
      trimmed.length > RAW_LINE_MAX_LENGTH
        ? trimmed.slice(0, RAW_LINE_MAX_LENGTH) + "…"
        : trimmed;

    pendingRaw.push({ id: nextRawId++, tsMs: Date.now(), text: safeLine });
    scheduleFlush();

    try {
      const parsed = parseNmeaMessage(safeLine);
      if (!parsed || parsed.type === "unknown" || parsed.sentences.length === 0) {
        return;
      }

      const sentence = parsed.sentences[0];
      const type = parsed.type;
      snapshot.push(type, sentence, safeLine);

      if (type === "gngsa") {
        scheduleGsaCoalesce();
      } else if (GSV_SNAPSHOT_TYPES.has(type)) {
        if (snapshot.isGsvGroupComplete(type)) {
          flushSnapshotToUi();
        }
      } else {
        flushSnapshotToUi();
      }
    } catch (err) {
      console.error("[GNSS] NMEA 解析/格式化异常，已忽略:", err, safeLine);
    }
  }

  /**
   * @param {(u: {rawLines?: string[], snapshot?: any}) => void} cb
   */
  function onUpdateCb(cb) {
    onUpdate = cb;
  }

  return { pushChunk, onUpdate: onUpdateCb };
}

function createSnapshotReducer() {
  /** @type {any[]} */
  let gsaSentences = [];
  /** @type {any[]} */
  let gpgsvSentences = [];
  /** @type {any[]} */
  let gbgsvSentences = [];
  /** @type {any[]} */
  let gagsvSentences = [];
  /** @type {any[]} */
  let glgsvSentences = [];
  /** @type {any[]} */
  let gngsvSentences = [];
  /** @type {any[]} */
  let gqgsvSentences = [];

  /** @type {NmeaUiBlock | null} */
  let rmc = null;
  /** @type {NmeaUiBlock | null} */
  let gga = null;
  /** @type {NmeaUiBlock | null} */
  let gsa = null;
  /** @type {NmeaUiBlock | null} */
  let gpgsv = null;
  /** @type {NmeaUiBlock | null} */
  let gbgsv = null;
  /** @type {NmeaUiBlock | null} */
  let gagsv = null;
  /** @type {NmeaUiBlock | null} */
  let glgsv = null;
  /** @type {NmeaUiBlock | null} */
  let gngsv = null;
  /** @type {NmeaUiBlock | null} */
  let gqgsv = null;

  /** @type {NmeaUiBlock | null} */
  let rmcPublished = null;
  /** @type {NmeaUiBlock | null} */
  let ggaPublished = null;
  /** @type {NmeaUiBlock | null} */
  let gsaPublished = null;

  /** 仅在本组 GSV 收齐时更新 */
  /** @type {NmeaUiBlock | null} */
  let gpgsvPublished = null;
  /** @type {NmeaUiBlock | null} */
  let gbgsvPublished = null;
  /** @type {NmeaUiBlock | null} */
  let gagsvPublished = null;
  /** @type {NmeaUiBlock | null} */
  let glgsvPublished = null;
  /** @type {NmeaUiBlock | null} */
  let gngsvPublished = null;
  /** @type {NmeaUiBlock | null} */
  let gqgsvPublished = null;

  let updatedAtMs = 0;

  /**
   * @param {string} type
   * @param {any} sentence
   * @param {string} _rawLine
   */
  function push(type, sentence, _rawLine) {
    updatedAtMs = Date.now();

    if (type === "gnrmc") {
      rmc = formatNmeaForDisplay("gnrmc", [sentence]);
      rmcPublished = rmc;
      return;
    }
    if (type === "gngga") {
      gga = formatNmeaForDisplay("gngga", [sentence]);
      ggaPublished = gga;
      return;
    }
    if (type === "gngsa") {
      gsaSentences = gsaSentences.concat([sentence]).slice(-12);
      gsa = formatNmeaForDisplay("gngsa", gsaSentences);
      return;
    }

    if (type === "gpgsv") {
      gpgsvSentences = accumulateGsv(gpgsvSentences, sentence);
      gpgsv = formatNmeaForDisplay("gpgsv", gpgsvSentences);
      if (isGsvSentenceArrayComplete(gpgsvSentences)) gpgsvPublished = gpgsv;
      return;
    }
    if (type === "gbgsv") {
      gbgsvSentences = accumulateGsv(gbgsvSentences, sentence);
      gbgsv = formatNmeaForDisplay("gbgsv", gbgsvSentences);
      if (isGsvSentenceArrayComplete(gbgsvSentences)) gbgsvPublished = gbgsv;
      return;
    }
    if (type === "gagsv") {
      gagsvSentences = accumulateGsv(gagsvSentences, sentence);
      gagsv = formatNmeaForDisplay("gagsv", gagsvSentences);
      if (isGsvSentenceArrayComplete(gagsvSentences)) gagsvPublished = gagsv;
      return;
    }
    if (type === "glgsv") {
      glgsvSentences = accumulateGsv(glgsvSentences, sentence);
      glgsv = formatNmeaForDisplay("glgsv", glgsvSentences);
      if (isGsvSentenceArrayComplete(glgsvSentences)) glgsvPublished = glgsv;
      return;
    }
    if (type === "gngsv") {
      gngsvSentences = accumulateGsv(gngsvSentences, sentence);
      gngsv = formatNmeaForDisplay("gngsv", gngsvSentences);
      if (isGsvSentenceArrayComplete(gngsvSentences)) gngsvPublished = gngsv;
      return;
    }
    if (type === "gqgsv") {
      gqgsvSentences = accumulateGsv(gqgsvSentences, sentence);
      gqgsv = formatNmeaForDisplay("gqgsv", gqgsvSentences);
      if (isGsvSentenceArrayComplete(gqgsvSentences)) gqgsvPublished = gqgsv;
      return;
    }
  }

  function toUiSnapshot() {
    return {
      updatedAtMs,
      rmc: rmcPublished,
      gga: ggaPublished,
      gsa: gsaPublished,
      gpgsv: gpgsvPublished,
      gbgsv: gbgsvPublished,
      gagsv: gagsvPublished,
      glgsv: glgsvPublished,
      gngsv: gngsvPublished,
      gqgsv: gqgsvPublished,
    };
  }

  /** GNGSA 一批句末合并后再调用，将 working 写入 published */
  function commitGsaPublish() {
    if (gsa != null) {
      gsaPublished = gsa;
    }
  }

  /**
   * 当前缓存的 GSV 是否已收齐本组（message 1..total 各出现一次）
   * @param {string} type
   */
  function isGsvGroupComplete(type) {
    /** @type {any[] | null} */
    let arr = null;
    if (type === "gpgsv") arr = gpgsvSentences;
    else if (type === "gbgsv") arr = gbgsvSentences;
    else if (type === "gagsv") arr = gagsvSentences;
    else if (type === "glgsv") arr = glgsvSentences;
    else if (type === "gngsv") arr = gngsvSentences;
    else if (type === "gqgsv") arr = gqgsvSentences;
    else return false;
    return isGsvSentenceArrayComplete(arr);
  }

  return { push, toUiSnapshot, isGsvGroupComplete, commitGsaPublish };
}

/** 供单测与 GSV 组完整性判断：是否已收到 1..total 各一段 */
export function isGsvSentenceArrayComplete(sentences) {
  if (!sentences?.length) return false;
  let total = null;
  for (const s of sentences) {
    const { total: t } = getGsvIndex(s);
    if (t != null && t > 0) total = t;
  }
  if (total == null) return false;
  const idxSet = new Set();
  for (const s of sentences) {
    const { index: idx } = getGsvIndex(s);
    if (idx != null && idx >= 1) idxSet.add(idx);
  }
  if (idxSet.size !== total) return false;
  for (let i = 1; i <= total; i++) {
    if (!idxSet.has(i)) return false;
  }
  return true;
}

/**
 * @param {any[]} existing
 * @param {any} sentence
 */
function accumulateGsv(existing, sentence) {
  const { total, index } = getGsvIndex(sentence);
  if (index === 1) {
    return [sentence];
  }
  const next = existing.concat([sentence]);
  // 若 total 可用，限制长度；否则做一个保守上限（固件 GSV 段数可 >4）
  const limit = total && total > 0 ? Math.min(total, 16) : 16;
  return next.slice(-limit);
}

/**
 * GSV: $--GSV,totalMsgs,msgNum,totalSats,...
 * @param {any} sentence
 * @returns {{ total: number | null, index: number | null }}
 */
function getGsvIndex(sentence) {
  const fields = sentence?.fields;
  if (Array.isArray(fields)) {
    const total = parseInt(fields[0] || "", 10);
    const index = parseInt(fields[1] || "", 10);
    return {
      total: Number.isFinite(total) ? total : null,
      index: Number.isFinite(index) ? index : null,
    };
  }
  // nmea-simple 的字段命名不稳定，这里只做兜底
  const total =
    sentence?.numberOfMessages != null
      ? Number(sentence.numberOfMessages)
      : sentence?.totalNumberOfMessages != null
        ? Number(sentence.totalNumberOfMessages)
        : null;
  const index = sentence?.messageNumber != null ? Number(sentence.messageNumber) : null;
  return {
    total: Number.isFinite(total) ? total : null,
    index: Number.isFinite(index) ? index : null,
  };
}

// 预留：未来新增未支持句型时的兜底格式化
