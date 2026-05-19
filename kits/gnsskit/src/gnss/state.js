// @ts-check

/**
 * @typedef {"disconnected"|"connecting"|"connected"|"error"} ConnectionStatus
 *
 * @typedef {Object} GnssSnapshot
 * @property {number} updatedAtMs
 * @property {{ rows: Array<{label: string, value: string}>, summary: string } | null} rmc
 * @property {{ rows: Array<{label: string, value: string}>, summary: string } | null} gga
 * @property {{ rows: Array<{label: string, value: string}>, summary: string } | null} gsa
 * @property {{ rows: Array<{label: string, value: string}>, summary: string } | null} gpgsv
 * @property {{ rows: Array<{label: string, value: string}>, summary: string } | null} gbgsv
 * @property {{ rows: Array<{label: string, value: string}>, summary: string } | null} gagsv
 * @property {{ rows: Array<{label: string, value: string}>, summary: string } | null} glgsv
 * @property {{ rows: Array<{label: string, value: string}>, summary: string } | null} gngsv
 * @property {{ rows: Array<{label: string, value: string}>, summary: string } | null} gqgsv
 */

/**
 * @typedef {Object} GnssState
 * @property {ConnectionStatus} status
 * @property {string | null} errorMessage
 * @property {number} baudRate
 * @property {Array<{id: number, tsMs: number, text: string}>} rawLines
 * @property {GnssSnapshot} snapshot
 */

/** @type {GnssState} */
let state = {
  status: "disconnected",
  errorMessage: null,
  baudRate: 115200,
  rawLines: [],
  snapshot: {
    updatedAtMs: 0,
    rmc: null,
    gga: null,
    gsa: null,
    gpgsv: null,
    gbgsv: null,
    gagsv: null,
    glgsv: null,
    gngsv: null,
    gqgsv: null,
  },
};

/** @type {Set<(s: GnssState) => void>} */
const listeners = new Set();

export function getState() {
  return state;
}

/**
 * @param {Partial<GnssState> | ((prev: GnssState) => GnssState)} patch
 */
export function setState(patch) {
  state =
    typeof patch === "function"
      ? patch(state)
      : /** @type {GnssState} */ ({ ...state, ...patch });
  for (const cb of listeners) cb(state);
}

/**
 * @param {(s: GnssState) => void} listener
 * @returns {() => void}
 */
export function subscribe(listener) {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}
