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

- Durable Windows screenshots and redacted PowerShell output have not yet been checked into `evidence`.
- Exact Windows build number, display scale, breakpoint measurements, dark mode, and contrast-theme results were not recorded in the repository.
- Findings that depend on those states remain open or conditionally accepted below; this audit does not silently infer a pass.

## Disposition

| Priority | Area | Status | Evidence | Disposition |
| --- | --- | --- | --- | --- |
| High | Installer build | Closed | Windows build report; `tools/windows-build-installer.ps1`; Tauri icon config | Missing `.ico` blocked packaging. Bundle icons are now declared and the Windows build produced a usable app. |
| High | Project save path | Closed | Reported Windows defect; native path tests | Windows now proposes `%USERPROFILE%\Documents\relaystudio\<project>.restproj` instead of `/private/tmp`. |
| High | Clean and dirty Close behavior | Closed by implementation; Windows evidence pending | Tauri lifecycle tests and Windows executable follow-up | Native close permission and dirty-work interception are implemented. Capture `06-dirty-close.png` in the next Windows evidence run. |
| High | Caption controls unobstructed | Conditionally accepted | Project-owner Windows smoke test | No blocking overlap was reported, but active/inactive and narrow-width screenshots are still required for durable closure. |
| High | Small/medium/large breakpoints | Open verification item | No durable Windows breakpoint evidence | Run Tests 3-5 in the 10B-3 script. Any blocking overlap is a release blocker; otherwise attach screenshots and close. Owner: Windows QA tester. Target: 10B-3 closure. |
| High | High contrast | Open verification item | No contrast-theme evidence | Run Test 6 and attach `08-high-contrast.png`. Unreadable commands, focus, or errors are release blockers. Owner: Windows QA tester. Target: 10B-3 closure. |
| Medium | Dark mode | Open verification item | No dark-mode evidence | Run Test 6 and attach `07-dark-mode.png`. Track non-blocking palette polish separately. |
| Medium | Keyboard focus and modal traversal | Partially closed | Shared automated regression coverage | Dialog focus, Escape, and context-menu dismissal are covered in the shared harness. Complete packaged-Windows keyboard QA with Test 7. |
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

## High-Priority Closure Rule

The remaining breakpoint and high-contrast items are tracked in this audit rather than marked passed without evidence. Sprint 10B-3 can be administratively closed only after the Windows QA record contains:

- Windows version/build, display scale, commit, and installer artifact.
- Pass/fail results for Tests 1-9.
- Required screenshots or a documented reason a screenshot is unavailable.
- A backlog entry for every failed high-priority test.

## Recommendation

Use `documentation/sprint-10b-3-windows-qa-script.md` for the final packaged-Windows evidence run. If breakpoint and contrast tests pass, append the test record and evidence filenames to this audit and mark the two open high-priority verification items closed. If either fails, keep Sprint 10B-3 open for the blocking correction and do not begin Sprint 11 implementation.

