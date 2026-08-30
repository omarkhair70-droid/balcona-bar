import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire("/tmp/balcona-kitchen-visual-qa/package.json");
const { chromium } = require("playwright");

const BASE_URL =
  process.env.BALCONA_VISUAL_BASE_URL ?? "http://localhost:3001";
const OUTPUT_DIR = path.resolve("artifacts/kitchen-visual-qa");

const COMPANY_ID = "company-kitchen-visual";
const BRANCH_ID = "branch-kitchen-visual";
const ORDER_ID = "order-kitchen-visual";
const FIXTURE_NOW = Date.now();

const company = {
  id: COMPANY_ID,
  name: "Balcona Bar",
  slug: "balcona-bar",
  status: "active"
};

const branch = {
  id: BRANCH_ID,
  companyId: COMPANY_ID,
  name: "Balcona Main",
  slug: "main-branch",
  status: "active"
};

const fullPermissions = [
  "preparation.read",
  "preparation.start",
  "preparation.ready",
  "preparation.cancel",
  "orders.read"
];

const readOnlyPermissions = [
  "preparation.read",
  "orders.read"
];

const staffUser = {
  id: "staff-kitchen-visual",
  email: "kitchen@balcona.local",
  name: "Kitchen Operator",
  status: "active"
};

const staffSession = {
  id: "staff-session-kitchen-visual",
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  staffUserId: staffUser.id,
  status: "active",
  expiresAt: "2099-01-01T00:00:00.000Z"
};

function minutesAgo(minutes) {
  return new Date(FIXTURE_NOW - minutes * 60_000).toISOString();
}

function accessFor(permissions) {
  return {
    companies: [
      {
        company,
        branchScope: "all_branches",
        roles: ["kitchen"],
        permissions
      }
    ],
    branches: [
      {
        company,
        branch,
        source: "branch_membership",
        roles: ["kitchen"],
        permissions
      }
    ],
    roles: ["kitchen"],
    permissions
  };
}

function taskEnvelope({
  id,
  table,
  floor,
  orderNumber,
  item,
  quantity,
  station,
  status,
  age,
  notes,
  modifiers = []
}) {
  const createdAt = minutesAgo(age);

  return {
    task: {
      id,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      orderId: ORDER_ID + "-" + orderNumber,
      status,
      station,
      quantity,
      itemNameSnapshot: item,
      notes: notes ?? null,
      createdAt,
      startedAt:
        status === "preparing" || status === "ready"
          ? minutesAgo(Math.max(1, age - 2))
          : null,
      readyAt: status === "ready" ? minutesAgo(1) : null,
      cancelledAt: null
    },
    order: {
      id: ORDER_ID + "-" + orderNumber,
      orderNumber,
      status: status === "ready" ? "ready" : "cashier_accepted",
      submittedAt: createdAt
    },
    tableSession: {
      id: "session-" + table,
      status: "active"
    },
    floor: {
      id: "floor-" + floor,
      name: floor
    },
    table: {
      id: "table-" + table,
      code: table,
      displayName: table
    },
    orderItem: {
      id: "order-item-" + id,
      itemNameSnapshot: item,
      notes: notes ?? null
    },
    modifierOptions: modifiers.map((name, index) => ({
      id: id + "-modifier-" + index,
      modifierGroupNameSnapshot: "Options",
      modifierOptionNameSnapshot: name,
      priceDeltaMinorSnapshot: 0
    })),
    events: [
      {
        id: id + "-event-created",
        type: "created",
        createdAt,
        actorStaffUserId: null
      }
    ]
  };
}

