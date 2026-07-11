# Platform Guidelines Compliance Backlog

Date: July 1, 2026

## Purpose

Convert the current Apple and Windows design-guideline findings into an implementation backlog that can be scheduled and verified.

This backlog is intentionally split into:

- `Shared` work that improves both desktop platforms.
- `macOS` work that must align with Apple desktop expectations.
- `Windows` work that must align with current Windows app guidance.

## Evidence Basis

Apple basis:

- `documentation` review target: `https://developer.apple.com/design/human-interface-guidelines/designing-for-macos`
- current app evidence: [../audits/apple-hig-2026-06-30/relay-studio-macos-hig-audit.md](../audits/apple-hig-2026-06-30/relay-studio-macos-hig-audit.md)

Windows basis:

- [Design Windows apps overview](https://learn.microsoft.com/en-us/windows/apps/design/)
- [Design principles](https://learn.microsoft.com/en-us/windows/apps/design/design-principles)
- [Design guidelines overview](https://learn.microsoft.com/en-us/windows/apps/design/guidelines-overview)
- [Commanding basics](https://learn.microsoft.com/en-us/windows/apps/design/basics/commanding-basics)
- [Navigation basics](https://learn.microsoft.com/en-us/windows/apps/design/basics/navigation-basics)
- [Windows app title bar](https://learn.microsoft.com/en-us/windows/apps/design/basics/titlebar-design)
- [Layout overview](https://learn.microsoft.com/en-us/windows/apps/design/layout/)
- [Screen sizes and breakpoints](https://learn.microsoft.com/en-us/windows/apps/design/layout/screen-sizes-and-breakpoints-for-responsive-design)
- [Writing style](https://learn.microsoft.com/en-us/windows/apps/design/style/writing-style)

Boundaries used for this plan:

- Windows review only followed the requested overview pages and one level of linked guideline pages.
- Apple guidance is represented by the cited HIG entry point plus the existing June 30, 2026 app audit.

## Current Gaps

The current Relay Studio desktop shell still has six platform-level gaps:

1. Command structure is not native enough on either platform.
2. Sidebar/navigation areas mix too many responsibilities.
3. Inspector and flow details duplicate context and reduce usable workspace.
4. Title bar, menu, and window-management behavior are under-specified across platforms.
5. Responsive and accessibility behavior is not yet verified against explicit Windows breakpoint classes and platform-specific desktop behaviors.
6. Placeholder and error copy do not yet meet desktop-quality expectations.

## Success Criteria

This work is successful only when all of the following are true:

- macOS users get standard document-app menu structure, discoverable settings, predictable save prompts, and native-feeling sidebar/toolbar behavior.
- Windows users get correct title bar behavior, clear command surfaces, breakpoint-safe layouts, and writing that matches Fluent guidance.
- Shared workbench surfaces avoid duplicated context and preserve the request editor and flow canvas as the primary work areas.
- Platform-specific affordances do not fork the core request and flow editor logic.
- Automated tests and human QA can prove the behavior repeatedly on both platforms.

## Failure Modes To Avoid

- Building one generic shell that is acceptable nowhere.
- Hardcoding macOS assumptions into the Windows shell, or vice versa.
- Adding more toolbar buttons instead of clarifying command hierarchy.
- Leaving placeholder Settings and undocumented chrome decisions in place.
- Shrinking controls further to gain space without solving information architecture.
- Letting platform polish bypass keyboard, accessibility, and resize behavior.

## Backlog Structure

This backlog is grouped into four execution phases that can map into upcoming sprints.

### Phase 1: Shell Contract

Goal:
Define the shared shell model and platform overrides before more UI polish work lands.

#### Shared

1. Create a shell contract for menus, toolbar actions, view toggles, inspector modes, dock visibility, and document lifecycle actions.
   Acceptance criteria:
   - A single documented source of truth exists for command IDs, labels, enablement rules, shortcuts, and intended surfaces.
   - Request tabs, flow tabs, welcome, and settings each define which primary actions are visible and enabled.
   - Save, Save As, Close Tab, Close Window, and project-switch behavior all route through one dirty-state policy.

2. Define a platform-adapter boundary for shell chrome.
   Acceptance criteria:
   - Shared editor/workbench content can render independently of platform-specific menu or title bar code.
   - macOS-only menu behavior and Windows-only title bar behavior do not change service editor or flow editor business logic.

#### macOS

3. Add native macOS document-app menu structure.
   Acceptance criteria:
   - `File`, `Edit`, `View`, `Window`, and `Help` menus exist.
   - Project/document actions are no longer hidden in the app menu.
   - `Cmd+S`, `Cmd+Shift+S`, `Cmd+,`, and view-toggle shortcuts are wired and visible in menus.

#### Windows

4. Define Windows title bar and command model.
   Acceptance criteria:
   - The Windows shell specifies which controls live in the title bar, toolbar, overflow menus, and context menus.
   - Title bar drag regions and interactive regions are explicitly defined.
   - Window caption controls remain visible and unobstructed at supported widths.

### Phase 2: Information Architecture And Command Surfaces

Goal:
Reduce clutter and make the workbench easier to scan and operate.

#### Shared

5. Simplify explorer responsibilities.
   Acceptance criteria:
   - Explorer is limited to project structure and related navigation.
   - Recent Projects is moved out of the primary project tree.
   - Transient status is moved to a status bar, toast, or other non-navigation surface.

6. Make toolbar actions state-aware and non-duplicative.
   Acceptance criteria:
   - Request tabs show request-centric primary actions only.
   - Flow tabs show flow-centric primary actions only.
   - Welcome and Settings do not show irrelevant run/send actions.
   - Destructive and infrequent actions are moved off the main toolbar when they do not support a primary workflow.

7. Reduce duplicate context between inspector and flow details.
   Acceptance criteria:
   - The same request summary is not shown in multiple panes at once unless there is a clear reason.
   - Flow canvas retains more usable horizontal space when a step is selected.
   - Inspector content changes meaningfully by editor type rather than acting as a static dump.

#### macOS

8. Align sidebar and settings behavior with desktop document-app expectations.
   Acceptance criteria:
   - Settings is either fully implemented or removed from visible navigation until implemented.
   - Open Recent is discoverable in the menu model.
   - Sidebar content feels like navigation, not a mixed control panel.

#### Windows

9. Align command surfaces with Windows commanding guidance.
   Acceptance criteria:
   - Frequent commands are available on-canvas or on the primary command surface.
   - Secondary commands are grouped into menus, context menus, or overflow surfaces.
   - Confirmation dialogs are used only for high-consequence actions; undo is favored where practical.

### Phase 3: Platform Chrome, Layout, And Writing

Goal:
Make the shell behave like a first-class desktop app on each platform.

#### Shared

10. Replace placeholder and weak copy with production-quality desktop text.
    Acceptance criteria:
    - Placeholder Settings text is removed.
    - Error messages are concise, action-oriented, and do not blame the user.
    - Button labels are short, direct verbs or verb phrases.

11. Add dialog behavior standards.
    Acceptance criteria:
    - Dialogs have consistent primary/secondary action ordering per platform.
    - Escape closes where appropriate.
    - Focus trap, initial focus, and focus return are defined and tested.

12. Finish cross-platform context menu behavior.
    Acceptance criteria:
    - Requests, flows, tabs, recent projects, mappings, and flow edges use app-defined context menus.
    - Browser-native context menus are suppressed outside editable text fields.

#### macOS

13. Improve macOS workspace behavior and menu-backed view toggles.
    Acceptance criteria:
    - Sidebar, inspector, response dock, and flow details can be toggled from `View`.
    - Save prompts and tab/window closing feel consistent with a document-based Mac app.
    - Toolbar and sidebar no longer appear to compete with the menu bar for primary command ownership.

#### Windows

14. Implement Windows title bar, breakpoint, and visual-behavior expectations.
    Acceptance criteria:
    - Title bar height and behavior are correct for the chosen Windows shell approach.
    - If search or tabs occupy title bar space, caption controls remain correctly anchored and usable.
    - The shell behaves correctly at Windows size classes:
      - Small: under 640px
      - Medium: 641px to 1007px
      - Large: 1008px and above
    - Layout measurements use stable effective-pixel spacing rather than ad hoc pixel values.

15. Add Windows appearance support.
    Acceptance criteria:
    - Light and dark modes render correctly.
    - High contrast is supported for shell chrome and command surfaces.
    - Active/inactive title bar states are visually distinguishable.

### Phase 4: Verification And Release Gates

Goal:
Make the platform work enforceable rather than subjective.

#### Shared

16. Add automated platform-shell regression coverage where the current harness can support it.
    Acceptance criteria:
    - Dialog keyboard behavior is covered by tests.
    - View toggle state, pane persistence, and dirty-state flows are covered by tests.
    - Context menu coverage exists for the main object types.

17. Add platform-focused human QA scripts.
    Acceptance criteria:
    - A macOS shell QA script exists for menus, settings, save prompts, and view toggles.
    - A Windows shell QA script exists for title bar, caption controls, breakpoints, contrast, and keyboard behavior.

    Status (2026-07-10): Complete. The macOS script is `documentation/sprint-10b-2-macos-qa-script.md`; the Windows script is `documentation/sprint-10b-3-windows-qa-script.md`.

#### macOS

18. Re-run a macOS HIG audit against the updated desktop app.
    Acceptance criteria:
    - High-priority findings from the June 30, 2026 audit are either resolved or explicitly deferred with rationale.
    - New evidence is captured from the actual running macOS app.

#### Windows

19. Perform a bounded Windows desktop audit after implementation.
    Acceptance criteria:
    - The review confirms progress against commanding, navigation, title bar, layout, and writing guidance.
    - High-priority Windows findings are tracked as backlog items if they are not closed in the same sprint.

    Status (2026-07-11): Implemented and closed in `audits/windows-2026-07-10/relay-studio-windows-desktop-audit.md`. Installer, save-path, flow-authoring, response-action, and close-lifecycle findings are closed after packaged Windows testing. Additional breakpoint and high-contrast screenshots move to Sprint 11 release-gate evidence hardening.

## Suggested Sprint Mapping

This is the recommended mapping onto upcoming work rather than a hard requirement.

### Sprint 9A: Platform Shell Contract

- Shared backlog items 1, 2
- macOS backlog item 3
- Windows backlog item 4

Exit criteria:

- Command ownership, menu structure, title bar ownership, and dirty-state routes are documented and approved before more shell polish lands.

### Sprint 9B: Navigation And Command Surfaces

- Shared backlog items 5, 6, 7
- macOS backlog item 8
- Windows backlog item 9
- Implementation status: see `sprint-9b-implementation-status.md`.

Exit criteria:

- Explorer, toolbar, inspector, and flow details stop competing for the same information and actions.

### Sprint 10A: Platform Chrome And Text

- Shared backlog items 10, 11, 12
- macOS backlog item 13
- Windows backlog items 14, 15

Exit criteria:

- Platform shell behavior, writing quality, and contrast/title bar behavior are production-ready for internal review.

### Sprint 10B: Verification And Audit Closure

- Shared backlog items 16, 17
- macOS backlog item 18
- Windows backlog item 19

Exit criteria:

- Both desktop platforms have audit evidence, QA scripts, and repeatable regression checks.

## Priority Order

Implement in this order unless a platform blocker forces a change:

1. Shared shell contract and dirty-state parity
2. macOS menus and Settings correction
3. Windows title bar and breakpoint contract
4. Explorer and toolbar simplification
5. Inspector/details deduplication
6. Dialog and context menu correctness
7. Writing, high contrast, dark mode, and verification closure

## Delivery Notes

- Do not start another density pass until command ownership and navigation structure are fixed.
- Do not ship a visible Settings entry that still resolves to placeholder copy.
- Do not treat browser-only behavior as sufficient evidence for native menu, title bar, or window management requirements.
- Prefer small platform-specific shell layers over duplicated request/flow editor implementations.
