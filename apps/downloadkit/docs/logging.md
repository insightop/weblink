# Logging Guide

Flasher workbench uses structured logs with a unified logger API.

Runtime logger backend is `pino` (browser mode), while UI storage/filtering keeps using Pinia `LogEntry[]`.

## Model

- `LogEntry`: `id`, `timestamp`, `level`, `message`, optional `context`
- `LogLevel`: `trace | debug | info | warning | error`

## Logger API

Use `src/features/flasher/services/flasherLogger.ts`:

- `flasherLogger.trace(message, context?)`
- `flasherLogger.debug(message, context?)`
- `flasherLogger.info(message, context?)`
- `flasherLogger.warning(message, context?)`
- `flasherLogger.error(message, context?)`

The API remains stable even if backend logger implementation changes.

## Level Semantics

- `info`: expected successful lifecycle events
- `warning`: recoverable/user-action-needed states
- `error`: failures, exceptions, aborted operations
- `debug`: extra diagnostics useful during development
- `trace`: fine-grained flow tracing

## UI Filtering

The right log sidebar supports multi-select chips for level filtering.

- Default: all levels enabled
- Quick actions: `All`, `None`, `Clear`
- Color mapping is consistent across filter tags and log card level tags:
  - `trace`: cyan
  - `debug`: violet
  - `info`: blue
  - `warning`: amber
  - `error`: red
- Filter tag states:
  - selected: solid level color + high-contrast text
  - unselected: light tinted background + colored border/text (not gray)
- Rendering format: per-log card with left metadata column:
  - timestamp in milliseconds: `HH:mm:ss.SSS`
  - reversed level tag (`TRACE/DEBUG/INFO/WARNING/ERROR`)
  - message content in right column
  - left metadata column uses auto-min width (`fit-content`) to preserve message width

## Theme Adaptation

Log view uses dedicated semantic tokens from `src/styles/theme.css`:

- `--log-surface-bg`
- `--log-text-primary`
- `--log-card-bg`
- `--log-border`

This avoids inheriting dark-only contrast tokens and keeps light/dark modes readable.

