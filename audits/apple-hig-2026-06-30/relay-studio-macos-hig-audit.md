# Relay Studio macOS HIG Audit

Date: 2026-06-30

## Scope

Surface audited from the running production-like macOS app:

1. Request designer
2. Flow builder
3. Response mappings dialog
4. Inspector
5. Settings tab
6. Native menu bar

Evidence source: live Computer Use observation of `/Users/jeffhaynes/java/relaystudio/src-tauri/target/release/bundle/macos/Relay Studio.app`.

Limit: macOS `screencapture` failed with `could not create image from display`, so local PNG evidence could not be saved. Findings are tied to current-run desktop-control screenshots and accessibility tree observations.

Apple references:

- https://developer.apple.com/design/human-interface-guidelines/designing-for-macos
- https://developer.apple.com/design/human-interface-guidelines/toolbars
- https://developer.apple.com/design/human-interface-guidelines/sidebars
- https://developer.apple.com/design/human-interface-guidelines/menus

## Current-Run Steps

| Step | Screen | Health |
| --- | --- | --- |
| 1 | Request designer, Create Order selected | Mostly healthy; still has command placement and menu gaps. |
| 2 | Flow builder, Authenticated Read selected | Healthy core workflow; some redundancy and inspector/canvas crowding remains. |
| 3 | Response mappings dialog | Improved; table model is correct, but dialog behavior and button placement should be tightened. |
| 4 | Inspector visible | Useful but duplicates some workbench context and consumes meaningful horizontal workspace. |
| 5 | Settings tab | Not healthy; opens a placeholder without actionable settings. |
| 6 | Native menus | Partially healthy; Edit is native/standard, but app/document commands are not organized like a normal macOS document app. |

## Findings

| Priority | Component / Panel | Evidence | HIG Gap | Recommended Change |
| --- | --- | --- | --- | --- |
| High | Native menu bar | Accessibility tree exposes `Relay Studio` and `Edit`; `Relay Studio` menu contains `Open...`, `Open Recent`, `Close Window`. `Edit` contains standard editing commands. | Document/project commands are in the app menu rather than a standard `File` menu. No visible `View`, `Window`, or `Help` menus. | Add macOS-style menus: `File` with New Project, Open, Open Recent, Save, Save As, Close Tab/Window; `View` with Toggle Sidebar, Toggle Inspector, Toggle Response Dock, Zoom/Fit Flow; `Window`; `Help`. Keep standard `Edit`. |
| High | Settings | Footer `Settings` opens a tab with only “Manage defaults, close behavior, redaction, and project settings.” | Reaching a placeholder breaks user trust; macOS preferences should be actionable and discoverable. | Replace placeholder with real settings or hide it until implemented. Prefer `Relay Studio > Settings...` with `Cmd+,`, and optionally open the same settings view. |
| High | Sidebar / Recent Projects | Sidebar contains project tree, saved responses, recent projects, transient status text, and footer commands. | Sidebar should primarily navigate top-level areas or content collections. Current sidebar mixes navigation, project switching, status, and settings. | Keep Requests/Flows/Environments/Variables in Explorer. Move Recent Projects to File > Open Recent plus a compact “recent” section only if needed. Move transient status to a bottom status bar or toast area, not inside navigation. |
| High | Dirty-state / Save model | Project title shows unsaved marker; Save is present in toolbar. | macOS document apps need predictable save/switch/close behavior and menu parity. | Ensure `Cmd+S`, File > Save, File > Save As, project switching, tab closing, and app closing all share the same unsaved-project confirmation path. |
| Medium | Top toolbar | Web shell toolbar has Search, Save, Send/Run context, environment selector, inspector toggle. | Toolbar content is useful, but primary commands are web-drawn and not mirrored in native menus; command availability changes by selected tab. | Keep the toolbar, but make it state-aware and menu-backed. For flow tabs, show Run Flow only in the composer. For request tabs, show Send Request. For Welcome/Settings, hide unavailable primary actions. |
| Medium | Inspector | With flow selected, inspector shows variables, auth snapshot, and request summary while flow step details show request/status/order/path/mappings. | Inspector should provide contextual auxiliary information, not duplicate what the workbench already shows. | Make inspector mode-sensitive: variables for environment, request metadata for request tabs, selected-step data for flow tabs only if the right step panel is hidden. Avoid showing request summary for Settings/Welcome. |
| Medium | Flow builder details panel | Flow step details and inspector can both be open, narrowing canvas. | macOS productivity apps should preserve the work area for the primary task. | Add View menu commands and shortcuts to toggle details/inspector. Consider auto-hiding global inspector while flow step details is open on narrow widths. |
| Medium | Response mappings dialog | Dialog has Add Mapping, table, JSONPath examples, close x, Done. | Functional, but not yet fully native-feeling: Escape/default button/focus order need verification, and close affordances are split between x and Done. | Trap focus inside dialog, Escape closes, Enter confirms where safe, initial focus lands on first logical field or Add Mapping. Use Cancel/Done ordering consistently. |
| Medium | Context menus | Prior testing showed browser-native menus in some areas; current state has app commands in menus but context menus were not fully audited this run. | macOS users expect right-click menus to contain relevant object actions, not browser/webview defaults. | Maintain custom context menus for requests, flows, tabs, recent projects, mappings, and flow edges. Include Rename/Delete/Open/Duplicate where appropriate. Disable browser-native menu globally except editable text fields. |
| Medium | Typography and density | Current compact UI is better, but action labels and sidebar still consume substantial space compared with native productivity tools. | Mac productivity apps typically use dense sidebars/toolbars while preserving readable controls. | Continue density pass: use system font stack, smaller secondary metadata, icon-only toolbar actions with tooltips, tighter row heights, and avoid oversized section headings in utility panes. |
| Low | Icon system | App uses `lucide-react`; native references use SF Symbols. | Lucide is acceptable cross-platform but less mac-native. | Keep lucide for cross-platform consistency unless macOS polish becomes a release goal. If needed later, create a platform icon abstraction with SF Symbol-like choices on macOS. |
| Low | Dark mode/accent color | Only light mode observed. | macOS apps should respect system appearance where feasible. | Add theme tokens for light/dark and test system accent/focus colors. Not urgent for demo, but important for native feel. |

## Accessibility Risks From Evidence

| Area | Risk | Recommendation |
| --- | --- | --- |
| Icon-only buttons | Accessible names exist for flow icon buttons in the tree, which is good. Visual-only discoverability still depends on hover tooltips. | Keep `aria-label` and `title`; verify keyboard focus and tooltip timing. |
| Splitters | Splitters are exposed as “Resize explorer/utility dock/flow details/inspector.” | Add keyboard-resizable behavior if feasible or document mouse-only limitation for now. |
| Dialog | Modal appears visually, but focus trapping and Escape behavior were not verified. | Add tests for focus trap, Escape close, and restoring focus to Manage button. |
| Inspector duplication | Screen reader users may encounter repeated context across workbench and inspector. | Hide redundant summaries from accessibility tree when not useful, or make inspector content strictly contextual. |

## Recommended Implementation Order

1. Add native `File`, `View`, `Window`, and `Help` menus and move document commands out of the app menu.
2. Replace or hide the placeholder Settings tab; wire `Cmd+,`.
3. Add View toggles for sidebar, inspector, response dock, and flow details.
4. Finish context menu coverage and suppress browser-native context menus outside editable text.
5. Refine inspector content by selected editor type.
6. Add dialog keyboard/focus tests for response mappings and project/flow/request rename dialogs.
7. Continue density pass after command/menu structure is correct.

