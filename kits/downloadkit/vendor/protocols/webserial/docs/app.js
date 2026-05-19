/* SPDX-License-Identifier: Apache-2.0 */
const ACK = 0x79;
const NACK = 0x1f;
const BUSY = 0x76;

const CMD_INIT = 0x7f;
const CMD_GET = 0x00;
const CMD_GID = 0x02;
const CMD_GO = 0x21;
const CMD_WM = 0x31;
const CMD_WM_NS = 0x32;
const CMD_ER = 0x43;
const CMD_EE = 0x44;
const CMD_EE_NS = 0x45;

const DEFAULT_TIMEOUT = 2000;
const MASS_ERASE_TIMEOUT = 60000;
const WRITE_TIMEOUT = 4000;

const connectBtn = document.getElementById("connectBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const flashBtn = document.getElementById("flashBtn");
const firmwareFile = document.getElementById("firmwareFile");
const serialStatus = document.getElementById("serialStatus");
const baudRateInput = document.getElementById("baudRate");
const startAddressInput = document.getElementById("startAddress");
const massEraseInput = document.getElementById("massErase");
const autoGoInput = document.getElementById("autoGo");
const autoConsoleInput = document.getElementById("autoConsole");
const autoBootInput = document.getElementById("autoBoot");
const progressBar = document.getElementById("progressBar");
const progressLabel = document.getElementById("progressLabel");
const logEl = document.getElementById("log");
const fileInfo = document.getElementById("fileInfo");
const consoleOpenBtn = document.getElementById("consoleOpenBtn");
const consoleCloseBtn = document.getElementById("consoleCloseBtn");
const consolePauseBtn = document.getElementById("consolePauseBtn");
const consoleStatus = document.getElementById("consoleStatus");
const consoleBaudRateInput = document.getElementById("consoleBaudRate");
const consoleLogEl = document.getElementById("consoleLog");
const consoleInput = document.getElementById("consoleInput");
const consoleSendBtn = document.getElementById("consoleSendBtn");

let port = null;
let reader = null;
let writer = null;
let rxQueue = [];
let rxWaiter = null;
let rxWaiterTimeout = null;
let commandSet = [];
let bootloaderVersion = null;
let deviceId = null;

let consoleReader = null;
let consoleWriter = null;
let consoleOpen = false;
let consolePaused = false;
let consoleBuffer = "";
let consoleLineBuffer = "";

function updateFlashButtonState() {
  flashBtn.disabled = !firmwareFile.files.length;
}

function log(message) {
  const ts = new Date().toLocaleTimeString();
  logEl.textContent += `[${ts}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function logConsole(message) {
  appendConsoleLine(`• ${message}`, true);
}

function formatTimestampWithMs() {
  const now = new Date();
  const hours = now.getHours();
  const hour12 = ((hours + 11) % 12) + 1;
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  return `${hour12}:${minutes}:${seconds}.${ms} ${ampm}`;
}

function appendConsoleLine(message, isMeta = false) {
  const ts = formatTimestampWithMs();
  const tsSpan = document.createElement("span");
  tsSpan.className = "console__ts";
  tsSpan.textContent = `[${ts}] `;

  const msgSpan = document.createElement("span");
  msgSpan.className = isMeta ? "console__meta" : "console__msg";
  msgSpan.textContent = message;

  consoleLogEl.appendChild(tsSpan);
  consoleLogEl.appendChild(msgSpan);
  consoleLogEl.appendChild(document.createTextNode("\n"));
  consoleLogEl.scrollTop = consoleLogEl.scrollHeight;
}

function appendConsoleText(text) {
  consoleLineBuffer += text;
  const lines = consoleLineBuffer.split(/\r?\n/);
  consoleLineBuffer = lines.pop();
  for (const line of lines) {
    appendConsoleLine(line);
  }
}

function setStatus(text) {
  serialStatus.textContent = text;
}

function setProgress(value, label) {
  progressBar.classList.remove("progress__bar--busy");
  progressBar.style.width = `${value}%`;
  progressLabel.textContent = label;
}

function setProgressBusy(label) {
  progressBar.classList.add("progress__bar--busy");
  progressBar.style.width = "100%";
  progressLabel.textContent = label;
}

function toHex(value, width = 2) {
  return `0x${value.toString(16).toUpperCase().padStart(width, "0")}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clearRx() {
  rxQueue = [];
}

function queueBytes(bytes) {
  for (const b of bytes) rxQueue.push(b);
  if (rxWaiter) {
    rxWaiter();
    rxWaiter = null;
  }
}

async function waitForData(timeoutMs) {
  if (rxQueue.length) return;
  return new Promise((resolve, reject) => {
    rxWaiter = resolve;
    rxWaiterTimeout = setTimeout(() => {
      rxWaiter = null;
      reject(new Error("Read timeout"));
    }, timeoutMs);
  }).finally(() => {
    if (rxWaiterTimeout) {
      clearTimeout(rxWaiterTimeout);
      rxWaiterTimeout = null;
    }
  });
}

async function readBytes(count, timeoutMs = DEFAULT_TIMEOUT) {
  const deadline = Date.now() + timeoutMs;
  while (rxQueue.length < count) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("Read timeout");
    await waitForData(remaining);
  }
  return rxQueue.splice(0, count);
}

async function readByte(timeoutMs = DEFAULT_TIMEOUT) {
  const [value] = await readBytes(1, timeoutMs);
  return value;
}

async function expectAck(timeoutMs = DEFAULT_TIMEOUT) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    const b = await readByte(Math.max(remaining, 1));
    if (b === ACK) return;
    if (b === NACK) throw new Error("Device replied with NACK");
    if (b === BUSY) continue;
    throw new Error(`Unexpected byte ${toHex(b)}`);
  }
  throw new Error("ACK timeout");
}

