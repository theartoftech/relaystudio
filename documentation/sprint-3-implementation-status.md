# Sprint 3 Implementation Status

## Status

Implemented.

Sprint 3 adds versioned local project persistence, native `.restproj` file handling through the Tauri command layer, browser-preview fallback persistence, dirty-state UI, save/open dialogs, recent projects, save-on-close routing, and overwrite confirmation for Save As.

## Delivered

- Versioned project model in `src/project/projectModel.ts`.
- Project persistence adapter in `src/project/projectPersistence.ts`.
- Browser fallback persistence for Vite preview and React tests.
- Tauri commands for:
  - `save_project_file`
  - `open_project_file`
  - `project_file_exists`
  - `list_recent_projects`
  - `remember_recent_project`
- Plain JSON project files with format and schema metadata.
- Safe save path using temporary writes plus `.bak` backup creation before replacing an existing project file.
- Recoverable error messages for missing files, corrupt files, invalid extensions, unsupported format, and unsupported schema versions.
- Recent projects storage under the user's home directory for native builds.
- Project save/open dialogs with `.restproj` path validation.
- Save As overwrite confirmation before replacing an existing project.
- Dirty project indicator in the shell and explorer.
- Save-on-close prompt with Save And Continue, Do Not Save, and Cancel.

## Verification

- `npm run verify`: passed.
- `cargo fmt --check`: passed.
- `cargo test`: passed.
- `npm run test:e2e`: passed.
- `npm audit --audit-level=moderate`: passed, 0 vulnerabilities.

## Test Coverage Added

- Browser fallback `.restproj` round trip.
- Browser fallback recent-project tracking.
- Browser fallback project-exists check.
- Toolbar save dialog behavior.
- UI save flow through browser fallback persistence.
- Save As overwrite confirmation behavior.
- Native project file round trip.
- Native legacy password-protected file rejection.
- Native corrupted-file rejection.

## Deferred

- Native OS file picker integration. Sprint 3 uses path-entry dialogs so the persistence behavior is testable now; native picker polish can be added with platform menu work.
- Full edit-surface dirty tracking. Sprint 3 wires the dirty-state infrastructure and prompt behavior; later editable service, variable, import, response, and flow surfaces should call the same dirty-state path when they become mutable.
- Permission-denied fixture automation. The command layer reports permission errors, but the automated suite currently covers round trip, corruption, existence, recents, and overwrite confirmation.
