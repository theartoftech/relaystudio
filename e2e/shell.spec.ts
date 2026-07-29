import { expect, test, type Page } from "@playwright/test";

async function openRecentProject(page: Page, name: RegExp): Promise<void> {
  await page.getByRole("button", { name: /Search commands/i }).click();
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("button", { name: /Open Recent Projects/i }).click();
  await page.getByRole("dialog", { name: "Open Recent Projects" }).getByRole("button", { name }).click();
}

test("renders the Relay Studio desktop shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Relay Studio desktop shell")).toBeVisible();
  await expect(page.getByLabel("Project explorer")).toBeVisible();
  await expect(page.getByLabel("Workbench")).toBeVisible();
  await expect(page.getByLabel("Response and console dock")).toBeVisible();
  await expect(page.getByLabel("Primary navigation")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Inspector" })).toHaveCount(0);
  await expect(page.getByLabel("Project explorer").getByLabel("Requests")).toBeVisible();
  await expect(page.getByPlaceholder("Search projects and requests")).toBeVisible();

  await page.getByRole("button", { name: "Show inspector" }).click();
  await expect(page.getByRole("complementary", { name: "Inspector" })).toBeVisible();
});

test("opens a same-origin JSON response link as an authorized GET request", async ({ page }) => {
  const profileUrl = "https://api.example.com/api/profile/contacts?projection=summary";
  await page.route("https://api.example.com/api/orders", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ _links: { profile: { href: profileUrl } } })
  }));
  await page.goto("/");

  await page.getByRole("button", { name: "Send Request" }).click();
  const responseLink = page.getByRole("link", { name: `Create GET request for ${profileUrl}` });
  await expect(responseLink).toBeVisible();
  await responseLink.focus();
  await responseLink.press("Enter");

  await expect(page.getByRole("tab", { name: /GET \/api\/profile\/contacts/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Request method")).toHaveValue("GET");
  await expect(page.getByLabel("Request URL")).toHaveValue(profileUrl);
  await expect(page.getByLabel("Authorization type")).toHaveValue("bearer");
  await expect(page.getByLabel("Bearer token variable name")).toHaveValue("accessToken");
});

test("opens inspector immediately at narrower desktop widths", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");

  await page.getByRole("button", { name: "Show inspector" }).click();

  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByRole("button", { name: "Hide inspector" })).toBeVisible();
  await expect(inspector.getByText("Variables")).toBeVisible();
});

test("uses compact desktop density at common workbench sizes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.locator(".project-explorer")).toBeVisible();
  await expect(page.locator(".top-command-bar")).toBeVisible();
  await expect(page.locator(".tab-strip")).toBeVisible();
  await expect(page.locator(".request-row input")).toBeVisible();
  await expect(page.locator(".bottom-dock")).toBeVisible();
  await expect(page.locator(".primary-command")).toBeVisible();
  await expect(page.locator(".utility-header nav button").first()).toBeVisible();

  const measurements = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".app-shell");
    const explorer = document.querySelector<HTMLElement>(".project-explorer");
    const commandBar = document.querySelector<HTMLElement>(".top-command-bar");
    const tabStrip = document.querySelector<HTMLElement>(".tab-strip");
    const requestInput = document.querySelector<HTMLElement>(".request-row input");
    const bottomDock = document.querySelector<HTMLElement>(".bottom-dock");
    const primaryCommand = document.querySelector<HTMLElement>(".primary-command");
    const utilityButton = document.querySelector<HTMLElement>(".utility-header nav button");
    if (!shell || !explorer || !commandBar || !tabStrip || !requestInput || !bottomDock || !primaryCommand || !utilityButton) {
      throw new Error("Required workbench density elements were not rendered.");
    }
    return {
      explorerWidth: Math.round(explorer.getBoundingClientRect().width),
      commandBarHeight: Math.round(commandBar.getBoundingClientRect().height),
      tabStripHeight: Math.round(tabStrip.getBoundingClientRect().height),
      requestInputHeight: Math.round(requestInput.getBoundingClientRect().height),
      bottomDockHeight: Math.round(bottomDock.getBoundingClientRect().height),
      primaryButtonFontSize: Number.parseFloat(getComputedStyle(primaryCommand).fontSize),
      utilityButtonFontSize: Number.parseFloat(getComputedStyle(utilityButton).fontSize),
      fontFamily: getComputedStyle(shell).fontFamily
    };
  });

  expect(measurements.explorerWidth).toBeLessThanOrEqual(302);
  expect(measurements.commandBarHeight).toBeLessThanOrEqual(45);
  expect(measurements.tabStripHeight).toBeLessThanOrEqual(37);
  expect(measurements.requestInputHeight).toBeLessThanOrEqual(33);
  expect(measurements.bottomDockHeight).toBeLessThanOrEqual(246);
  expect(measurements.primaryButtonFontSize).toBeLessThanOrEqual(12);
  expect(measurements.utilityButtonFontSize).toBeLessThanOrEqual(12);
  expect(measurements.fontFamily).toContain("system-ui");
});