const baseTasks = [
  taskEnvelope({
    id: "task-841",
    table: "T12",
    floor: "Main Floor",
    orderNumber: "10428",
    item: "Beef Burger",
    quantity: 2,
    station: "kitchen",
    status: "pending",
    age: 18,
    notes: "One burger well done",
    modifiers: ["No onion", "Extra cheese"]
  }),
  taskEnvelope({
    id: "task-842",
    table: "T12",
    floor: "Main Floor",
    orderNumber: "10428",
    item: "Fries",
    quantity: 1,
    station: "kitchen",
    status: "preparing",
    age: 13
  }),
  taskEnvelope({
    id: "task-843",
    table: "T08",
    floor: "Main Floor",
    orderNumber: "10429",
    item: "Chicken Pasta",
    quantity: 1,
    station: "kitchen",
    status: "pending",
    age: 6,
    notes: "Allergy note: no mushrooms"
  }),
  taskEnvelope({
    id: "task-844",
    table: "T05",
    floor: "Terrace",
    orderNumber: "10430",
    item: "Grilled Salmon",
    quantity: 1,
    station: "kitchen",
    status: "preparing",
    age: 4,
    modifiers: ["No butter"]
  }),
  taskEnvelope({
    id: "task-845",
    table: "T02",
    floor: "Main Floor",
    orderNumber: "10431",
    item: "Club Sandwich",
    quantity: 2,
    station: "kitchen",
    status: "pending",
    age: 2
  }),
  taskEnvelope({
    id: "task-836",
    table: "T03",
    floor: "Main Floor",
    orderNumber: "10425",
    item: "Cappuccino",
    quantity: 2,
    station: "barista",
    status: "pending",
    age: 11,
    modifiers: ["Oat milk"]
  }),
  taskEnvelope({
    id: "task-834",
    table: "T09",
    floor: "Main Floor",
    orderNumber: "10423",
    item: "Spanish Latte",
    quantity: 1,
    station: "barista",
    status: "preparing",
    age: 3,
    notes: "Less sweet"
  }),
  taskEnvelope({
    id: "task-829",
    table: "T04",
    floor: "Terrace",
    orderNumber: "10420",
    item: "Basque Cheesecake",
    quantity: 2,
    station: "dessert",
    status: "ready",
    age: 2
  })
];

const rushTasks = [
  ...baseTasks,
  taskEnvelope({
    id: "task-846",
    table: "T14",
    floor: "Main Floor",
    orderNumber: "10432",
    item: "Ribeye Steak",
    quantity: 1,
    station: "kitchen",
    status: "pending",
    age: 21,
    notes: "Medium rare"
  }),
  taskEnvelope({
    id: "task-847",
    table: "T16",
    floor: "Terrace",
    orderNumber: "10433",
    item: "Seafood Risotto",
    quantity: 2,
    station: "kitchen",
    status: "preparing",
    age: 17
  })
];

function printJob({
  id,
  status,
  kind,
  station,
  stationName,
  age,
  errorMessage = null,
  printableText,
  routingMissing = false
}) {
  return {
    printJob: {
      id,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      status,
      kind,
      createdAt: minutesAgo(age),
      errorMessage,
      printableText
    },
    printerStation: routingMissing
      ? null
      : {
          id: id + "-station",
          name: stationName,
          station,
          status: "active"
        }
  };
}

const printJobs = [
  printJob({
    id: "print-441",
    status: "failed",
    kind: "kitchen_ticket",
    station: "kitchen",
    stationName: "Main kitchen",
    age: 16,
    errorMessage: "Printer unreachable",
    printableText: "K-128\nT12\n2x Beef Burger\n1x Fries"
  }),
  printJob({
    id: "print-442",
    status: "pending",
    kind: "kitchen_ticket",
    station: "kitchen",
    stationName: "Unassigned",
    age: 8,
    routingMissing: true,
    printableText: "K-129\nT08\n1x Chicken Pasta"
  }),
  printJob({
    id: "print-438",
    status: "pending",
    kind: "barista_ticket",
    station: "barista",
    stationName: "Bar printer",
    age: 5,
    printableText: "B-091\nT03\n2x Cappuccino\nOat milk"
  }),
  printJob({
    id: "print-437",
    status: "printed",
    kind: "dessert_ticket",
    station: "dessert",
    stationName: "Dessert printer",
    age: 3,
    printableText: "D-044\nT04\n2x Basque Cheesecake"
  })
];

