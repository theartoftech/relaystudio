# Relay Studio Tauri Security Checklist

Date: 2026-07-20

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
| HTTP transport | Pass after Sprint 18D hardening | Network execution is implemented in Rust with `reqwest` and rustls. Same-origin redirects are followed up to 10 requests; cross-origin redirects stop before any replay, so Authorization, cookies, API keys, and custom credential headers cannot reach an unreviewed origin. Native and browser response bodies are capped at 5 MiB before formatting or IPC. Native responses report final URL identity and visible UI diagnostics expose only the final origin. Plain HTTP remains an explicit product capability and user risk, not a silent fallback. |
| Browser-development transport | Pass after Sprint 18B hardening | Browser Fetch uses manual redirect mode and rejects every redirect before replay. Developers must enter the final URL explicitly or use desktop mode for validated same-origin redirects. |
| Proxy bypass | Pass after Sprint 18B hardening | Enabled proxy settings apply an explicit Reqwest `NoProxy` list. Comma-separated domains, IP addresses, and valid CIDR ranges are accepted. URL schemes, port-specific entries, wildcard labels other than `*`, malformed domains, and invalid CIDR prefixes fail actionably instead of being ignored. |
| OpenAPI destinations | Pass after Sprint 18B hardening | Direct definitions and external references revalidate the actual final origin. Swagger UI discovery retrieves only the page, displays a credential-free resolved destination, and requires a separate Load action; Cancel performs no secondary request. Credential userinfo and literal sensitive query values are rejected before display or retrieval, while `{{variable}}` query placeholders remain supported. |
| Multipart file authority | Pass after Sprint 18C hardening | Project export removes local multipart paths. A legacy/imported in-memory path remains unarmed until the user approves the exact file path for the current destination origin; changing the path, service, field, origin, project, or application session invalidates approval before native send. |
| Saved-response files | Pass after Sprint 18C hardening | Both `.json` and `.txt` saves are self-describing Relay artifacts. Native and browser readers reject legacy raw text with recovery guidance, validate format/schema/body, and require the artifact's embedded path to match approved project metadata. |
| Persistence and redaction | Pass after Sprint 18D hardening | Full nested schema-v1 project state is validated with field paths before use. Project reads/writes are capped at 4 MiB, flow runtime captures remain ephemeral, and shared classification covers API-key spelling variants, URL userinfo/query values, form/parameter rows, saved artifacts, diagnostics, comparisons, flow captures, and normalized errors before output is declared redacted. |
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
- Cross-origin redirects are intentionally rejected instead of prompting or stripping selected headers. A developer who trusts the destination must enter its final URL explicitly.
