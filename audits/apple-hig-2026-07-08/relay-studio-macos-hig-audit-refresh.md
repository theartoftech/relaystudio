# Relay Studio macOS HIG Audit Refresh

Date: 2026-07-08

## Audit Scope

This refresh audits the Sprint 10A/10B macOS platform shell after the current Sprint 10B-1 regression work.

Surfaces audited:

1. Main request workbench
2. Command palette
3. Flow builder and flow details toggle
4. Settings tab
5. Dirty-work close prompt
6. Native macOS app, File, View, and Window menus

Evidence:

- Screenshot evidence: [evidence](evidence)
- Native menu evidence: Computer Use accessibility snapshots from the running Tauri app.
- App bundle observed: `/Users/jeffhaynes/java/relaystudio/src-tauri/target/release/bundle/macos/Relay Studio.app`

Limits:

- macOS `screencapture` targeted the wrong monitor in the current three-monitor setup, so native menu evidence is accessibility-tree based.
- Browser screenshots prove app-shell states but not native menu rendering.
- This audit checks platform fit and visible accessibility risks; it is not a full WCAG audit.

Apple references:

- https://developer.apple.com/design/human-interface-guidelines/designing-for-macos
- https://developer.apple.com/design/human-interface-guidelines/menus
- https://developer.apple.com/design/human-interface-guidelines/toolbars
- https://developer.apple.com/design/human-interface-guidelines/sidebars

## Current-Run Steps

| Step | Evidence | Health |
| --- | --- | --- |
| 1 | `01-main-shell.png` | Healthy. The workbench now has a stable desktop structure, clear project status, and app-owned command surfaces. |
| 2 | `02-command-palette.png` | Healthy. The command palette is discoverable, keyboard-oriented, and mirrors core shell actions. |
| 3 | `03-flow-details-visible.png` | Mostly healthy. The flow surface is usable with details visible, though the canvas remains dense. |
| 4 | `04-flow-details-hidden.png` | Healthy. Hiding Flow Details expands usable canvas space without leaving a layout gap. |
| 5 | `05-settings.png` | Healthy. Settings is no longer a placeholder and exposes concrete Request Policy controls. |
| 6 | `06-dirty-close-prompt.png` | Mostly healthy. Dirty-work protection is clear, though macOS button ordering remains more web-like than fully native. |
| 7 | Native menu snapshots | Healthy. Menus now follow expected macOS app/File/View/Window grouping. |

## Prior High-Priority Findings

| Prior Finding | July 8 Status | Evidence | Notes |
| --- | --- | --- | --- |
| Native menu bar lacked File/View/Window/Help organization. | Closed | Native snapshots | Menu bar now exposes `Relay Studio`, `File`, `Edit`, `View`, `Window`, and `Help`; document commands moved into `File`. |
| Settings was a placeholder. | Closed | `05-settings.png` | Settings now shows actionable Request Policy controls and is reachable from the app menu/command palette. |
| Sidebar mixed Recent Projects, status, and settings with navigation. | Closed | `01-main-shell.png` | Explorer is focused on project content; status moved to the bottom bar, and recent projects are command/menu based. |
| Dirty-state and save model needed menu parity. | Mostly closed | `06-dirty-close-prompt.png`, native snapshots | Save, Save As, Close Tab, Close Window, and OS close are wired into the shared dirty-state path. Full project-switch save flows should remain in regression coverage. |

## Current Findings