function checksumXor(bytes) {
  return bytes.reduce((acc, b) => acc ^ b, 0);
}

async function writeBytes(bytes) {
  await writer.write(new Uint8Array(bytes));
}

async function sendCommand(cmd, timeoutMs = DEFAULT_TIMEOUT) {
  await writeBytes([cmd, cmd ^ 0xff]);
  await expectAck(timeoutMs);
}

async function sendAddress(address) {
  const bytes = [
    (address >> 24) & 0xff,
    (address >> 16) & 0xff,
    (address >> 8) & 0xff,
    address & 0xff,
  ];
  const checksum = checksumXor(bytes);
  await writeBytes([...bytes, checksum]);
  await expectAck();
}

async function initBootloader() {
  clearRx();
  await writeBytes([CMD_INIT]);
  await expectAck();
  log("Bootloader init OK");
}

async function getBootloaderInfo() {
  await sendCommand(CMD_GET);
  const len = await readByte();
  const payload = await readBytes(len + 1);
  bootloaderVersion = payload[0];
  commandSet = payload.slice(1);
  await expectAck();
  log(`Bootloader v${bootloaderVersion.toString(16)} supports ${commandSet.length} commands`);
}

async function getDeviceId() {
  await sendCommand(CMD_GID);
  const len = await readByte();
  const payload = await readBytes(len + 1);
  if (payload.length >= 2) {
    deviceId = (payload[0] << 8) | payload[1];
    log(`Device ID: ${toHex(deviceId, 4)}`);
  }
  await expectAck();
}

function chooseWriteCommand() {
  if (commandSet.includes(CMD_WM_NS)) return CMD_WM_NS;
  if (commandSet.includes(CMD_WM)) return CMD_WM;
  throw new Error("WRITE MEMORY not supported by this bootloader");
}

function chooseEraseCommand() {
  if (commandSet.includes(CMD_EE_NS)) return CMD_EE_NS;
  if (commandSet.includes(CMD_EE)) return CMD_EE;
  if (commandSet.includes(CMD_ER)) return CMD_ER;
  throw new Error("ERASE not supported by this bootloader");
}

async function massErase() {
  const eraseCmd = chooseEraseCommand();
  await sendCommand(eraseCmd);
  if (eraseCmd === CMD_ER) {
    await writeBytes([0xff, 0x00]);
  } else {
    await writeBytes([0xff, 0xff, 0x00]);
  }
  await expectAck(MASS_ERASE_TIMEOUT);
  log("Mass erase complete");
}

async function writeMemory(address, data) {
  if (address % 4 !== 0) throw new Error("Address must be 4-byte aligned");
  const writeCmd = chooseWriteCommand();
  await sendCommand(writeCmd);
  await sendAddress(address);

  const alignedLength = (data.length + 3) & ~3;
  const payload = new Uint8Array(alignedLength + 2);
  payload[0] = alignedLength - 1;
  payload.set(data, 1);
  payload.fill(0xff, 1 + data.length);
  let checksum = payload[0];
  for (let i = 1; i <= alignedLength; i++) checksum ^= payload[i];
  payload[alignedLength + 1] = checksum;

  await writeBytes(payload);
  await expectAck(WRITE_TIMEOUT);
}

async function go(address) {
  await sendCommand(CMD_GO);
  const bytes = [
    (address >> 24) & 0xff,
    (address >> 16) & 0xff,
    (address >> 8) & 0xff,
    address & 0xff,
  ];
  const checksum = checksumXor(bytes);
  await writeBytes([...bytes, checksum]);
  await expectAck();
  log("GO command sent");
}