test("keeps compact flow controls aligned and visible at 1180x820", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");

  await page.getByRole("tab", { name: /Authenticated Read/i }).click();

  const toolbar = page.locator(".flow-toolbar");
  await expect(toolbar).toBeVisible();
  await expect(toolbar.getByLabel("Add request step")).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Add Step" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Reset Layout" })).toBeVisible();

  const geometry = await page.evaluate(() => {
    const toolbarElement = document.querySelector<HTMLElement>(".flow-toolbar");
    const select = document.querySelector<HTMLElement>(".flow-toolbar select");
    const addButton = document.querySelector<HTMLButtonElement>(".flow-toolbar button[aria-label='Add Step']");
    if (!toolbarElement || !select || !addButton) {
      throw new Error("Flow toolbar elements were not rendered.");
    }
    const toolbarBox = toolbarElement.getBoundingClientRect();
    const selectBox = select.getBoundingClientRect();
    const addBox = addButton.getBoundingClientRect();
    return {
      toolbarHeight: Math.round(toolbarBox.height),
      selectMidpoint: Math.round(selectBox.top + selectBox.height / 2),
      addButtonMidpoint: Math.round(addBox.top + addBox.height / 2),
      addButtonWidth: Math.round(addBox.width),
      addButtonFontSize: Number.parseFloat(getComputedStyle(addButton).fontSize),
      overflow: toolbarElement.scrollWidth - toolbarElement.clientWidth
    };
  });

  expect(geometry.toolbarHeight).toBeLessThanOrEqual(56);
  expect(Math.abs(geometry.selectMidpoint - geometry.addButtonMidpoint)).toBeLessThanOrEqual(3);
  expect(geometry.addButtonWidth).toBeLessThanOrEqual(34);
  expect(geometry.addButtonFontSize).toBeLessThanOrEqual(12);
  expect(geometry.overflow).toBeLessThanOrEqual(12);
});

test("opens command palette and import placeholder", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Search commands/i }).click();
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Import API Docs" }).click();
  await expect(page.getByRole("tab", { name: /Import API Docs/i })).toBeVisible();
});

test("inspects Swagger UI and imports only selected REST services", async ({ page }) => {
  let definitionRequests = 0;
  await page.route("https://swagger.test/docs/", (route) => route.fulfill({ contentType: "text/html", body: '<script>SwaggerUIBundle({ url: "./openapi.json" })</script>' }));
  await page.route("https://swagger.test/docs/openapi.json", (route) => {
    definitionRequests += 1;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ openapi: "3.0.4", info: { title: "Selection API" }, servers: [{ url: "https://api.test/v1" }], paths: {
        "/orders": { get: { summary: "List Orders", responses: { "200": { description: "OK" } } }, post: { summary: "Create Order", responses: { "201": { description: "Created" } } } },
        "/health": { get: { summary: "Health Check", responses: { "200": { description: "OK" } } } }
      } })
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Search commands/i }).click();
  await page.getByRole("dialog", { name: "Command palette" }).getByRole("button", { name: "Import API Docs" }).click();
  await page.getByLabel("Swagger UI or definition URL").fill("https://swagger.test/docs/");
  await page.getByRole("button", { name: "Inspect Definition" }).click();
  const destinationReview = page.getByLabel("Swagger UI definition destination review");
  await expect(destinationReview).toContainText("https://swagger.test/docs/openapi.json");
  expect(definitionRequests).toBe(0);
  await destinationReview.getByRole("button", { name: "Cancel" }).click();
  await expect(destinationReview).toHaveCount(0);
  expect(definitionRequests).toBe(0);
  await page.getByRole("button", { name: "Inspect Definition" }).click();
  await expect(destinationReview).toContainText("https://swagger.test/docs/openapi.json");
  await destinationReview.getByRole("button", { name: "Load Discovered Definition" }).click();
  expect(definitionRequests).toBe(1);
  await expect(page.getByText("3 of 3 selected")).toBeVisible();
  await page.getByLabel("Discovered REST services").getByText("Create Order").click();
  await expect(page.getByText("2 of 3 selected")).toBeVisible();
  await page.getByRole("button", { name: "Add 2 Selected" }).click();
  await expect(page.getByRole("button", { name: "GET List Orders" })).toBeVisible();
  await expect(page.getByLabel("Request URL")).toHaveValue("https://api.test/v1/orders");
  await expect(page.getByRole("button", { name: "GET Health Check" }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "POST Create Order" })).toHaveCount(1);
});

test("reviews external references and imports a PATCH form request", async ({ page }) => {
  await page.route("https://swagger.test/openapi.json", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ openapi: "3.1.0", info: { title: "Profiles" }, paths: {
      "/profiles/{id}": { patch: { summary: "Update Profile", requestBody: { $ref: "./forms.yaml#/profile" } } }
    } })
  }));
  await page.route("https://swagger.test/forms.yaml", (route) => route.fulfill({
    contentType: "application/yaml",
    body: "profile:\n  content:\n    application/x-www-form-urlencoded:\n      schema:\n        type: object\n        properties:\n          displayName: { type: string, example: Developer }"
  }));
  await page.goto("/");
  await page.getByRole("button", { name: /Search commands/i }).click();
  await page.getByRole("dialog", { name: "Command palette" }).getByRole("button", { name: "Import API Docs" }).click();
  await page.getByLabel("Swagger UI or definition URL").fill("https://swagger.test/openapi.json");
  await page.getByRole("button", { name: "Inspect Definition" }).click();
  await expect(page.getByLabel("Import review summary")).toContainText("1 external documents");
  await page.getByRole("button", { name: "Add 1 Selected" }).click();
  await expect(page.getByLabel("Request method")).toHaveValue("PATCH");
  await page.getByRole("button", { name: "Body" }).click();
  await expect(page.getByLabel("Body content type")).toHaveValue("application/x-www-form-urlencoded");
  await expect(page.getByLabel("Form Fields name")).toHaveValue("displayName");
  await expect(page.getByLabel("Form Fields value")).toHaveValue("Developer");
});

