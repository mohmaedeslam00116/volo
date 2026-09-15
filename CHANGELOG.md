# Changelog

All notable changes to Volo are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2026-09-16

### Changed

- UI/UX polish pass across the whole shell: primary-button blue raised so its
  label text meets the WCAG AA 4.5:1 contrast floor; secondary text, placeholders,
  and speaker labels lifted off `ink-faint` onto readable tones; approval-log
  timestamps readable again.
- One quiet-button vocabulary (`.btn-ghost`) for stop / deny / back / clear /
  update actions, matching the primary button's shape; the stretched
  navigation-item style is retired.
- The approval dialog's timeout bar now drains in real time and the dialog states
  the timeout auto-deny explicitly.
- Session end is visible: when a live session ends, the composer explains it and
  the next task starts fresh; the auto-scroll no longer hijacks the feed while you
  scroll up to read.
- The inspector (approval record) is never hidden by window size: at narrow widths
  the sidebar and panel narrow instead of disappearing, and the window minimum
  width was raised to match.
- Model picker closes on Escape and outside clicks, shows the model id
  left-to-right, and drops a decorative amber dot that carried no state; the
  connection status now uses a real status dot colored by state.
- Onboarding errors render in the danger color instead of muted gray, and the
  provider select disables while a key save is in flight.
- RTL fixes: back arrow and send icons mirror correctly for right-to-left reading,
  and the titlebar version string is pinned left-to-right.

### Fixed

- The info-note accent used a side-stripe border (a banned pattern); it is now a
  full-border tonal card.
- Deny/allowed status chips lost their border color; all three approval states are
  now distinguishable by color alone.

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