const tickets = [
  {
    ticket: {
      id: "ticket-8821",
      displayCode: "K-128",
      status: "in_progress",
      station: "kitchen",
      orderNumberSnapshot: "10428",
      tableCodeSnapshot: "T12",
      floorNameSnapshot: "Main Floor",
      customerNoteSnapshot: "Serve sauces separately",
      createdAt: minutesAgo(18)
    },
    order: {
      id: ORDER_ID + "-10428",
      orderNumber: "10428"
    },
    floor: { id: "floor-main", name: "Main Floor" },
    table: { id: "table-T12", code: "T12", displayName: "T12" },
    items: [
      {
        id: "ticket-item-1",
        quantity: 2,
        itemNameSnapshot: "Beef Burger",
        status: "in_progress",
        notes: "One well done",
        modifiersSnapshot: [
          { optionId: "no-onion", optionName: "No onion" },
          { optionId: "extra-cheese", optionName: "Extra cheese" }
        ]
      },
      {
        id: "ticket-item-2",
        quantity: 1,
        itemNameSnapshot: "Fries",
        status: "queued",
        modifiersSnapshot: []
      }
    ],
    printJobs: [printJobs[0]]
  },
  {
    ticket: {
      id: "ticket-8818",
      displayCode: "B-091",
      status: "queued",
      station: "barista",
      orderNumberSnapshot: "10425",
      tableCodeSnapshot: "T03",
      floorNameSnapshot: "Main Floor",
      createdAt: minutesAgo(11)
    },
    order: {
      id: ORDER_ID + "-10425",
      orderNumber: "10425"
    },
    floor: { id: "floor-main", name: "Main Floor" },
    table: { id: "table-T03", code: "T03", displayName: "T03" },
    items: [
      {
        id: "ticket-item-3",
        quantity: 2,
        itemNameSnapshot: "Cappuccino",
        status: "queued",
        modifiersSnapshot: [
          { optionId: "oat-milk", optionName: "Oat milk" }
        ]
      }
    ],
    printJobs: [printJobs[2]]
  },
  {
    ticket: {
      id: "ticket-8816",
      displayCode: "D-044",
      status: "served",
      station: "dessert",
      orderNumberSnapshot: "10420",
      tableCodeSnapshot: "T04",
      floorNameSnapshot: "Terrace",
      createdAt: minutesAgo(9)
    },
    order: {
      id: ORDER_ID + "-10420",
      orderNumber: "10420"
    },
    floor: { id: "floor-terrace", name: "Terrace" },
    table: { id: "table-T04", code: "T04", displayName: "T04" },
    items: [
      {
        id: "ticket-item-4",
        quantity: 2,
        itemNameSnapshot: "Basque Cheesecake",
        status: "served",
        modifiersSnapshot: []
      }
    ],
    printJobs: [printJobs[3]]
  },
  {
    ticket: {
      id: "ticket-8822",
      displayCode: "K-129",
      status: "queued",
      station: "kitchen",
      orderNumberSnapshot: "10429",
      tableCodeSnapshot: "T08",
      floorNameSnapshot: "Main Floor",
      createdAt: minutesAgo(8)
    },
    order: {
      id: ORDER_ID + "-10429",
      orderNumber: "10429"
    },
    floor: { id: "floor-main", name: "Main Floor" },
    table: { id: "table-T08", code: "T08", displayName: "T08" },
    items: [
      {
        id: "ticket-item-5",
        quantity: 1,
        itemNameSnapshot: "Chicken Pasta",
        status: "queued",
        modifiersSnapshot: []
      }
    ],
    printJobs: []
  }
];

function persistedStaffSession(permissions) {
  const access = accessFor(permissions);

  return JSON.stringify({
    state: {
      accessToken: "kitchen-visual-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      staffUser,
      staffSession,
      effectiveAccess: access,
      defaultBranch: branch,
      selectedBranchId: BRANCH_ID,
      lastLoadedAt: new Date().toISOString()
    },
    version: 0
  });
}

function json(body, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  };
}

function tasksForScenario(scenario) {
  if (scenario === "empty") return [];
  if (scenario === "rush") return rushTasks;
  return baseTasks;
}