test("reopened multipart files require current-session approval for the exact destination", async ({ page }) => {
  await page.route("https://swagger.test/upload-openapi.json", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      openapi: "3.1.0",
      info: { title: "Upload API" },
      servers: [{ url: "https://upload.test" }],
      paths: {
        "/assets": {
          post: {
            summary: "Upload Asset",
            requestBody: {
              content: {
                "multipart/form-data": {
                  encoding: { asset: { contentType: "image/png" } },
                  schema: {
                    type: "object",
                    properties: {
                      description: { type: "string", example: "Profile image" },
                      asset: { type: "string", format: "binary" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
  }));
  await page.goto("/");
  await page.getByRole("button", { name: /Search commands/i }).click();
  await page.getByRole("dialog", { name: "Command palette" }).getByRole("button", { name: "Import API Docs" }).click();
  await page.getByLabel("Swagger UI or definition URL").fill("https://swagger.test/upload-openapi.json");
  await page.getByRole("button", { name: "Inspect Definition" }).click();
  await page.getByRole("button", { name: "Add and Save 1 Selected" }).click();
  const saveDialog = page.getByRole("dialog", { name: "Save Project" });
  await saveDialog.getByLabel("Project file path").fill("/private/tmp/e2e-multipart-upload.restproj");
  await saveDialog.getByRole("button", { name: "Save Project" }).click();
  await page.getByRole("button", { name: "Body" }).click();

  await expect(page.getByLabel("Body content type")).toHaveValue("multipart/form-data");
  await expect(page.getByLabel("Form Fields description type")).toHaveValue("text");
  await expect(page.getByLabel("Form Fields asset type")).toHaveValue("file");
  await expect(page.getByLabel("Form Fields asset content type")).toHaveValue("image/png");
  await page.getByLabel("Form Fields asset value").fill("/private/tmp/profile.png");
  await page.getByRole("button", { name: "Save *", exact: true }).click();
  const updatedSaveDialog = page.getByRole("dialog", { name: "Save Project" });
  await updatedSaveDialog.getByLabel("Project file path").fill("/private/tmp/e2e-multipart-upload.restproj");
  await updatedSaveDialog.getByRole("button", { name: "Save Project" }).click();
  await updatedSaveDialog.getByRole("button", { name: "Overwrite Project" }).click();
  await expect(page.getByText("Project saved to /private/tmp/e2e-multipart-upload.restproj.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /Search commands/i }).click();
  await page.getByRole("dialog", { name: "Command palette" }).getByRole("button", { name: "Open Project" }).click();
  const openDialog = page.getByRole("dialog", { name: "Open Project" });
  await openDialog.getByLabel("Project file path").fill("/private/tmp/e2e-multipart-upload.restproj");
  await openDialog.getByRole("button", { name: "Open Project" }).click();
  await page.getByRole("button", { name: "POST Upload Asset" }).click();
  await page.getByRole("button", { name: "Body" }).click();
  await expect(page.getByLabel("Form Fields asset value")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Approve asset file for this session" })).toBeDisabled();
  await page.getByLabel("Form Fields asset value").fill("/private/tmp/profile.png");
  await page.getByRole("button", { name: "Send Request" }).click();
  await expect(page.getByLabel("Status bar")).toContainText("Approve local file 'profile.png' for https://upload.test before sending.");

  await page.getByRole("button", { name: "Approve asset file for this session" }).click();
  await expect(page.getByRole("button", { name: "Approved asset file for this session" })).toBeVisible();
  await page.getByLabel("Request URL").fill("https://other-upload.test/assets");
  await page.getByRole("button", { name: "Send Request" }).click();
  await expect(page.getByLabel("Status bar")).toContainText("Approve local file 'profile.png' for https://other-upload.test before sending.");

  await page.getByLabel("Request URL").fill("https://upload.test/assets");
  await page.getByRole("button", { name: "Send Request" }).click();
  await expect(page.getByLabel("Workbench").getByText(/Multipart file uploads require Relay Studio desktop mode/)).toBeVisible();
});

test("saves selected OpenAPI operations directly from import review", async ({ page }) => {
  await page.route("https://swagger.test/save-openapi.json", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      openapi: "3.1.0",
      info: { title: "Saved Import" },
      servers: [{ url: "https://saved-api.test" }],
      paths: {
        "/widgets": {
          get: { summary: "List Widgets", responses: { "200": { description: "OK" } } },
          post: { summary: "Create Widget", responses: { "201": { description: "Created" } } }
        }
      }
    })
  }));
  await page.goto("/");
  await page.getByRole("button", { name: /Search commands/i }).click();
  await page.getByRole("dialog", { name: "Command palette" }).getByRole("button", { name: "Import API Docs" }).click();
  await page.getByLabel("Swagger UI or definition URL").fill("https://swagger.test/save-openapi.json");
  await page.getByRole("button", { name: "Inspect Definition" }).click();
  await page.getByLabel("Discovered REST services").getByText("Create Widget").click();

  const importActions = [
    { name: "Select All", title: "Select every discovered REST operation." },
    { name: "Clear", title: "Clear all selected REST operations." },
    { name: "Add 1 Selected", title: "Add selected REST operations to the current project without saving it yet." },
    { name: "Add and Save 1 Selected", title: "Add selected REST operations to the current project and open the Save Project dialog." }
  ];
  for (const { name, title } of importActions) {
    const action = page.getByRole("button", { name });
    await expect(action).toHaveAttribute("title", title);
    await expect(action).toHaveCSS("color", "rgb(11, 95, 199)");
    await expect(action).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(action).toHaveCSS("border-style", "none");
  }
  const addAndSaveButton = page.getByRole("button", { name: "Add and Save 1 Selected" });
  await addAndSaveButton.click();

  const dialog = page.getByRole("dialog", { name: "Save Project" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Project file path").fill("/private/tmp/e2e-saved-import.restproj");
  await dialog.getByRole("button", { name: "Save Project" }).click();
  await expect(page.getByText("Project saved to /private/tmp/e2e-saved-import.restproj.")).toBeVisible();
  await expect(page.getByRole("button", { name: "GET List Widgets" })).toBeVisible();
  await expect(page.getByRole("button", { name: "POST Create Widget" })).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: /Search commands/i }).click();
  await page.getByRole("dialog", { name: "Command palette" }).getByRole("button", { name: "Open Project" }).click();
  const openDialog = page.getByRole("dialog", { name: "Open Project" });
  await openDialog.getByLabel("Project file path").fill("/private/tmp/e2e-saved-import.restproj");
  await openDialog.getByRole("button", { name: "Open Project" }).click();
  await expect(page.getByRole("button", { name: "GET List Widgets" })).toBeVisible();
  await expect(page.getByRole("button", { name: "POST Create Widget" })).toHaveCount(0);
});

test("compares two selected redacted saved responses", async ({ page }) => {
  const metadata = (id: string, status: number) => ({
    id, serviceId: "health-check", serviceName: "Health Check", fileName: `${id}.json`, filePath: `/private/tmp/${id}.json`,
    method: "GET", url: "https://api.example.com/api/health", status, statusText: status === 200 ? "OK" : "Created",
    durationMs: status === 200 ? 20 : 35, contentType: "application/json", sizeBytes: 20, bodyKind: "json", redacted: true,
    capturedAt: `2026-07-${status === 200 ? "14" : "15"}T00:00:00.000Z`
  });
  const before = metadata("before", 200);
  const after = metadata("after", 201);
  const project = {
    id: "comparison-project", name: "Comparison Project", format: "relay-studio-restproj", schemaVersion: 1,
    createdAt: "2026-07-14T00:00:00.000Z", updatedAt: "2026-07-15T00:00:00.000Z", services: [], environments: [], flows: [],
    savedResponses: [before, after], importSources: [], settings: { askToSaveOnClose: true, redactSecretsInConsole: true }
  };
  await page.addInitScript(({ seedProject, beforeMetadata, afterMetadata }) => {
    localStorage.setItem("relay-studio:project:/private/tmp/comparison.restproj", JSON.stringify(seedProject));
    localStorage.setItem("relay-studio:recent-projects", JSON.stringify([{ name: "Comparison Project", path: "/private/tmp/comparison.restproj", openedAt: "2026-07-15T00:00:00.000Z" }]));
    localStorage.setItem("relay-studio:saved-response:/private/tmp/before.json", JSON.stringify({ format: "relay-studio-response", schemaVersion: 1, metadata: beforeMetadata, body: '{"id":1,"stable":true}' }));
    localStorage.setItem("relay-studio:saved-response:/private/tmp/after.json", JSON.stringify({ format: "relay-studio-response", schemaVersion: 1, metadata: afterMetadata, body: '{"id":2,"added":"yes"}' }));
  }, { seedProject: project, beforeMetadata: before, afterMetadata: after });
  await page.goto("/");
  await openRecentProject(page, /Comparison Project/);
  await page.getByLabel("Select before.json for comparison").check();
  await page.getByLabel("Select after.json for comparison").check();
  await page.getByRole("button", { name: "Compare selected responses" }).click();
  await expect(page.getByLabel("Response content")).toContainText('"kind": "json"');
  await expect(page.getByLabel("Response content")).toContainText('"path": "$.id"');
});

test("opens bundled Relay Studio help without navigating away", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Search commands/i }).click();
  await page.getByRole("dialog", { name: "Command palette" }).getByRole("button", { name: "Relay Studio Help" }).click();

  await expect(page.getByRole("tab", { name: "Help" })).toBeVisible();
  const help = page.getByLabel("Relay Studio help");
  await expect(help.getByRole("heading", { name: "Relay Studio Help" })).toBeVisible();
  await expect(help.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(help.getByRole("heading", { name: "Diagnostics And Security" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("keeps command palette focus trapped and toggles the response dock", async ({ page }) => {
  await page.goto("/");

  const searchCommands = page.getByRole("button", { name: /Search commands/i });
  await searchCommands.click();
  const dialog = page.getByRole("dialog", { name: "Command palette" });
  const searchInput = dialog.getByPlaceholder("Search commands");
  const responseDockToggle = dialog.getByRole("button", { name: /Toggle Response Dock/i });

  await expect(searchInput).toBeFocused();
  await responseDockToggle.focus();
  await page.keyboard.press("Tab");
  await expect(searchInput).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(responseDockToggle).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(searchCommands).toBeFocused();

  await searchCommands.click();
  await page.getByRole("dialog", { name: "Command palette" }).getByRole("button", { name: /Toggle Response Dock/i }).click();
  await expect(page.getByLabel("Response and console dock")).toHaveCount(0);

  await searchCommands.click();
  await page.getByRole("dialog", { name: "Command palette" }).getByRole("button", { name: /Toggle Response Dock/i }).click();
  await expect(page.getByLabel("Response and console dock")).toBeVisible();
});

test("renders Welcome as an app overview, not a request editor", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("tab", { name: "Welcome" }).click();

  await expect(page.getByRole("heading", { name: "Welcome to Relay Studio" })).toBeVisible();
  await expect(page.getByLabel("Request composer")).toHaveCount(0);
  await expect(page.getByLabel("Request URL")).toHaveCount(0);
  await expect(page.getByLabel("Response and console dock")).toHaveCount(0);
});

test("lets Settings fill the workbench without a response dock", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");

  await page.getByRole("button", { name: /Search commands/i }).click();
  await page.getByRole("dialog", { name: "Command palette" }).getByRole("button", { name: /Settings/i }).click();

  const settings = page.getByLabel("Project settings");
  await expect(settings).toBeVisible();
  await expect(page.locator(".explorer-footer")).toHaveCount(0);
  await expect(page.getByLabel("Response and console dock")).toHaveCount(0);

  const geometry = await page.evaluate(() => {
    const workbench = document.querySelector<HTMLElement>(".workbench");
    const settingsView = document.querySelector<HTMLElement>(".project-settings-view");
    if (!workbench || !settingsView) {
      throw new Error("Settings geometry elements were not rendered.");
    }
    const workbenchBox = workbench.getBoundingClientRect();
    const settingsBox = settingsView.getBoundingClientRect();
    return {
      bottomGap: Math.round(workbenchBox.bottom - settingsBox.bottom),
      settingsHeight: Math.round(settingsBox.height),
      workbenchHeight: Math.round(workbenchBox.height),
      settingsOverflows: settingsView.scrollHeight > settingsView.clientHeight
    };
  });

  expect(geometry.bottomGap).toBeLessThanOrEqual(2);
  expect(geometry.settingsHeight).toBeGreaterThan(geometry.workbenchHeight - 50);
  expect(geometry.settingsOverflows).toBe(false);
});

test("tab plus creates a new request", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "New request tab" }).click();

  await expect(page.getByRole("tab", { name: /New Request/ })).toBeVisible();
  await expect(page.getByText("New request created.")).toBeVisible();
  await expect(page.getByLabel("Project explorer").getByLabel("Requests")).toContainText("New Request");
});

test("keeps recent projects in the command surface, not the explorer", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("relay-studio:recent-projects", JSON.stringify([
      {
        name: "Test Project 2",
        path: "/private/tmp/test-project-2.restproj",
        openedAt: "2026-06-27T19:57:00.000Z"
      }
    ]));
  });
  await page.goto("/");

  const explorer = page.getByLabel("Project explorer");
  await explorer.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "New Project" });
  await dialog.getByLabel("Project name").fill("Test Project 2");
  await dialog.getByRole("button", { name: "Create Project" }).click();

  await expect(explorer.getByText("Test Project 2 *")).toBeVisible();
  await expect(explorer.getByLabel("Recent Projects")).toHaveCount(0);

  await page.getByRole("button", { name: /Search commands/i }).click();
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("button", { name: /Open Recent Projects/i }).click();
  const recentProjects = page.getByRole("dialog", { name: "Open Recent Projects" });
  await expect(recentProjects.getByRole("button", { name: /Sample API Regression/ })).toBeVisible();
  await expect(recentProjects.getByRole("button", { name: /Test Project 2/ })).toHaveCount(0);
});

