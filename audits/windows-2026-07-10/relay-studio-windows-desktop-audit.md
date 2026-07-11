# Relay Studio Bounded Windows Desktop Audit

Date: 2026-07-10

## Scope

This audit covers the Sprint 10B Windows desktop shell after Windows installer testing and the follow-up packaging, close-lifecycle, save-path, and flow-authoring fixes.

Reviewed areas:

1. Windows packaging and installer handoff
2. Title bar and caption controls
3. Commanding and navigation surfaces
4. Small, medium, and large window layouts
5. Light, dark, and high-contrast appearance
6. Dirty close and project persistence
7. Keyboard and app-owned context menus
8. Flow authoring and execution

Primary guidance:

- Microsoft Windows app design: https://learn.microsoft.com/windows/apps/design/
- Commanding: https://learn.microsoft.com/windows/apps/design/controls/commanding-basics
- Navigation: https://learn.microsoft.com/windows/apps/design/basics/navigation-basics
- Title bar: https://learn.microsoft.com/windows/apps/develop/title-bar
- High contrast: https://learn.microsoft.com/windows/apps/design/accessibility/high-contrast-themes

This is a bounded desktop audit, not a complete WCAG review or Windows App Certification Kit submission.

## Evidence Basis And Limits

Confirmed evidence:

- Windows machine build and visual smoke test were completed by the project owner.
- The missing `.ico` packaging failure was reproduced and fixed by declaring the Tauri bundle icons.
- The Windows default project path defect was reproduced and fixed to use the user's Documents directory.
- Windows executable issues were fixed in commit `f129bea`.
- Shared automated gates and Rust tests passed on macOS after the cross-platform changes.
- The flow target fix was exercised end to end against the packaged macOS app and is covered by platform-neutral tests.

Evidence limitations:

- Durable Windows screenshots and redacted PowerShell output have not all been checked into `evidence`.
- Exact Windows build number, display scale, breakpoint measurements, dark mode, and contrast-theme results were not fully recorded in the repository.
- Findings that depend on those states are closed for Sprint 10B-3 based on Windows tester validation, with additional evidence hardening carried forward as release-gate work.

## Disposition

| Priority | Area | Status | Evidence | Disposition |
| --- | --- | --- | --- | --- |
| High | Installer build | Closed | Windows build report; `tools/windows-build-installer.ps1`; Tauri icon config | Missing `.ico` blocked packaging. Bundle icons are now declared and the Windows build produced a usable app. |
| High | Project save path | Closed | Reported Windows defect; native path tests | Windows now proposes `%USERPROFILE%\Documents\relaystudio\<project>.restproj` instead of `/private/tmp`. |
| High | Clean and dirty Close behavior | Closed | Tauri lifecycle tests and Windows executable follow-up | Native close permission, dirty-work interception, and File > Exit behavior were updated after Windows testing. |
| High | Caption controls unobstructed | Closed | Project-owner Windows smoke test | No blocking overlap was reported during packaged Windows testing. Capture active/inactive screenshots during release-gate evidence hardening. |
| High | Small/medium/large breakpoints | Closed for Sprint 10B-3 | Project-owner Windows testing | No blocking breakpoint defect remains for Sprint 10B-3. Add durable small/medium/large screenshots during Sprint 11 release-gate evidence hardening. |
| High | High contrast | Closed for Sprint 10B-3 | Project-owner Windows testing | No release-blocking contrast defect remains for Sprint 10B-3. Add durable high-contrast evidence during Sprint 11 release-gate hardening. |
| Medium | Dark mode | Follow-up | No dark-mode evidence checked in | Track non-blocking palette polish and durable screenshots in Sprint 11 release-gate work. |
| Medium | Keyboard focus and modal traversal | Closed | Shared automated regression coverage and packaged Windows testing | Dialog focus, Escape, context-menu dismissal, and close lifecycle are covered in the shared harness and were exercised in packaged Windows follow-up testing. |
| Medium | Commanding and navigation | Closed for current scope | Sprint 9B/10A implementation and Windows smoke test | Explorer owns project navigation; command palette and menus own global commands; primary request/flow actions remain contextual. |
| Medium | Flow Path Target | Closed | Automated flow regressions and packaged-app live run | A project request can be selected as `(add step)`, creating one node and path atomically; selected-node path details stay synchronized. |

## Progress Against Windows Guidance

### Commanding

Primary request and flow execution commands are contextual. Global and secondary actions remain available through menus and command search. Destructive flow actions are visually separated. Shared tests cover state synchronization and menu dismissal.

### Navigation

Explorer contains project-owned requests, flows, environments, variables, and saved responses. Recent projects and transient status are no longer mixed into the tree. Tabs preserve open work while Settings and saved responses use distinct editor states.

### Title Bar

The shell reserves caption-control space and uses native window lifecycle handling. The Windows smoke test did not report blocking title-bar problems. Durable active, inactive, restored, maximized, and narrow-width evidence is still required before this item is considered fully evidenced.

### Layout

The app has explicit small, medium, and large behavior and optional-pane toggles. Shared visual and component tests reduce regression risk, but effective-pixel behavior must be confirmed on Windows at the three defined width classes and at common display scales.

### Writing

Placeholder Settings text was replaced with action-oriented labels. Dirty close, save, request, and flow messages identify the action and outcome without blaming the user. Error copy remains concise and specific.

## Sprint 10B-3 Closure

Sprint 10B-3 is closed after packaged Windows validation and follow-up fixes. Release-gate evidence hardening should still capture:

- Windows version/build, display scale, commit, and installer artifact.
- Pass/fail results for Tests 1-9.
- Required screenshots or a documented reason a screenshot is unavailable.
- A backlog entry for every failed high-priority test.

## Recommendation

Move into Sprint 11 release-gate work. Keep using `documentation/sprint-10b-3-windows-qa-script.md` as the packaged-Windows regression script when validating future Windows builds, and attach any new evidence under this audit folder or the Sprint 11 evidence folder.
