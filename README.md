# فولو — وحدة العمل الليلية للوكيل البرمجي

**فولو** واجهة مكتبية عربية بالكامل تعمل فوق منظومة Cline للوكلاء البرمجيين:
تكتب مهمتك بالعربية، والوكيل يقرأ مشروعك، يقترح، وينفّذ — وكل عملية خطيرة
(تعديل ملف، تشغيل أمر) تتوقف أولاً على **حوار موافقة** لا يمكن تجاوزه.
مفتاح النموذج يبقى في سلسلة نظامك ولا يغادر جهازك أبداً.

---

# Volo — the Night Shift Console

Volo is an Arabic-first desktop shell over the [Cline](https://github.com/cline/cline)
agent harness (`@cline/sdk`), built with Electron, React, TypeScript, and
Tailwind CSS 4. You hand it a coding task in Arabic; the agent reads your
project, proposes, and executes — and **every consequential action passes an
approval gate first**. Reads are auto-allowed and logged; edits, commands,
skills, and schedules ask; anything unknown or dangerous is denied, always.

![Volo screenshot](build/icon.png)

## The law

1. **The agent asks; Volo enforces.** Every write, command, and skill call
   stops at a visible approval dialog (Esc / backdrop / timeout = deny).
2. **Arabic first, code untouched.** The shell reads RTL; code, diffs, and
   terminal output stay LTR, always.
3. **Show the work, not the theater.** Sessions, approvals, and costs are
   inspectable facts, in the app.
4. **Zero-cost honesty.** No accounts, no telemetry, no server. Your API key
   lives in your OS keychain via Electron `safeStorage` and never leaves the
   main process. The only network traffic beyond your model provider is the
   update check against GitHub Releases (packaged builds only, silent when
   offline).

## Install (Windows)

1. Grab `Volo Setup <version>.exe` from the
   [latest release](https://github.com/mohmaedeslam00116/volo/releases/latest).
2. **SmartScreen note:** the installer is unsigned (open source, no cert yet).
   Windows Defender SmartScreen will show *"Windows protected your PC"*.
   Click **More info** → **Run anyway**. That prompt is the price of no
   certificate, not a warning about anything Volo did.
3. The app installs per-user (no admin needed) with desktop and Start-menu
   shortcuts.

## First run

1. Pick your provider (Anthropic / OpenAI / Google Gemini) and paste your API
   key — it is saved to your OS keychain and never displayed again.
2. Choose a model in the composer's model pill.
3. Type a task, e.g. `أنشئ ملف hello.txt يحتوي على "volo works"`.
4. When the approval dialog appears, try **Deny** first — nothing happens.
   Then allow, and watch the file appear in your project.
5. The sidebar shows the running cost. Past sessions keep transcripts and can
   be continued from their last checkpoint.

## Development

```bash
npm install        # deps
npm run dev        # dev app with hot reload
npm test           # unit tests (node:test)
npm run typecheck  # strict TS, main + renderer
npm run build      # production build
npm run dist       # Windows NSIS installer into dist/
```

Releases are built by CI on `v*` tags (`.github/workflows/release.yml`).

## Privacy

- API keys: OS keychain (`safeStorage`), main process only, never logged,
  never echoed — even error messages carry reason codes only.
- Sessions and settings: local files under your user data directory.
- Telemetry: none. The Cline SDK's telemetry service is left at its no-op
  default; no analytics, crash reporting, or phone-home of any kind.
- Updates: one HTTPS check to GitHub Releases per launch, nothing else.

## License

[MIT](LICENSE)
