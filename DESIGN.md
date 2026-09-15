---
name: Volo
description: Arabic-first Cline desktop shell. The Night Shift Console.
colors:
  night-base: "#0c0c0e"
  night-surface: "#121215"
  night-raised: "#18181c"
  night-input: "#151518"
  line: "#232328"
  line-faint: "#1b1b20"
  ink: "#e3e3e7"
  ink-dim: "#8a8a93"
  ink-faint: "#5b5b64"
  command-blue: "#3b82f6"
  command-blue-deep: "#1d4ed8"
  lantern-amber: "#d97706"
  lantern-bright: "#f59e0b"
  approve-green: "#10b981"
  danger-red: "#ef4444"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "JetBrains Mono, Fira Code, Cascadia Code, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.command-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "{colors.command-blue-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  nav-item-active:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  input-prompt:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "12px"
  model-pill:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: Volo

## 1. Overview

**Creative North Star: "The Night Shift Console"**

Volo is the console an engineer leaves running overnight: dark, exact, and calm while the agent does the work and the approval law stands guard. Arabic leads on the right; code, terminals, and diffs hold the left in unbroken left-to-right. Density is a virtue here, decoration is a bug. Every surface answers one question: what did the agent do, and what is it asking to do next.

This system explicitly rejects SaaS-marketing grammar: no light surfaces, no glass panels, no gradient text, no giant metric heroes, no eyebrow label above every section. From PRODUCT.md: *"The tool should disappear into the task."*

**Key Characteristics:**
- Near-black tonal stack, one blue for command, one amber for caution.
- Single sans family, tight product scale, mono reserved for machine text.
- Flat surfaces separated by 1px lines, never shadows.
- Full RTL shell with bidi-safe message rendering.

## 2. Colors

Restrained strategy: tinted-near-black neutrals carry every surface; blue commands and amber cautions, each under ten percent of any screen.

### Primary
- **Command Blue** (#3b82f6): the only action color. Primary buttons, current selection, active session dot, links, focus rings. Never decoration, never background fills.

### Secondary
- **Lantern Amber** (#d97706, bright #f59e0b): caution states only. Pending approvals, cost meters, test-count badges, warning callouts. Its rarity is the signal.

### Neutral
- **Night Base** (#0c0c0e): app background, title bar.
- **Night Surface** (#121215): sidebar, panels, main canvas sections.
- **Night Raised** (#18181c): cards, prompt input, active list rows, floating composer.
- **Night Input** (#151518): text field wells inside cards.
- **Line** (#232328): 1px borders on cards, sidebars, dividers.
- **Line Faint** (#1b1b20): hairline separators inside lists.
- **Ink** (#e3e3e7): primary text, headings, active items.
- **Ink Dim** (#8a8a93): secondary text, timestamps, icons at rest.
- **Ink Faint** (#5b5b64): non-essential metadata only (relative dates, counts). Never body copy: it fails 4.5:1.
- **Approve Green** (#10b981) / **Danger Red** (#ef4444): terminal verdict colors (allowed/denied, pass/fail). Used as text and dots, never large fills.

### Named Rules (optional, powerful)
**The Ten-Percent Rule.** Command Blue plus Lantern Amber together cover at most a tenth of any screen. If a screenshot looks colorful, something is miscolored.
**The Faint-Is-Metadata Rule.** Ink Faint (#5b5b64) appears only on non-essential metadata at 10-11px. Anything the user must read is Ink or Ink Dim.

## 3. Typography

**Body Font:** system sans stack (-apple-system, Segoe UI, Roboto…) with Arabic-capable fallbacks (Tahoma, Segoe UI).
**Label Font:** same sans, medium weight. One family carries everything.
**Label/Mono Font:** JetBrains Mono (Fira Code, Cascadia Code, Consolas fallback) for code, diffs, terminal, hashes, counts.

**Character:** quiet and technical. No display face, no pairing contrast; hierarchy comes from size steps of 12/14/16 and weight 400/500/600 only.

### Hierarchy
- **Title** (600, 14-16px, 1.4): pane headers, dialog titles, card titles.
- **Body** (400, 14px, 1.6, max 70ch): messages, prose, walkthrough text.
- **Label** (500, 12px, 1.4): nav items, buttons, input labels, table headers.
- **Meta** (400, 10-11px, mono for numbers): timestamps, token counts, file stats.
- **Code** (400, 12px mono, 1.5): code blocks (always LTR), inline code, terminal.

### Named Rules (optional)
**The One-Family Rule.** No serif, no display face, no third family. If text needs emphasis, change weight or size, never the family.
**The LTR-Code Rule.** Code, terminal output, diffs, hashes, and file paths are always `direction: ltr`, even inside RTL messages.

## 4. Elevation

This system is flat by tonal layering, not shadows. Depth is conveyed by stepping the background up the neutral stack (Base → Surface → Raised → Input) plus 1px Line borders. No element casts a drop shadow at rest; the floating composer earns separation from backdrop blur and a Line border, not a shadow.

### Named Rules (optional)
**The Flat-By-Default Rule.** Surfaces are flat at rest. Nothing floats except the prompt composer and modal dialogs, and even those use borders, not shadows.

## 5. Components

### Buttons
- **Shape:** gently rounded rectangles (6-8px); pills allowed only for tags and the model selector.
- **Primary:** Command Blue fill (#3b82f6), white text, 6px radius, 6-12px padding. Hover deepens to #1d4ed8. One primary per view.
- **Ghost / Nav:** transparent, Ink Dim text; hover tints the row (Night Raised) and brightens text. No borders on ghost buttons.
- **Danger confirm:** solid Danger Red fill, white text; used only for irreversible confirms (delete session, discard worktree).

### Prompt Composer
- **Shape:** card at 16px radius, Night Raised fill, Line border; floating variant adds backdrop blur.
- **Anatomy:** text input row, then a control row (attach, model pill, voice, send). Send is a 28px circle, dim at rest, Command Blue on hover.
- **Focus:** border shifts toward Command Blue at 50% opacity. No glow shadows.

### Model Pill
- **Style:** pill (999px), Night Raised fill, Line border, 11-12px label with a status dot (amber for fast/cheap, blue for flagship).
- **Behavior:** opens a model menu; selection is confirmed in place, never in a modal.

### Session / List Items
- **Style:** 6px rows, transparent at rest; active row is Night Raised with Ink text; unread carries a blue dot, never a badge count.
- **Meta:** timestamps and counts in Ink Faint mono at 10-11px, trailing edge.

### Walkthrough / Review Cards
- **Corner Style:** gently rounded boxes (12px).
- **Background:** Night Raised fill with a Line border; note callouts use a 2px Command Blue leading bar, full border otherwise.
- **Internal Padding:** 16px; diff stats in mono (green/red, 11px).

### Approval Dialog (signature component)
- **Character:** the product's handshake. Small centered modal, Night Raised, Line border, 12px radius.
- **Anatomy:** tool name as title, command or diff preview in mono LTR block, cost estimate line in amber, two buttons: Allow (primary blue) and Deny (ghost). Verb plus object on both: "Allow edit", "Deny run".
- **Rule:** approvals never appear as toasts or inline links. If it executes code, it gets a dialog.

### Navigation
- **Shell:** 32-40px title bar (brand, menus, window controls), 256-280px right-or-left sidebar per locale direction, center workspace, optional 384px inspection pane.
- **States:** default Ink Dim, hover Ink on Night Raised, active Ink on Night Raised with semibold label. One accent mechanism only.

## 6. Do's and Don'ts

Quoted from PRODUCT.md anti-references, enforced visually below.

### Do:
- **Do** keep every surface dark: Base #0c0c0e, Surface #121215, Raised #18181c.
- **Do** reserve Command Blue for actions, selection, and focus; Lantern Amber for caution and cost.
- **Do** render Arabic RTL with code fenced LTR (The LTR-Code Rule).
- **Do** use skeleton blocks for loading panes, never centered spinners.
- **Do** write button labels as verb plus object ("Allow edit", "Start session").
- **Do** give every interactive component default, hover, focus, active, and disabled states.

### Don't:
- **Don't** ship light surfaces, glassmorphism panels, or gradient text anywhere in the product.
- **Don't** build hero-metric blocks (giant number plus small label) or identical icon-heading-text card grids.
- **Don't** put a tiny uppercase tracked eyebrow above every section, or 01/02/03 markers that decorate instead of sequencing.
- **Don't** use side-stripe borders thicker than 1px as accents; use full borders or tonal fills.
- **Don't** round cards beyond 16px or pair a 1px border with a soft wide shadow on the same element.
- **Don't** use Ink Faint (#5b5b64) for anything the user must read.
- **Don't** open a modal for anything except approvals and destructive confirms.
- **Don't** animate layout properties, orchestrate page-load entrances, or ship motion without a `prefers-reduced-motion` alternative.
