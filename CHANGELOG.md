# Changelog

All notable changes to Volo are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-09-16

### Added

- Arabic-first RTL desktop shell over the Cline agent harness (`@cline/sdk`), with
  frameless titlebar, session sidebar, live cost meter, and inspector panel.
- Approval gate with three tiers: reads auto-allowed (logged), writes/commands/skills/
  schedules ask every time, unknown or dangerous tools denied outright; destructive
  command patterns hard-denied; everything fails closed.
- In-app signature approval dialog (native `<dialog>`): tool name, LTR mono preview,
  amber timeout line, Arabic verb+object buttons; Esc and backdrop clicks deny;
  OS-dialog fallback when the window is minimized; timeout auto-denies.
- First-run onboarding gate with provider + key setup; key stored in the OS keychain
  via `safeStorage`, never readable from the renderer.
- Session history: read-only transcripts (bidi-safe text, tool-call blocks) and
  checkpoint-based continue via restore-fork.
- Model picker over static per-provider catalogs (Anthropic / OpenAI / Gemini) with
  the preference persisted locally.
- Auto-update via GitHub Releases with a quiet in-app restart banner.
- Windows NSIS installer (one-click, per-user) with tag-triggered release CI.
- README (Arabic intro, English body) with SmartScreen walkthrough and privacy
  statement; MIT license.

### Changed

- Strict TypeScript end-to-end (main, preload, renderer, shared) with a typed IPC
  bridge and zod-validated payloads; styling migrated to Tailwind CSS 4 `@theme`;
  state managed with zustand.

### Fixed

- `send` now uses the SDK's verified flat `runTurn` contract (the
  `{type: "user_message"}` wrapper never matched `@cline/sdk` 0.0.83).
- "إيقاف الجلسة" calls `stop`, which actually ends the session, instead of `abort`,
  which only interrupts the in-flight tool.
- Provider IDs resolve to `anthropic` / `openai-native` / `gemini`; the previous
  `openai` / `google` IDs do not exist in the SDK's provider registry.

### Security

- Denials return the SDK's canonical `USER_REJECTED_TOOL_REASON`; deny is the default
  for Esc, backdrop click, timeout, and missing window.
- All mutating IPC handlers validate payloads against zod schemas at the main-process
  boundary.
