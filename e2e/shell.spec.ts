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