test("keeps flow nodes visible after saving the project", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByRole("tab", { name: /Authenticated Read/i }).click();
  const canvas = page.getByLabel("Flow canvas");
  await expect(canvas.getByTestId("flow-render-node-authenticated-read-login")).toBeVisible();

  await page.getByRole("button", { name: /^Save$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Save Project" });
  await dialog.getByLabel("Project file path").fill("/private/tmp/e2e-flow-save.restproj");
  await dialog.getByRole("button", { name: "Save Project" }).click();

  await expect(page.getByText("Project saved to /private/tmp/e2e-flow-save.restproj.")).toBeVisible();
  await expect(canvas.getByTestId("flow-render-node-authenticated-read-login")).toBeVisible();
  await expect(canvas.getByTestId("flow-render-node-authenticated-read-current-user")).toBeVisible();
});

test("shows visible missing-request flow nodes from saved projects", async ({ page }) => {
  const project = {
    id: "project-test-4",
    name: "Test Project 4",
    format: "relay-studio-restproj",
    schemaVersion: 1,
    createdAt: "2026-06-27T20:47:02.277Z",
    updatedAt: "2026-06-27T22:36:08.277Z",
    services: [
      {
        id: "request-1",
        folder: "Requests",
        name: "New Request",
        method: "GET",
        path: "/api/health",
        auth: "none",
        timeoutMs: 30000,
        retry: { attempts: 0, backoffMs: 0 },
        headers: [],
        queryParams: [],
        pathParams: [],
        body: { contentType: "none", raw: "" },
        authProfile: { type: "none" }
      }
    ],
    environments: [
      { id: "qa", name: "QA Environment", variables: [{ name: "baseUrl", value: "https://api.example.com", secret: false }] }
    ],
    flows: [
      {
        id: "flow-1",
        name: "New Flow 1",
        steps: ["login", "current-user", "list-products"],
        nodes: [
          { id: "flow-1-login-1", label: "Login", position: { x: 80, y: 120 }, serviceId: "login", status: "idle" },
          { id: "flow-1-current-user-2", label: "Current User", position: { x: 310, y: 212 }, serviceId: "current-user", status: "idle" },
          { id: "flow-1-list-products-3", label: "List Products", position: { x: 540, y: 120 }, serviceId: "list-products", status: "idle" }
        ],
        edges: [
          { condition: "success", id: "flow-1-login-1-success-flow-1-current-user-2", source: "flow-1-login-1", target: "flow-1-current-user-2" },
          { condition: "success", id: "flow-1-current-user-2-success-flow-1-list-products-3", source: "flow-1-current-user-2", target: "flow-1-list-products-3" }
        ],
        mappings: [
          { id: "flow-1-mapping-1", jsonPath: "$.accessToken", secret: true, sourceNodeId: "flow-1-login-1", variableName: "accessToken" }
        ]
      }
    ],
    savedResponses: [],
    importSources: [],
    settings: { askToSaveOnClose: true, redactSecretsInConsole: true }
  };
  await page.addInitScript((seedProject) => {
    localStorage.setItem("relay-studio:project:/private/tmp/test-project-4.restproj", JSON.stringify(seedProject));
    localStorage.setItem("relay-studio:recent-projects", JSON.stringify([
      { name: "Test Project 4", path: "/private/tmp/test-project-4.restproj", openedAt: "2026-06-27T22:36:08.277Z" }
    ]));
  }, project);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await openRecentProject(page, /Test Project 4/);
  await expect(page.getByText("Project opened from /private/tmp/test-project-4.restproj.")).toBeVisible();
  await page.getByLabel("Project explorer").getByRole("button", { name: /New Flow 1/ }).click();

  const canvas = page.getByLabel("Flow canvas");
  await expect(canvas.getByTestId("flow-render-node-flow-1-login-1")).toBeVisible();
  await expect(canvas.getByTestId("flow-render-node-flow-1-current-user-2")).toBeVisible();
  await expect(page.getByLabel("Flow step details").getByText("Missing Request")).toBeVisible();
});

test("scrolls the flow workspace to bounded offscreen nodes", async ({ page }) => {
  const project = {
    id: "project-wide-flow",
    name: "Wide Flow Project",
    format: "relay-studio-restproj",
    schemaVersion: 1,
    createdAt: "2026-06-29T21:35:40.000Z",
    updatedAt: "2026-06-29T21:35:40.000Z",
    services: [
      {
        id: "request-1",
        folder: "Requests",
        name: "Health Check",
        method: "GET",
        path: "/api/health",
        auth: "none",
        timeoutMs: 30000,
        retry: { attempts: 0, backoffMs: 0 },
        headers: [],
        queryParams: [],
        pathParams: [],
        body: { contentType: "none", raw: "" },
        authProfile: { type: "none" }
      }
    ],
    environments: [
      { id: "qa", name: "QA Environment", variables: [{ name: "baseUrl", value: "https://api.example.com", secret: false }] }
    ],
    flows: [
      {
        id: "flow-wide",
        name: "Wide Flow",
        steps: ["login", "current-user", "list-products", "get-product"],
        nodes: [
          { id: "flow-wide-login", label: "Login", position: { x: 80, y: 120 }, serviceId: "login", status: "idle" },
          { id: "flow-wide-current-user", label: "Current User", position: { x: 310, y: 212 }, serviceId: "current-user", status: "idle" },
          { id: "flow-wide-list-products", label: "List Products", position: { x: 540, y: 120 }, serviceId: "list-products", status: "idle" },
          { id: "flow-wide-get-product", label: "Get Product", position: { x: 1120, y: 212 }, serviceId: "get-product", status: "idle" }
        ],
        edges: [
          { condition: "success", id: "flow-wide-login-success-current-user", source: "flow-wide-login", target: "flow-wide-current-user" },
          { condition: "success", id: "flow-wide-current-user-success-list-products", source: "flow-wide-current-user", target: "flow-wide-list-products" },
          { condition: "success", id: "flow-wide-list-products-success-get-product", source: "flow-wide-list-products", target: "flow-wide-get-product" }
        ],
        mappings: []
      }
    ],
    savedResponses: [],
    importSources: [],
    settings: { askToSaveOnClose: true, redactSecretsInConsole: true }
  };
  await page.addInitScript((seedProject) => {
    localStorage.setItem("relay-studio:project:/private/tmp/wide-flow.restproj", JSON.stringify(seedProject));
    localStorage.setItem("relay-studio:recent-projects", JSON.stringify([
      { name: "Wide Flow Project", path: "/private/tmp/wide-flow.restproj", openedAt: "2026-06-29T21:35:40.000Z" }
    ]));
  }, project);
  await page.setViewportSize({ width: 960, height: 640 });
  await page.goto("/");

  await openRecentProject(page, /Wide Flow Project/);
  await page.getByLabel("Project explorer").getByRole("button", { name: /Wide Flow/ }).click();

  const canvas = page.getByLabel("Flow canvas");
  await expect.poll(async () => canvas.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

  const metrics = await canvas.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(1350);

  await canvas.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });

  const canvasBox = await canvas.boundingBox();
  const getProductBox = await canvas.getByTestId("flow-render-node-flow-wide-get-product").boundingBox();
  if (!canvasBox || !getProductBox) throw new Error("Flow canvas or Get Product node was not measurable.");
  expect(getProductBox.x).toBeGreaterThanOrEqual(canvasBox.x);
  expect(getProductBox.x + getProductBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
});

test("keeps action boxes and routes visible after save and pane resizing", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByRole("tab", { name: /Authenticated Read/i }).click();
  const canvas = page.getByLabel("Flow canvas");
  const loginNode = canvas.getByTestId("flow-render-node-authenticated-read-login");
  const currentUserNode = canvas.getByTestId("flow-render-node-authenticated-read-current-user");
  const routePaths = canvas.locator(".flow-route path");

  await expect(loginNode).toBeVisible();
  await expect(currentUserNode).toBeVisible();
  await expect(routePaths).toHaveCount(3);

  await page.getByRole("button", { name: /^Save$/ }).click();
  const dialog = page.getByRole("dialog", { name: "Save Project" });
  await dialog.getByLabel("Project file path").fill("/private/tmp/e2e-save-resize-flow.restproj");
  await dialog.getByRole("button", { name: "Save Project" }).click();
  await expect(page.getByText("Project saved to /private/tmp/e2e-save-resize-flow.restproj.")).toBeVisible();

  await expect(loginNode).toBeVisible();
  await expect(currentUserNode).toBeVisible();
  await expect(routePaths).toHaveCount(3);

  const bottomResize = page.getByRole("separator", { name: "Resize utility dock" });
  const bottomBox = await bottomResize.boundingBox();
  if (!bottomBox) throw new Error("Utility dock resize handle was not measurable.");
  await page.mouse.move(bottomBox.x + bottomBox.width / 2, bottomBox.y + bottomBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(bottomBox.x + bottomBox.width / 2, bottomBox.y + 120, { steps: 8 });
  await page.mouse.up();

  await expect(loginNode).toBeVisible();
  await expect(currentUserNode).toBeVisible();
  await expect(routePaths).toHaveCount(3);

  const explorerResize = page.getByRole("separator", { name: "Resize explorer" });
  const explorerBox = await explorerResize.boundingBox();
  if (!explorerBox) throw new Error("Explorer resize handle was not measurable.");
  await page.mouse.move(explorerBox.x + explorerBox.width / 2, explorerBox.y + 120);
  await page.mouse.down();
  await page.mouse.move(explorerBox.x - 90, explorerBox.y + 120, { steps: 8 });
  await page.mouse.up();

  await expect(loginNode).toBeVisible();
  await expect(currentUserNode).toBeVisible();
  await expect(routePaths).toHaveCount(3);
});

test("keeps one flow run control and removes a manually added success path", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByRole("tab", { name: /Authenticated Read/i }).click();
  const builder = page.getByLabel("Flow builder");

  await expect(page.getByRole("button", { name: "Run Flow" })).toHaveCount(1);
  await expect(builder.getByRole("button", { name: "Run Flow" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Request actions" })).toHaveCount(0);
  await expect(builder.getByText("4 steps - 3 links")).toBeVisible();

  await builder.getByLabel("Path target").selectOption("authenticated-read-list-products");
  await builder.getByRole("button", { name: "Add Success Path" }).click();
  await expect(builder.getByText("4 steps - 4 links")).toBeVisible();
  await builder.getByRole("button", { name: "Remove Success Path" }).click();
  await expect(builder.getByText("4 steps - 3 links")).toBeVisible();
  await expect(builder.getByRole("button", { name: "Add Success Path" })).toBeEnabled();
});

test("manages flow response mappings in a table dialog", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByRole("tab", { name: /Authenticated Read/i }).click();
  const builder = page.getByLabel("Flow builder");
  const mappings = builder.getByLabel("Response mappings");

  await expect(mappings.getByText("1 mapping configured.")).toBeVisible();
  await expect(mappings.locator("input")).toHaveCount(0);
  await mappings.getByRole("button", { name: "Manage Response Mappings" }).click();

  const dialog = page.getByRole("dialog", { name: "Response Mappings" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("table", { name: "Response mapping table" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Capture Token" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Capture Id" })).toHaveCount(0);
  await expect(dialog.getByLabel("JSONPath examples")).toBeVisible();
  await expect(dialog.getByText("Top-level field named accessToken.")).toBeVisible();
  await expect(dialog.getByText("First item in an array.")).toBeVisible();
  await dialog.getByLabel("Mapping 1 variable").fill("sessionToken");
  await dialog.getByRole("button", { name: "Add Mapping" }).click();
  await expect(dialog.getByLabel("Mapping 2 JSONPath")).toBeVisible();
  await dialog.getByLabel("Mapping 2 variable").fill("recordId");
  await dialog.getByLabel("Mapping 2 JSONPath").fill("$.id");
  await dialog.getByRole("button", { name: "Delete mapping 2" }).click();
  await expect(dialog.getByLabel("Mapping 2 variable")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Done" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(mappings.getByText("1 mapping configured.")).toBeVisible();
  await expect(mappings.getByText("sessionToken")).toBeVisible();
});

test("keeps flow nodes visible after window resize", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByRole("tab", { name: /Authenticated Read/i }).click();
  const canvas = page.getByLabel("Flow canvas");
  await expect(canvas.getByTestId("flow-render-node-authenticated-read-login")).toBeVisible();
  await expect(canvas.getByTestId("flow-render-node-authenticated-read-current-user")).toBeVisible();

  await page.setViewportSize({ width: 1180, height: 760 });

  await expect(canvas.getByTestId("flow-render-node-authenticated-read-login")).toBeVisible();
  await expect(canvas.getByTestId("flow-render-node-authenticated-read-current-user")).toBeVisible();
});

test("keeps flow nodes visible after explorer resize", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByRole("tab", { name: /Authenticated Read/i }).click();
  const canvas = page.getByLabel("Flow canvas");
  await expect(canvas.getByTestId("flow-render-node-authenticated-read-login")).toBeVisible();

  const explorerResize = page.getByRole("separator", { name: "Resize explorer" });
  const box = await explorerResize.boundingBox();
  if (!box) throw new Error("Explorer resize handle was not measurable.");
  await page.mouse.move(box.x + box.width / 2, box.y + 120);
  await page.mouse.down();
  await page.mouse.move(box.x - 80, box.y + 120, { steps: 8 });
  await page.mouse.up();

  await expect(canvas.getByTestId("flow-render-node-authenticated-read-login")).toBeVisible();
  await expect(canvas.getByTestId("flow-render-node-authenticated-read-current-user")).toBeVisible();
});

test("keeps zoomed-out flow nodes fully inside the canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await page.getByRole("tab", { name: /Authenticated Read/i }).click();
  const canvas = page.getByLabel("Flow canvas");
  await canvas.getByRole("button", { name: "Zoom Out" }).click();

  const canvasBox = await canvas.boundingBox();
  const listProductsBox = await canvas.getByTestId("flow-render-node-authenticated-read-list-products").boundingBox();
  if (!canvasBox || !listProductsBox) throw new Error("Flow canvas or list products action was not measurable.");

  expect(listProductsBox.x).toBeGreaterThanOrEqual(canvasBox.x);
  expect(listProductsBox.x + listProductsBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width);
});

test("renames a flow from the explorer context menu", async ({ page }) => {
  await page.goto("/");

  const explorer = page.getByLabel("Project explorer");
  const flow = explorer.getByRole("button", { name: /Authenticated Read/i });
  await flow.click();
  await flow.click({ button: "right" });

  const menu = page.getByRole("menu", { name: "Flow context menu" });
  await expect(menu.getByRole("menuitem", { name: "Rename Flow" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Delete Flow" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Rename Flow" }).click();

  const dialog = page.getByRole("dialog", { name: "Rename Flow" });
  await dialog.getByLabel("Project name").fill("Session Bootstrap Flow");
  await dialog.getByRole("button", { name: "Rename Flow", exact: true }).click();

  await expect(explorer.getByRole("button", { name: /Session Bootstrap Flow/i })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Session Bootstrap Flow/i })).toBeVisible();
  await expect(page.getByLabel("Flow builder").getByText("Session Bootstrap Flow")).toBeVisible();
});