async function flashFirmware(buffer, startAddress) {
  const data = new Uint8Array(buffer);
  const total = data.length;
  const chunkSize = 256;
  let offset = 0;
  while (offset < total) {
    const chunk = data.slice(offset, Math.min(offset + chunkSize, total));
    await writeMemory(startAddress + offset, chunk);
    offset += chunk.length;
    const pct = Math.min(100, Math.floor((offset / total) * 100));
    setProgress(pct, `Writing ${offset} / ${total} bytes`);
  }
}

async function startFlash() {
  if (!firmwareFile.files.length) throw new Error("Select a firmware file");

  await ensureBootloaderConnection();

  const file = firmwareFile.files[0];
  const buffer = await file.arrayBuffer();
  const startAddress = parseInt(startAddressInput.value, 16);
  if (!Number.isFinite(startAddress)) throw new Error("Invalid start address");

  if (autoBootInput.checked) {
    setProgress(0, "Entering bootloader");
    await enterBootloaderSequence();
  }

  setProgress(0, "Initializing bootloader");
  await initBootloader();
  await getBootloaderInfo();
  await getDeviceId();

  if (massEraseInput.checked) {
    setProgressBusy("Erasing flash");
    await massErase();
    setProgress(0, "Writing firmware");
  }

  if (!massEraseInput.checked) {
    setProgress(0, "Writing firmware");
  }
  await flashFirmware(buffer, startAddress);
  setProgress(100, "Flash complete");

  if (autoGoInput.checked) {
    await go(startAddress);
  }

  if (autoConsoleInput.checked) {
    await switchToConsole();
  }
}

async function startReadLoop() {
  reader = port.readable.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) queueBytes(value);
    }
  } catch (err) {
    log(`Read loop error: ${err.message}`);
  }
}

async function openPort(baudRate, parity) {
  if (!port) {
    port = await navigator.serial.requestPort();
  }
  await port.open({ baudRate, dataBits: 8, parity, stopBits: 1, flowControl: "none" });
}

async function connect() {
  const baudRate = Number(baudRateInput.value) || 115200;
  await openPort(baudRate, "even");
  writer = port.writable.getWriter();
  startReadLoop();
  setStatus("Connected");
  log(`Connected at ${baudRate} baud`);
  connectBtn.disabled = true;
  disconnectBtn.disabled = false;
  updateFlashButtonState();
  consoleOpenBtn.disabled = false;
}

async function disconnect() {
  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
  setStatus("Disconnected");
  await stopBootloaderStream();
  if (port) await port.close();
  port = null;
  consoleOpenBtn.disabled = false;
  updateFlashButtonState();
  log("Disconnected");
}

async function enterBootloaderSequence() {
  if (!port) throw new Error("No serial port selected");
  if (!port.writable || !port.readable) {
    const baudRate = Number(baudRateInput.value) || 115200;
    await openPort(baudRate, "even");
    writer = port.writable.getWriter();
    startReadLoop();
  }
  // Match PlatformIO stm32flash GPIO sequence:
  // RTS=1 (BOOT0 high), DTR=0, DTR=1, RTS=0.
  await setSignalsCompat({ rts: true, dtr: false });
  await sleep(100);
  await setSignalsCompat({ dtr: false });
  await sleep(100);
  await setSignalsCompat({ dtr: true });
  await sleep(100);
  await setSignalsCompat({ rts: false });
  await sleep(100);
  clearRx();
  log("Auto-enter bootloader sequence sent");
}

async function setSignalsCompat({ rts, dtr }) {
  // Web Serial uses requestToSend/dataTerminalReady in the spec.
  // Some implementations also accept rts/dtr. Try both.
  try {
    await port.setSignals({ requestToSend: rts, dataTerminalReady: dtr });
  } catch (err) {
    await port.setSignals({ rts, dtr });
  }
}

async function stopBootloaderStream() {
  if (reader) {
    await reader.cancel();
    reader.releaseLock();
    reader = null;
  }
  if (writer) {
    writer.releaseLock();
    writer = null;
  }
}

async function startConsoleReadLoop() {
  consoleReader = port.readable.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await consoleReader.read();
      if (done) break;
      if (value) {
        const text = decoder.decode(value, { stream: true });
        if (consolePaused) {
          consoleBuffer += text;
        } else {
          appendConsoleText(text);
        }
      }
    }
  } catch (err) {
    logConsole(`Console read error: ${err.message}`);
  }
}

