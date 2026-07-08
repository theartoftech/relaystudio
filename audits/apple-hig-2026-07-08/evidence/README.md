# Sprint 10B-2 macOS Audit Evidence

Date captured: 2026-07-08

## Screenshot Evidence

These screenshots were captured from the Relay Studio app shell through the browser harness because the local macOS `screencapture` command targeted the wrong monitor in the current three-monitor setup.

| File | Evidence |
| --- | --- |
| `01-main-shell.png` | Main Relay Studio request workbench with Explorer, editor tabs, toolbar, request designer, response dock, and status bar. |
| `02-command-palette.png` | Command palette open over the request workbench, including command list and shortcuts. |
| `03-flow-details-visible.png` | Flow builder with `Authenticated Read` selected and the step details panel visible. |
| `04-flow-details-hidden.png` | Flow builder after `Toggle Flow Details`; the step details panel is hidden and the canvas remains usable. |
| `05-settings.png` | Production Settings tab with Request Policy controls. |
| `06-dirty-close-prompt.png` | Unsaved changes prompt after dirtying a request and closing the active tab. |

## Native macOS Evidence

Native menu evidence was captured from the current live Tauri app through Computer Use accessibility snapshots:

- App: `/Users/jeffhaynes/java/relaystudio/src-tauri/target/release/bundle/macos/Relay Studio.app`
- Bundle ID: `studio.relay.desktop`
- Main window exposed standard macOS close, minimize, and full-screen controls.
- Menu bar exposed `Relay Studio`, `File`, `Edit`, `View`, `Window`, and `Help`.
- `Relay Studio` menu exposed `About Relay Studio`, `Settings`, `Services`, `Hide Relay Studio`, `Hide Others`, `Quit Relay Studio`, and `Quit and Keep Windows`.
- `File` menu exposed `New Project`, `Open Project...`, `Open Recent Projects...`, `Open Recent`, `Save Project`, `Save Project As...`, `Send Request`, `Run Flow`, and `Close Tab`.
- `View` menu exposed `Toggle Sidebar`, `Toggle Inspector`, `Toggle Response Dock`, and `Toggle Flow Details`; `Toggle Flow Details` was disabled on request tabs and enabled on flow tabs.
- `Window` menu exposed `Minimize`, `Zoom`, `Toggle Full Screen`, and `Close Window`.

## Evidence Limits

- Native menu screenshots are not included because monitor-wide capture selected the wrong display in the current three-monitor setup.
- Browser screenshots cannot prove native menu rendering, checkmarks, or macOS menu placement; those are backed by the live accessibility snapshots above.
- The audit does not claim full WCAG conformance. It reports visible and accessibility-tree risks only.