test("deletes a request from the explorer context menu", async ({ page }) => {
  await page.goto("/");
  const request = page.getByRole("button", { name: "GET Search Products" });
  await request.click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Request context menu" });
  await expect(menu.getByRole("menuitem", { name: "Rename Request" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Delete Request" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Delete Request" }).click();
  await expect(request).toHaveCount(0);
  await expect(page.getByText("Request deleted.")).toBeVisible();
});

test("renames an open flow from the tab context menu", async ({ page }) => {
  await page.goto("/");

  const explorer = page.getByLabel("Project explorer");
  const flowTab = page.getByRole("tab", { name: /Authenticated Read/i });
  await flowTab.click();
  await flowTab.click({ button: "right" });

  const menu = page.getByRole("menu", { name: "Flow tab context menu" });
  await menu.getByRole("menuitem", { name: "Rename Flow" }).click();

  const dialog = page.getByRole("dialog", { name: "Rename Flow" });
  await dialog.getByLabel("Project name").fill("Authenticated Smoke Flow");
  await dialog.getByRole("button", { name: "Rename Flow", exact: true }).click();

  await expect(page.getByRole("tab", { name: /Authenticated Smoke Flow/i })).toBeVisible();
  await expect(explorer.getByRole("button", { name: /Authenticated Smoke Flow/i })).toBeVisible();
  await expect(page.getByText("Flow renamed to Authenticated Smoke Flow.")).toBeVisible();
});

test("generates request and flow code from tab context menus", async ({ page }) => {
  await page.goto("/");

  const requestTab = page.getByRole("tab", { name: /Create Order/i });
  await requestTab.click({ button: "right" });
  const requestMenu = page.getByRole("menu", { name: "Request tab context menu" });
  await requestMenu.getByRole("menuitem", { name: "Generate Code" }).hover();
  await page.getByRole("menu", { name: "Generate request code language" }).getByRole("menuitem", { name: "Java" }).click();

  let dialog = page.getByRole("dialog", { name: "Code Example: Create Order" });
  await expect(dialog.getByLabel("Generated code")).toContainText("HttpClient.newHttpClient()");
  await expect(dialog.getByLabel("Generated code")).not.toContainText("sample-access-token");
  await dialog.getByRole("button", { name: "Close code example" }).click();

  const flowTab = page.getByRole("tab", { name: /Authenticated Read/i });
  await flowTab.click({ button: "right" });
  const flowMenu = page.getByRole("menu", { name: "Flow tab context menu" });
  await flowMenu.getByRole("menuitem", { name: "Generate Code" }).hover();
  await page.getByRole("menu", { name: "Generate flow code language" }).getByRole("menuitem", { name: "Java" }).click();

  dialog = page.getByRole("dialog", { name: "Code Example: Authenticated Read" });
  let code = await dialog.getByLabel("Generated code").inputValue();
  expect(code.indexOf("Step 1: Login")).toBeLessThan(code.indexOf("Step 2: Current User"));
  expect(code).toContain("Capture $.accessToken as <ACCESS_TOKEN>");
  expect(code).toContain("Credential placeholders such as <REDACTED> must be supplied securely before running");
  expect(code).toContain("if (response_step1.statusCode() < 200 || response_step1.statusCode() >= 300)");
  expect(code).toContain("Flow step 1 (Login) did not return valid JSON required by response mappings");
  expect(code).toContain('flowVariables.put("accessToken", mappedValue_step1_accessToken.asText())');
  expect(code).toContain('"Bearer " + flowVariables.get("accessToken")');
  await dialog.getByRole("button", { name: "Close code example" }).click();

  await flowTab.click({ button: "right" });
  await page.getByRole("menu", { name: "Flow tab context menu" }).getByRole("menuitem", { name: "Generate Code" }).hover();
  await page.getByRole("menu", { name: "Generate flow code language" }).getByRole("menuitem", { name: "jQuery" }).click();
  dialog = page.getByRole("dialog", { name: "Code Example: Authenticated Read" });
  code = await dialog.getByLabel("Generated code").inputValue();
  expect(code).toContain('flowVariables["accessToken"] = responseData_step1["accessToken"]');
  expect(code).toContain('"Authorization": "Bearer " + flowVariables["accessToken"]');
  await expect(dialog.getByText(/4 requests/)).toBeVisible();
});
