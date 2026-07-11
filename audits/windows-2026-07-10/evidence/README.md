# Windows Audit Evidence Index

Capture evidence from the packaged Windows application, not a browser build. Redact credentials, tokens, usernames, local network details, and project secrets.

Recommended files:

| File | Required state |
| --- | --- |
| `01-large-shell.png` | Large restored window with Explorer, request editor, and Response Dock visible |
| `02-small-shell.png` | Window below 640 effective pixels with primary commands still reachable |
| `03-medium-flow.png` | Medium-width flow editor with Flow Details visible |
| `04-title-bar-active.png` | Active title bar and caption controls |
| `05-title-bar-inactive.png` | Inactive title bar and caption controls |
| `06-dirty-close.png` | Unsaved-changes prompt opened by the Windows Close caption button |
| `07-dark-mode.png` | Main shell in Windows dark app mode |
| `08-high-contrast.png` | Main shell with a Windows contrast theme enabled |
| `09-save-path.png` | Save dialog showing a path under `%USERPROFILE%\Documents\relaystudio` |
| `10-flow-success.png` | Three-step saved flow with successful execution state |
| `windows-build-output.txt` | Redacted output from `tools/windows-build-installer.ps1` |

If a state cannot be captured, record the reason in the audit instead of substituting evidence from another platform.

