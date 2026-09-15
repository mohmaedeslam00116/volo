# agent.md — instructions for coding agents working on Volo

## Required: keep the changelog up to date

**It is necessary to update [`CHANGELOG.md`](./CHANGELOG.md) regularly.** This is a
standing rule of this repository, not a suggestion.

- Every user-visible change (features, fixes, packaging, security, docs that affect
  users) gets an entry under the `## [Unreleased]` section **in the same commit**
  that makes the change.
- Entries follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format and
  use its categories: Added / Changed / Deprecated / Removed / Fixed / Security.
- Pure refactors with no user-visible effect may skip the changelog, but if you are
  unsure, write the entry.
- Before tagging a release (`v*`), fold `## [Unreleased]` into a dated version
  section (e.g. `## [1.0.1] - 2026-10-01`) so the release notes and the changelog
  never diverge.

## Project orientation

- **Product law first:** read `PRODUCT.md` and `DESIGN.md` before any UI change.
  Approvals fail closed; key material never leaves main; Arabic RTL UI, LTR code.
- **Commands:** `npm test` · `npm run typecheck` · `npm run build` · `npm run dist`.
  All three checks (test, typecheck, build) must pass before committing.
- **Commit style:** small, focused commits to `main`, one concern per commit;
  no pushes unless the user asks.