async function openConsole() {
  if (consoleOpen) return;
  await stopBootloaderStream();
  if (!port) {
    port = await navigator.serial.requestPort();
  } else if (port.readable) {
    await port.close();
  }
  const baud = Number(consoleBaudRateInput.value) || 115200;
  await port.open({ baudRate: baud, dataBits: 8, parity: "none", stopBits: 1, flowControl: "none" });
  await setSignalsCompat({ rts: false, dtr: false });
  consoleWriter = port.writable.getWriter();
  startConsoleReadLoop();
  consoleOpen = true;
  consoleStatus.textContent = "Console open";
  consoleOpenBtn.disabled = true;
  consoleCloseBtn.disabled = false;
  consolePauseBtn.disabled = false;
  consoleInput.disabled = false;
  consoleSendBtn.disabled = false;
  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
  updateFlashButtonState();
  setStatus("Disconnected");
  logConsole(`Console opened at ${baud} baud`);
}

async function closeConsole() {
  if (!consoleOpen) return;
  if (consoleReader) {
    await consoleReader.cancel();
    consoleReader.releaseLock();
    consoleReader = null;
  }
  if (consoleWriter) {
    consoleWriter.releaseLock();
    consoleWriter = null;
  }
  if (port) await port.close();
  consoleOpen = false;
  consoleStatus.textContent = "Console closed";
  consoleOpenBtn.disabled = false;
  consoleCloseBtn.disabled = true;
  consolePauseBtn.disabled = true;
  consolePauseBtn.textContent = "Pause";
  consolePaused = false;
  consoleBuffer = "";
  consoleLineBuffer = "";
  consoleInput.disabled = true;
  consoleSendBtn.disabled = true;
  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
  updateFlashButtonState();
  logConsole("Console closed");
}

async function sendConsoleLine() {
  if (!consoleWriter) return;
  const line = consoleInput.value;
  if (!line) return;
  const encoder = new TextEncoder();
  await consoleWriter.write(encoder.encode(line + "\r\n"));
  consoleInput.value = "";
}

async function switchToConsole() {
  log("Switching to console...");
  await stopBootloaderStream();
  if (port && port.readable) {
    await port.close();
  }
  await openConsole();
}

async function ensureBootloaderConnection() {
  if (consoleOpen) {
    await closeConsole();
  }
  if (!port || !port.readable || !writer || !reader) {
    await connect();
  }
}

connectBtn.addEventListener("click", async () => {
  try {
    await connect();
  } catch (err) {
    log(`Connect failed: ${err.message}`);
  }
});

disconnectBtn.addEventListener("click", async () => {
  try {
    await disconnect();
  } catch (err) {
    log(`Disconnect failed: ${err.message}`);
  }
});

consoleOpenBtn.addEventListener("click", async () => {
  try {
    await openConsole();
  } catch (err) {
    logConsole(`Open console failed: ${err.message}`);
  }
});

consoleCloseBtn.addEventListener("click", async () => {
  try {
    await closeConsole();
  } catch (err) {
    logConsole(`Close console failed: ${err.message}`);
  }
});

  consolePauseBtn.addEventListener("click", () => {
  if (!consoleOpen) return;
  consolePaused = !consolePaused;
  consolePauseBtn.textContent = consolePaused ? "Resume" : "Pause";
  if (!consolePaused && consoleBuffer) {
    appendConsoleText(consoleBuffer);
    consoleBuffer = "";
  }
});

consoleSendBtn.addEventListener("click", async () => {
  try {
    await sendConsoleLine();
  } catch (err) {
    logConsole(`Send failed: ${err.message}`);
  }
});

consoleInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    await sendConsoleLine();
  }
});

firmwareFile.addEventListener("change", () => {
  if (!firmwareFile.files.length) {
    fileInfo.textContent = "Select a file, typically firmware.bin";
    updateFlashButtonState();
    return;
  }
  const file = firmwareFile.files[0];
  fileInfo.textContent = `${file.name} (${file.size} bytes)`;
  updateFlashButtonState();
});

flashBtn.addEventListener("click", async () => {
  flashBtn.disabled = true;
  setProgress(0, "Starting flash");
  try {
    await startFlash();
    log("Flash finished successfully");
  } catch (err) {
    log(`Flash failed: ${err.message}`);
    setProgress(0, "Flash failed");
  } finally {
    updateFlashButtonState();
  }
});

if (!("serial" in navigator)) {
  log("Web Serial API not available. Use Chromium-based browsers.");
  connectBtn.disabled = true;
  consoleOpenBtn.disabled = true;
  consolePauseBtn.disabled = true;
  flashBtn.disabled = true;
} else {
  consoleOpenBtn.disabled = false;
  updateFlashButtonState();
}
