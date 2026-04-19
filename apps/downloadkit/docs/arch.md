# Architecture Notes

## Layer Responsibilities

- `src/core`: workflow and state machine only
- `src/transports`: browser API wrappers and adapters
- `src/protocols`: vendor/chip specific flashing behavior
- `src/plugins`: plugin contracts and registry
- `src/features`: Vue UI and state management

## Rules

- No protocol logic in UI.
- No direct DOM access in core/protocol/transport.
- No cross-layer shortcuts around `core`.
- All plugin selection must go through registry resolve.