| Priority | Component / Panel | Evidence | HIG Gap Or Risk | Recommended Change |
| --- | --- | --- | --- | --- |
| Medium | Dirty-work prompt | `06-dirty-close-prompt.png` | The dialog is clear, but button ordering is web-oriented: primary action appears first, with cancel last. macOS dialogs often place the default/affirming action at the trailing edge. | For a later polish slice, evaluate macOS-specific button ordering or a platform abstraction for confirmation dialogs. Keep current behavior if cross-platform consistency is preferred. |
| Medium | Flow builder density | `03-flow-details-visible.png` | The flow details panel, response dock, and explorer can still make the primary canvas feel crowded. | Keep the View toggles; consider auto-hiding auxiliary panels at narrow widths or when users run Fit View. |
| Medium | Toolbar/menu duplication | `01-main-shell.png`, native snapshots | Save, environment, inspector, send/run, and command search are all useful, but some commands are available in both toolbar and menus. | Keep duplication for discoverability; ensure disabled states and labels stay synchronized through regression tests. |
| Low | Settings discoverability inside app shell | `05-settings.png` | Settings is functional, but the tab sits alongside request/flow tabs and may feel like a document tab rather than app preferences. | Accept for now. Later, consider a platform preference window if settings become broader or more account/app-scoped. |
| Low | Native screenshot evidence | `evidence/README.md` | Current evidence package relies on browser screenshots plus accessibility snapshots because OS capture selected the wrong monitor. | For future audits on multi-monitor setups, capture the active window by window ID or use a configured capture display. |
| Deferred | Dark mode and system appearance | Not captured | Only light mode was audited. | Track for a future platform appearance sprint or Windows/macOS shared theme pass. |
| Deferred | Full keyboard audit across all dialogs | `02-command-palette.png`, `06-dirty-close-prompt.png` | Command palette and dirty prompt are covered; every dialog was not re-tested in this audit run. | Keep Sprint 10B-1 automated regression coverage and include response mapping/rename dialogs in human QA. |

## Accessibility Risks From Evidence

| Area | Risk | Recommendation |
| --- | --- | --- |
| Icon buttons | Several toolbar and flow controls are icon-first. Accessibility names are present in the live tree for key controls, but visual discoverability depends on context and hover labels. | Keep `aria-label` coverage and add/maintain tooltips for icon-only controls. |
| Splitters | Splitters are exposed in the live tree as resize controls, but keyboard resizing was not verified in this audit run. | Keep mouse support and add keyboard resize behavior or document the limitation if keyboard resizing is deferred. |
| Dirty prompt | The modal dims the app and exposes clear choices. The destructive-ish `Do Not Save` choice is visually secondary, which reduces accidental loss risk. | Verify focus order and Escape behavior in automated coverage and the 10B-2 QA script. |
| Flow canvas | Canvas content is visually understandable, but complex node diagrams can be hard for screen reader users without a list alternative. | Keep node buttons in the accessibility tree and consider a linear step list mode if flow authoring becomes accessibility-critical. |

## Closed Or Deferred Audit Items

Closed:

- Standard macOS menu structure exists.
- Settings is actionable.
- Recent projects are no longer mixed into primary Explorer navigation.
- View toggles exist for sidebar, inspector, response dock, and flow details.
- Flow Details toggle state is synchronized with the workbench.
- macOS red close control closes clean windows and invokes dirty-work protection for dirty windows.

Deferred with rationale:

- Dark mode/system appearance: important but outside Sprint 10B-2 verification scope.
- Platform-specific modal button ordering: polish issue; current behavior is clear and regression covered.
- Full keyboard audit for every modal: partially covered by automated tests and manual QA; exhaustive dialog audit should remain a future accessibility pass.
- Native screenshot capture: blocked by current multi-monitor capture behavior; accessibility snapshots and browser screenshots provide sufficient 10B-2 audit evidence.

## Recommendations

1. Treat Sprint 10B-2 macOS QA as passing if the human script confirms native menu state, Settings access, View toggles, dirty close behavior, and context-menu dismissal.
2. Move to Windows QA/audit next instead of adding more macOS polish in this sprint.
3. Track dark mode, macOS-specific dialog ordering, and keyboard-resizable splitters as deferred platform polish.
4. Keep automated coverage around shell command state, Tauri menu payloads, and window close permissions because those were the highest-risk regressions found during 10B-1.
