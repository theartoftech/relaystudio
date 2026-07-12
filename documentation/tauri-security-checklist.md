# Relay Studio Tauri Security Checklist

Date: 2026-07-12

## Scope

This checklist reviews the Sprint 13 Tauri desktop security boundary: webview content policy, capabilities, filesystem access, registered commands, updater behavior, transport, and window permissions.

## Review

| Area | Result | Evidence and decision |
| --- | --- | --- |
| Content Security Policy | Pass after hardening | `src-tauri/tauri.conf.json` now enables an explicit CSP. Scripts and default content are self-only. Inline styles remain allowed because the current React/Tauri presentation requires them. HTTP(S) connections and images remain allowed because Relay Studio is a user-directed REST client. Remote scripts and frames are not allowed. |
| Capability selection | Pass | `app.security.capabilities` explicitly selects only `default`; capability auto-discovery cannot silently expand the build boundary. |
| Window scope | Pass | The capability applies only to the `main` window label. No wildcard window or remote URL capability exists. |
| Core permissions | Pass with rationale | `core:default` supports the shipped Tauri shell. Window close and destroy are required for the tested dirty-close lifecycle. No create-window, shell, process, clipboard, notification, global-shortcut, or updater permission is granted. |
| Dialog permissions | Pass | Only `dialog:allow-open` is granted. Native save paths are handled by application commands; no broad filesystem plugin permission exists. |
| Filesystem access | Pass with application-level scope | The filesystem plugin is not exposed to the webview. Rust commands validate `.restproj` and saved-response paths and schemas before operations. Project commands remain intentionally user-path-based for a desktop REST workspace. |
| Command exposure | Pass with tracked residual risk | Sixteen registered commands are available only to bundled application code. Inputs are typed and path/schema validation is covered by Rust tests. Tauri 2 allows registered application commands by default; future remote webview content or additional windows must not be introduced without command-level ACL work. |
| HTTP transport | Pass with rationale | Network execution is implemented in Rust with `reqwest` and rustls. The REST client must support user-selected HTTP(S) endpoints. Credentials are redacted before diagnostics and persistence. Plain HTTP remains an explicit product capability and user risk, not a silent fallback. |
| Updater | Pass / not enabled | No updater plugin, endpoint, public key, or updater capability is configured. Sprint 14 must review signing and authenticated update configuration before enabling updates. |
| External content | Pass | No remote script source, remote capability URL, iframe permission, or CDN runtime dependency is configured. |
| Build artifacts | Pass | CI runs repository and generated-artifact secret scanning. Release bundles are included by the local scanner when present. |

## Required Re-Review Triggers

Repeat this checklist before merging any change that:

- Adds a Tauri plugin, command, window, webview, capability, remote URL, sidecar, or updater.
- Broadens CSP sources or adds remote executable content.
- Removes path, schema, or request validation.
- Adds filesystem, shell, process, clipboard, or window-creation permissions.
- Changes secret persistence, export, diagnostics, or transport behavior.

## Known Risks

- `connect-src` permits HTTP(S) because arbitrary REST targets are the core product function. Request validation and the native transport boundary remain the compensating controls.
- `style-src` permits inline styles for the current UI stack. Scripts remain self-only, so this does not authorize inline JavaScript.
- Registered application commands are not individually capability-scoped. They are restricted to bundled code and validated inputs; command ACL generation is a candidate defense-in-depth improvement before remote content or multiple privilege tiers are introduced.
