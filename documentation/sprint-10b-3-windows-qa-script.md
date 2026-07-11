# Sprint 10B-3 Human Test Script: Windows QA And Bounded Audit

## Purpose

Use this script on a Windows 10 or Windows 11 machine to validate the packaged Relay Studio desktop app and produce the evidence required to close Sprint 10B-3. Run the tests against an installer artifact built on the same machine.

## Test Record

Record the following before testing:

| Field | Value |
| --- | --- |
| Date | |
| Tester | |
| Windows version and build | |
| Display scale | |
| Monitor count | |
| Git commit | |
| Installer artifact | |

Mark every test `Pass`, `Fail`, or `Deferred`. A failed test must include reproduction steps and a screenshot or screen recording.

## Preflight And Installer Build

1. Open PowerShell, not Command Prompt.
2. Clone or pull the test branch.
3. From the repository root, run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\tools\windows-build-installer.ps1
   ```
4. Confirm the script completes all four gates:
   - `npm ci`
   - `npm run verify`
   - `cargo test --manifest-path src-tauri/Cargo.toml`
   - `npm run tauri build`
5. Confirm the script prints at least one `.exe` or `.msi` artifact path.
6. Install and launch that artifact.

Expected result:

- The build does not report a missing `.ico` file.
- At least one installable Windows artifact is produced.
- Installation and first launch complete without a console window or startup error.

## Test 1: Title Bar And Caption Controls

1. Launch Relay Studio maximized, restored, and minimized.
2. Restore the window and drag it using an unoccupied title-bar region.
3. Use Minimize, Maximize/Restore, and Close.
4. Reopen the app after Close.

Expected result:

- The title bar has one clear drag region.
- Search, Save, environment selection, and shell controls do not overlap caption controls.
- Minimize and Maximize/Restore work normally.
- Close exits a clean window.
- Caption controls remain visible in active and inactive window states.

## Test 2: Dirty Close Protection

1. Change a request name or URL.
2. Click the Windows Close caption button.
3. Select `Cancel` in the unsaved-changes prompt.
4. Close again and select `Do Not Save`.

Expected result:

- Dirty work is intercepted before the window closes.
- `Cancel` preserves the edit and keeps the window open.
- `Do Not Save` closes the window.
- No duplicate prompt or orphaned background process remains.

## Test 3: Small Breakpoint

1. Restore the window.
2. Resize it below 640 effective pixels wide.
3. Open a request, a flow, Settings, and the command palette.

Expected result:

- Controls and text do not overlap or leave the viewport.
- The primary editor remains usable.
- Auxiliary panes collapse or scroll predictably.
- Dialog actions remain visible and keyboard reachable.
- Caption controls remain unobstructed.

## Test 4: Medium Breakpoint

1. Resize the window between 641 and 1007 effective pixels wide.
2. Toggle Explorer, Inspector, Response Dock, and Flow Details where applicable.
3. Run `Fit View` on a flow.

Expected result:

- Pane toggles do not leave blank gaps.
- Request and flow content remain readable.
- Flow nodes and details do not overlap.
- The title bar and primary commands remain stable.

## Test 5: Large Breakpoint And Multi-Monitor Movement

1. Resize the window to at least 1008 effective pixels wide.
2. Maximize and restore it.
3. If multiple monitors are available, move the restored window between monitors with different scale factors.

Expected result:

- The full Explorer, editor, optional Inspector, and Response Dock layout is usable.
- Maximize/restore does not shift or clip caption controls.
- Moving between monitors does not produce unusable scaling, a blank window, or misplaced dialogs.

## Test 6: Light, Dark, And High Contrast

1. Test Relay Studio in Windows light mode.
2. Switch Windows apps to dark mode and relaunch Relay Studio.
3. Enable a Windows contrast theme and relaunch Relay Studio.
4. Inspect the title bar, Explorer, tabs, command palette, dialogs, focus indicators, selected rows, disabled controls, and destructive actions.

Expected result:

- Text and controls remain readable in all three modes.
- Focus, selection, disabled state, and errors do not rely on color alone.
- System colors remain visible in contrast mode.
- Active and inactive title-bar states are distinguishable.

## Test 7: Keyboard And Command Behavior

1. Press `Ctrl+K`, type a command name, use arrow keys, and press Enter.
2. Open dialogs and verify Tab, Shift+Tab, Enter, and Escape.
3. Open app-owned context menus from Explorer and tabs, then dismiss them with Escape.
4. Use native File/View commands and compare their state with the command palette.

Expected result:

- Keyboard focus remains visible.
- Modal focus stays within the dialog and returns to the invoking control.
- Escape dismisses menus and dialogs without unintended changes.
- Native commands and command-palette commands produce the same state.

## Test 8: Project Save Location

1. Create a project named `Windows Save Test`.
2. Select Save.
3. Inspect the proposed path before confirming.
4. Save, close, reopen, and save again.

Expected result:

- The default path is under `%USERPROFILE%\Documents\relaystudio`.
- The path uses Windows separators and ends in `.restproj`.
- No `/private/tmp` or other macOS path appears.
- Reopen and subsequent save use the selected Windows path.

## Test 9: Flow Authoring And Execution

1. Create a flow with one request step.
2. Open `Path target` and choose a request marked `(add step)`.
3. Add a success path and repeat for a third request.
4. Configure a response mapping on the first step.
5. Run and save the flow.

Expected result:

- `Path target` is usable when other project requests are not yet flow nodes.
- Selecting `(add step)` creates one node and one edge without duplication.
- Selecting a node shows its actual outgoing path.
- Successful steps run in order, mappings feed later requests, and the saved project reloads with the same graph.

## Evidence Package

Store evidence under `audits/windows-2026-07-10/evidence` using the names documented in its `README.md`. Do not include credentials, access tokens, or unredacted secret values.

## Pass Criteria

Sprint 10B-3 passes when:

- The PowerShell build gate and packaged installer succeed.
- Tests 1, 2, 7, 8, and 9 pass.
- Small, medium, and large layouts have no blocking overlap or inaccessible commands.
- Light mode passes; dark and contrast findings are either passed or explicitly tracked with severity and rationale.
- Every failed high-priority finding is fixed in Sprint 10B-3 or recorded in the bounded audit with an owner and target sprint.

