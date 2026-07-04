export async function openNativeProjectFilePicker(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    title: "Open Project",
    multiple: false,
    filters: [
      {
        name: "Relay Studio Project",
        extensions: ["restproj"]
      }
    ]
  });

  if (Array.isArray(selected)) {
    return selected[0] ?? null;
  }
  return selected;
}