async function installApiMocks(page, scenario, permissions) {
  const apiRoutePattern = ["**", "api", "v1", "**"].join("/");
  const access = accessFor(permissions);

  await page.route(apiRoutePattern, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (pathname === "/api/v1/staff-auth/me") {
      return route.fulfill(
        json({
          staffUser,
          staffSession,
          staffAccess: access
        })
      );
    }

    if (pathname === "/api/v1/branches/" + BRANCH_ID + "/preparation-tasks") {
      if (scenario === "api-error") {
        return route.fulfill(json({ message: "Kitchen API unavailable" }, 500));
      }

      if (scenario === "loading") {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      const station = url.searchParams.get("station") ?? "all";
      const status = url.searchParams.get("status") ?? "all";
      let visible = tasksForScenario(scenario);

      if (station !== "all") {
        visible = visible.filter((entry) => entry.task.station === station);
      }

      if (status !== "all") {
        visible = visible.filter((entry) => entry.task.status === status);
      }

      return route.fulfill(
        json({
          branch,
          station,
          status,
          tasks: visible
        })
      );
    }

    if (pathname === "/api/v1/branches/" + BRANCH_ID + "/kitchen-tickets") {
      const station = url.searchParams.get("station") ?? "all";
      let visible = tickets;

      if (station !== "all") {
        visible = visible.filter((entry) => entry.ticket.station === station);
      }

      return route.fulfill(
        json({
          branch,
          filters: { station, status: "all" },
          tickets: visible
        })
      );
    }

    if (pathname === "/api/v1/branches/" + BRANCH_ID + "/print-jobs") {
      const station = url.searchParams.get("station") ?? "all";
      let visible = printJobs;

      if (station !== "all") {
        visible = visible.filter(
          (entry) =>
            entry.printerStation?.station === station ||
            (station === "kitchen" && entry.printerStation === null)
        );
      }

      return route.fulfill(
        json({
          branch,
          filters: { station, status: "all" },
          printJobs: visible
        })
      );
    }

    if (pathname === "/api/v1/realtime/branches/" + BRANCH_ID + "/stream") {
      if (scenario === "reconnect") {
        return route.abort("connectionrefused");
      }

      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "cache-control": "no-cache" },
        body: "event: ready\ndata: {}\n\n"
      });
    }

    if (pathname.startsWith("/api/v1/preparation-tasks/") && method === "GET") {
      const taskId = pathname.split("/").pop();
      const selected =
        baseTasks.find((entry) => entry.task.id === taskId) ?? baseTasks[0];
      return route.fulfill(json(selected));
    }

    if (method !== "GET") {
      return route.fulfill(json({ ok: true }));
    }

    return route.fulfill(json({}));
  });
}

async function newContext(browser, locale, viewport, permissions) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: locale === "ar" ? "ar-EG" : "en-US"
  });

  await context.addCookies([
    {
      name: "balcona_locale",
      value: locale,
      url: BASE_URL
    }
  ]);

  await context.addInitScript(
    ({ localeValue, staffValue }) => {
      window.localStorage.setItem("balcona.locale", localeValue);
      window.localStorage.setItem("balcona_staff_session", staffValue);
    },
    {
      localeValue: locale,
      staffValue: persistedStaffSession(permissions)
    }
  );

  return context;
}

function labelFor(locale, key) {
  const labels = {
    en: {
      board: "Board",
      tickets: "Tickets",
      print: "Print",
      kitchen: "Kitchen",
      barista: "Barista",
      expediter: "Expediter"
    },
    ar: {
      board: "البورد",
      tickets: "التذاكر",
      print: "الطباعة",
      kitchen: "المطبخ",
      barista: "البار",
      expediter: "الإكسبيدايتر"
    }
  };

  return labels[locale][key];
}

