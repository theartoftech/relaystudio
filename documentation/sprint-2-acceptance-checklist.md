# Sprint 2 Acceptance Checklist

## Purpose

This checklist converts Sprint 1 design decisions into concrete acceptance criteria for the Sprint 2 desktop foundation.

## Shell Layout

- App launches locally on macOS through the selected Tauri development workflow.
- Initial screen reads as Relay Studio without relying on external documentation.
- Shell includes a desktop title or command bar.
- Shell includes command search or command palette access.
- Shell includes environment selector.
- Shell includes primary project/save/run actions.
- Shell includes left activity rail or primary sidebar.
- Shell includes project explorer pane.
- Shell includes tab strip.
- Shell includes central editor region.
- Shell includes right inspector pane.
- Shell includes bottom response dock region.
- Shell includes bottom console dock or console tab region.
- Desktop layout shows project context, request editing, inspection, response evidence, and console transparency together at normal desktop widths.

## Visual Target

- Navy application chrome is used for primary shell identity.
- Royal blue is used for selected states and primary actions.
- Silver and cool gray are used for pane dividers, borders, inactive tabs, and table lines.
- Error red is reserved for specific errors.
- UI typography is compact, with ordinary UI text in the 13-15px range.
- Monospace typography is used for JSON, headers, variables, and console output.
- The layout uses split panes, row separators, tabs, docks, and inspectors instead of card-heavy dashboard composition.
- The Windows ribbon is not required for Sprint 2, but command grouping must leave room for a future ribbon or platform-specific command surface.

## Navigation And Tabs

- Activity/sidebar entries exist for Projects, Services, Runner, Flows, Saved Responses, and Settings.
- Active primary area is visually clear.
- Explorer supports empty project state and populated sample state.
- Tab strip supports active, inactive, closeable, and dirty visual states.
- Welcome, request, flow, saved response, import, and settings tab types have placeholder routes or views.
- Command palette can be opened with `Cmd/Ctrl+K` or has a visible placeholder if keyboard handling is deferred.

## Request Workbench Placeholder

- Request composer includes method selector, URL input, and Send Request button.
- Request editor includes Authorization, Headers, Query Params, Path Params, Body, Retry, Tests, Settings, and script-related tab placeholders.
- Authorization placeholder shows generated request header preview with masked token value.
- Body placeholder supports JSON-looking editor surface.
- Inspector can show request properties, variables, authorization summary, and environment state.

## Response And Console Placeholder

- Response dock includes status, timing, size, saved response action, and Pretty/Raw/Preview-style tabs.
- Console dock includes event filter, timestamps toggle or equivalent, clear action, and export log placeholder.
- Empty response state is explicit.
- Empty console state is explicit.

## Persistence And Close Hooks

- Window close interception hook exists, even if dirty-state logic is completed in Sprint 3.
- Save Project command exists as a disabled or placeholder action when persistence is not ready.
- Save-on-close prompt route or component placeholder exists for Sprint 3.

## Quality Gates

- TypeScript type check is configured.
- Lint check is configured.
- Unit test harness is configured.
- React component test harness is configured.
- Rust unit test harness is configured if Rust command layer is scaffolded.
- Playwright smoke test opens the app shell.
- Accessibility smoke test verifies keyboard reachability for primary shell areas.
- CI or local verification command runs the configured checks.

## Sprint 2 Exit Criteria

Sprint 2 is complete only when:

- The app shell launches.
- The shell visually matches the approved Sprint 0 references at the structural level.
- The primary route placeholders are reachable.
- The quality gates run.
- The next sprint can implement project persistence without restructuring the shell.