async function pageMetrics(page) {
  return page.evaluate(() => {
    const innerWidth = window.innerWidth;
    const offenders = Array.from(document.querySelectorAll("*"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || "",
          className:
            typeof element.className === "string"
              ? element.className.slice(0, 180)
              : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
      .filter(
        (entry) =>
          entry.width > 0 &&
          (entry.right > innerWidth + 1 || entry.left < -1)
      )
      .sort(
        (a, b) =>
          Math.max(b.right - innerWidth, -b.left) -
          Math.max(a.right - innerWidth, -a.left)
      )
      .slice(0, 12);

    const firstTask = document.querySelector("[data-kds-task-status]");
    const taskParagraphs = firstTask
      ? Array.from(firstTask.querySelectorAll("p"))
      : [];
    const largestTaskFont = taskParagraphs.reduce(
      (largest, element) =>
        Math.max(largest, parseFloat(getComputedStyle(element).fontSize) || 0),
      0
    );
    const taskAction = firstTask?.querySelector("button");
    const activePressedButtons = Array.from(
      document.querySelectorAll('button[aria-pressed="true"]')
    );
    const tallestActiveControl = activePressedButtons.reduce(
      (tallest, element) =>
        Math.max(tallest, element.getBoundingClientRect().height),
      0
    );

    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
      offenders,
      distance: {
        largestTaskFont,
        taskActionHeight: taskAction
          ? taskAction.getBoundingClientRect().height
          : null,
        tallestActiveControl
      },
      kds: {
        station:
          document.querySelector("[data-kds-station]")?.getAttribute(
            "data-kds-station"
          ) ?? null,
        view:
          document.querySelector("[data-kds-view]")?.getAttribute(
            "data-kds-view"
          ) ?? null,
        realtime:
          document.querySelector("[data-kds-realtime]")?.getAttribute(
            "data-kds-realtime"
          ) ?? null,
        boardState:
          document.querySelector("[data-kds-board-state]")?.getAttribute(
            "data-kds-board-state"
          ) ?? null,
        failedPrints: document.querySelectorAll(
          '[data-kds-print-status="failed"]'
        ).length,
        missingRoutes: document.querySelectorAll(
          '[data-kds-print-route="missing"]'
        ).length
      }
    };
  });
}

async function capture(browser, {
  label,
  locale = "en",
  viewport = { width: 1440, height: 1000 },
  view = "board",
  station = "kitchen",
  scenario = "normal",
  permissions = fullPermissions,
  settleMs = 700,
  assertDistance = true
}) {
  const context = await newContext(browser, locale, viewport, permissions);
  const page = await context.newPage();
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await installApiMocks(page, scenario, permissions);
  await page.goto(BASE_URL + "/kitchen", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  await page
    .getByRole("button", {
      name: labelFor(locale, "kitchen"),
      exact: true
    })
    .waitFor({ state: "visible", timeout: 15000 });

  if (station !== "kitchen") {
    await page
      .getByRole("button", {
        name: labelFor(locale, station),
        exact: true
      })
      .click();
  }

  if (view !== "board") {
    await page
      .getByRole("button", {
        name: labelFor(locale, view),
        exact: true
      })
      .click();
  }

  await page.waitForTimeout(settleMs);

  if (scenario === "reconnect") {
    await page
      .locator('[data-kds-realtime="error"]')
      .waitFor({ state: "visible", timeout: 10000 });
  }

  const metrics = await pageMetrics(page);

  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    throw new Error(
      label +
        ": document overflow " +
        metrics.scrollWidth +
        "px > " +
        metrics.clientWidth +
        "px; offenders=" +
        JSON.stringify(metrics.offenders)
    );
  }

  if (locale === "ar" && metrics.dir !== "rtl") {
    throw new Error(label + ": expected rtl, got " + (metrics.dir || "empty"));
  }

  if (
    assertDistance &&
    view === "board" &&
    scenario !== "empty" &&
    scenario !== "api-error" &&
    scenario !== "loading"
  ) {
    if (metrics.distance.largestTaskFont < 20) {
      throw new Error(
        label +
          ": distance-readability item text is only " +
          metrics.distance.largestTaskFont +
          "px"
      );
    }

    if (
      metrics.distance.taskActionHeight !== null &&
      metrics.distance.taskActionHeight < 47
    ) {
      throw new Error(
        label +
          ": primary task action height is only " +
          metrics.distance.taskActionHeight +
          "px"
      );
    }

    if (metrics.distance.tallestActiveControl < 43) {
      throw new Error(
        label +
          ": active station control height is only " +
          metrics.distance.tallestActiveControl +
          "px"
      );
    }
  }

  const unexpectedConsoleErrors = consoleErrors.filter((message) => {
    if (scenario === "reconnect") {
      return false;
    }

    if (
      scenario === "api-error" &&
      message.includes("Failed to load resource") &&
      message.includes("500")
    ) {
      return false;
    }

    return true;
  });

  if (unexpectedConsoleErrors.length > 0) {
    throw new Error(
      label +
        ": browser console errors: " +
        unexpectedConsoleErrors.join(" | ")
    );
  }

  const screenshot = path.join(OUTPUT_DIR, label + ".png");
  await page.screenshot({ path: screenshot, fullPage: true });

  const result = {
    label,
    locale,
    viewport,
    view,
    station,
    scenario,
    screenshot,
    metrics,
    consoleErrors
  };

  await context.close();
  return result;
}

async function verifyStationPersistence(browser) {
  const context = await newContext(
    browser,
    "en",
    { width: 1024, height: 768 },
    fullPermissions
  );
  const page = await context.newPage();
  await installApiMocks(page, "normal", fullPermissions);

  await page.goto(BASE_URL + "/kitchen", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  await page
    .getByRole("button", { name: "Barista", exact: true })
    .waitFor({ state: "visible", timeout: 15000 });
  await page.getByRole("button", { name: "Barista", exact: true }).click();
  await page.locator('[data-kds-station="barista"]').waitFor({
    state: "visible",
    timeout: 5000
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-kds-station="barista"]').waitFor({
    state: "visible",
    timeout: 10000
  });

  const stored = await page.evaluate(() =>
    window.localStorage.getItem("balcona.kitchen.station")
  );

  if (stored !== "barista") {
    throw new Error(
      "station-persistence: expected barista in local storage, got " + stored
    );
  }

  const screenshot = path.join(
    OUTPUT_DIR,
    "09-kitchen-station-persistence-tablet.png"
  );
  await page.screenshot({ path: screenshot, fullPage: true });
  await context.close();

  return {
    label: "09-kitchen-station-persistence-tablet",
    persistedStation: stored,
    screenshot
  };
}

async function verifyReadOnlyPermissions(browser) {
  const context = await newContext(
    browser,
    "en",
    { width: 1024, height: 768 },
    readOnlyPermissions
  );
  const page = await context.newPage();
  await installApiMocks(page, "normal", readOnlyPermissions);

  await page.goto(BASE_URL + "/kitchen", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  const start = page.getByRole("button", { name: "Start", exact: true }).first();
  await start.waitFor({ state: "visible", timeout: 15000 });

  if (!(await start.isDisabled())) {
    throw new Error(
      "permissions-read-only: Start must be disabled without preparation.start"
    );
  }

  const ready = page
    .getByRole("button", { name: "Mark ready", exact: true })
    .first();
  await ready.waitFor({ state: "visible", timeout: 5000 });

  if (!(await ready.isDisabled())) {
    throw new Error(
      "permissions-read-only: Mark ready must be disabled without preparation.ready"
    );
  }

  const screenshot = path.join(
    OUTPUT_DIR,
    "10-kitchen-permissions-read-only-tablet.png"
  );
  await page.screenshot({ path: screenshot, fullPage: true });
  await context.close();

  return {
    label: "10-kitchen-permissions-read-only-tablet",
    startDisabled: true,
    readyDisabled: true,
    screenshot
  };
}

await mkdir(OUTPUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  results.push(
    await capture(browser, {
      label: "01-kitchen-board-1440-aged",
      viewport: { width: 1440, height: 1000 }
    })
  );
  results.push(
    await capture(browser, {
      label: "02-kitchen-board-tablet-1024",
      viewport: { width: 1024, height: 768 }
    })
  );
  results.push(
    await capture(browser, {
      label: "03-kitchen-rush-1440",
      scenario: "rush",
      viewport: { width: 1440, height: 1000 }
    })
  );
  results.push(
    await capture(browser, {
      label: "04-kitchen-empty-tablet",
      scenario: "empty",
      viewport: { width: 1024, height: 768 },
      assertDistance: false
    })
  );
  results.push(
    await capture(browser, {
      label: "05-kitchen-tickets-expediter-1440",
      view: "tickets",
      station: "expediter",
      viewport: { width: 1440, height: 1000 },
      assertDistance: false
    })
  );
  results.push(
    await capture(browser, {
      label: "06-kitchen-print-failures-1440",
      view: "print",
      station: "expediter",
      viewport: { width: 1440, height: 1000 },
      assertDistance: false
    })
  );
  results.push(
    await capture(browser, {
      label: "07-kitchen-board-ar-rtl-tablet",
      locale: "ar",
      viewport: { width: 1024, height: 768 }
    })
  );
  results.push(
    await capture(browser, {
      label: "08-kitchen-realtime-reconnect-tablet",
      scenario: "reconnect",
      viewport: { width: 1024, height: 768 }
    })
  );
  results.push(await verifyStationPersistence(browser));
  results.push(await verifyReadOnlyPermissions(browser));
  results.push(
    await capture(browser, {
      label: "11-kitchen-loading-tablet",
      scenario: "loading",
      viewport: { width: 1024, height: 768 },
      settleMs: 150,
      assertDistance: false
    })
  );
  results.push(
    await capture(browser, {
      label: "12-kitchen-api-error-tablet",
      scenario: "api-error",
      viewport: { width: 1024, height: 768 },
      settleMs: 1000,
      assertDistance: false
    })
  );
} finally {
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  results
};

await writeFile(
  path.join(OUTPUT_DIR, "kitchen-visual-qa-report.json"),
  JSON.stringify(report, null, 2),
  "utf8"
);

console.log(JSON.stringify(report, null, 2));
