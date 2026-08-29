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

const allPermissions = [
  "preparation.read",
  "preparation.start",
  "preparation.ready",
  "preparation.cancel",
  "orders.read"
];

const access = {
  companies: [
    {
      company,
      branchScope: "all_branches",
      roles: ["kitchen"],
      permissions: allPermissions
    }
  ],
  branches: [
    {
      company,
      branch,
      source: "branch_membership",
      roles: ["kitchen"],
      permissions: allPermissions
    }
  ],
  roles: ["kitchen"],
  permissions: allPermissions
};

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

const staffContext = {
  staffUser,
  staffSession,
  staffAccess: access
};

function taskEnvelope({
  id,
  table,
  floor,
  orderNumber,
  item,
  quantity,
  station,
  status,
  createdAt,
  notes,
  modifiers = []
}) {
  return {
    task: {
      id,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      orderId: `${ORDER_ID}-${orderNumber}`,
      status,
      station,
      quantity,
      itemNameSnapshot: item,
      notes: notes ?? null,
      createdAt,
      startedAt: status === "preparing" || status === "ready"
        ? "2026-08-29T10:10:00.000Z"
        : null,
      readyAt: status === "ready"
        ? "2026-08-29T10:18:00.000Z"
        : null,
      cancelledAt: null
    },
    order: {
      id: `${ORDER_ID}-${orderNumber}`,
      orderNumber,
      status: status === "ready" ? "ready" : "cashier_accepted",
      submittedAt: createdAt
    },
    tableSession: {
      id: `session-${table}`,
      status: "active"
    },
    floor: {
      id: `floor-${floor}`,
      name: floor
    },
    table: {
      id: `table-${table}`,
      code: table,
      displayName: table
    },
    orderItem: {
      id: `order-item-${id}`,
      itemNameSnapshot: item,
      notes: notes ?? null
    },
    modifierOptions: modifiers.map((name, index) => ({
      id: `${id}-modifier-${index}`,
      modifierGroupNameSnapshot: "Options",
      modifierOptionNameSnapshot: name,
      priceDeltaMinorSnapshot: 0
    })),
    events: [
      {
        id: `${id}-event-created`,
        type: "created",
        createdAt,
        actorStaffUserId: null
      }
    ]
  };
}

const tasks = [
  taskEnvelope({
    id: "task-841",
    table: "T12",
    floor: "Main Floor",
    orderNumber: "10428",
    item: "Beef Burger",
    quantity: 2,
    station: "kitchen",
    status: "pending",
    createdAt: "2026-08-29T10:02:00.000Z",
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
    createdAt: "2026-08-29T10:04:00.000Z"
  }),
  taskEnvelope({
    id: "task-836",
    table: "T03",
    floor: "Main Floor",
    orderNumber: "10425",
    item: "Cappuccino",
    quantity: 2,
    station: "barista",
    status: "preparing",
    createdAt: "2026-08-29T10:08:00.000Z",
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
    status: "pending",
    createdAt: "2026-08-29T10:11:00.000Z",
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
    createdAt: "2026-08-29T10:13:00.000Z"
  }),
  taskEnvelope({
    id: "task-823",
    table: "T07",
    floor: "Main Floor",
    orderNumber: "10418",
    item: "Chicken Pasta",
    quantity: 1,
    station: "kitchen",
    status: "preparing",
    createdAt: "2026-08-29T09:58:00.000Z",
    notes: "Allergy note: no mushrooms"
  })
];

function printJob({
  id,
  status,
  kind,
  stationName,
  createdAt,
  errorMessage = null,
  printableText
}) {
  return {
    printJob: {
      id,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      status,
      kind,
      createdAt,
      errorMessage,
      printableText
    },
    printerStation: {
      id: `${id}-station`,
      name: stationName,
      status: "active"
    }
  };
}

const printJobs = [
  printJob({
    id: "print-441",
    status: "failed",
    kind: "barista_ticket",
    stationName: "Bar printer",
    createdAt: "2026-08-29T10:15:00.000Z",
    errorMessage: "Printer unreachable",
    printableText: "B-091\nT03\n2x Cappuccino\nOat milk"
  }),
  printJob({
    id: "print-440",
    status: "printed",
    kind: "kitchen_ticket",
    stationName: "Main kitchen",
    createdAt: "2026-08-29T10:05:00.000Z",
    printableText: "K-128\nT12\n2x Beef Burger\n1x Fries"
  }),
  printJob({
    id: "print-438",
    status: "pending",
    kind: "dessert_ticket",
    stationName: "Dessert printer",
    createdAt: "2026-08-29T10:19:00.000Z",
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
      createdAt: "2026-08-29T10:02:00.000Z"
    },
    order: {
      id: `${ORDER_ID}-10428`,
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
    printJobs: [printJobs[1]]
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
      createdAt: "2026-08-29T10:08:00.000Z"
    },
    order: {
      id: `${ORDER_ID}-10425`,
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
    printJobs: [printJobs[0]]
  },
  {
    ticket: {
      id: "ticket-8816",
      displayCode: "D-044",
      status: "ready",
      station: "dessert",
      orderNumberSnapshot: "10420",
      tableCodeSnapshot: "T04",
      floorNameSnapshot: "Terrace",
      createdAt: "2026-08-29T10:13:00.000Z"
    },
    order: {
      id: `${ORDER_ID}-10420`,
      orderNumber: "10420"
    },
    floor: { id: "floor-terrace", name: "Terrace" },
    table: { id: "table-T04", code: "T04", displayName: "T04" },
    items: [
      {
        id: "ticket-item-4",
        quantity: 2,
        itemNameSnapshot: "Basque Cheesecake",
        status: "ready",
        modifiersSnapshot: []
      }
    ],
    printJobs: [printJobs[2]]
  }
];

function persistedStaffSession() {
  return JSON.stringify({
    state: {
      accessToken: "kitchen-visual-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      staffUser,
      staffSession,
      effectiveAccess: access,
      defaultBranch: branch,
      selectedBranchId: BRANCH_ID,
      lastLoadedAt: "2026-08-29T10:00:00.000Z"
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

async function installApiMocks(page) {
  const apiRoutePattern = ["**", "api", "v1", "**"].join("/");

  await page.route(apiRoutePattern, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (pathname === "/api/v1/staff-auth/me") {
      return route.fulfill(json(staffContext));
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/preparation-tasks`) {
      const station = url.searchParams.get("station") ?? "all";
      const status = url.searchParams.get("status") ?? "all";
      let visible = tasks;

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

    if (pathname.startsWith("/api/v1/preparation-tasks/") && method === "GET") {
      const taskId = pathname.split("/").pop();
      const selected = tasks.find((entry) => entry.task.id === taskId) ?? tasks[0];
      return route.fulfill(json(selected));
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/kitchen-tickets`) {
      const station = url.searchParams.get("station") ?? "all";
      const status = url.searchParams.get("status") ?? "all";
      let visible = tickets;

      if (station !== "all") {
        visible = visible.filter((entry) => entry.ticket.station === station);
      }

      if (status !== "all") {
        visible = visible.filter((entry) => entry.ticket.status === status);
      }

      return route.fulfill(
        json({
          branch,
          filters: { station, status },
          tickets: visible
        })
      );
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/print-jobs`) {
      const status = url.searchParams.get("status") ?? "all";
      const visible =
        status === "all"
          ? printJobs
          : printJobs.filter((entry) => entry.printJob.status === status);

      return route.fulfill(
        json({
          branch,
          filters: { status },
          printJobs: visible
        })
      );
    }

    if (pathname === `/api/v1/realtime/branches/${BRANCH_ID}/events`) {
      return route.fulfill(
        json({
          branch,
          events: [
            {
              id: "kitchen-event-1",
              type: "preparation_task_created",
              channel: "preparation",
              preparationTaskId: "task-841",
              orderId: `${ORDER_ID}-10428`,
              createdAt: "2026-08-29T10:20:00.000Z"
            },
            {
              id: "kitchen-event-2",
              type: "preparation_task_ready",
              channel: "preparation",
              preparationTaskId: "task-829",
              orderId: `${ORDER_ID}-10420`,
              createdAt: "2026-08-29T10:18:00.000Z"
            }
          ]
        })
      );
    }

    if (pathname === `/api/v1/realtime/branches/${BRANCH_ID}/stream`) {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "cache-control": "no-cache" },
        body: "event: ready\ndata: {}\n\n"
      });
    }

    if (method !== "GET") {
      return route.fulfill(json({ ok: true }));
    }

    return route.fulfill(json({}));
  });
}

async function newContext(browser, locale, viewport) {
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
      staffValue: persistedStaffSession()
    }
  );

  return context;
}

async function capture(browser, {
  label,
  locale = "en",
  viewport = { width: 1440, height: 1000 },
  mode = "board"
}) {
  const context = await newContext(browser, locale, viewport);
  const page = await context.newPage();
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await installApiMocks(page);
  await page.goto(`${BASE_URL}/staff/kitchen`, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  const boardLabel = locale === "ar" ? "البورد" : "Board";
  await page.getByRole("button", { name: boardLabel, exact: true }).waitFor({
    state: "visible",
    timeout: 15000
  });

  if (mode === "tickets") {
    await page
      .getByRole("button", {
        name: locale === "ar" ? "التذاكر" : "Tickets",
        exact: true
      })
      .click();
  }

  if (mode === "print") {
    await page
      .getByRole("button", {
        name: locale === "ar" ? "الطباعة" : "Print",
        exact: true
      })
      .click();
  }

  await page.waitForTimeout(700);

  const metrics = await page.evaluate(() => {
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
          width: Math.round(rect.width),
          scrollWidth: element.scrollWidth
        };
      })
      .filter(
        (entry) =>
          entry.width > 0 &&
          (entry.right > innerWidth + 1 || entry.left < -1)
      )
      .sort((a, b) => Math.max(b.right - innerWidth, -b.left) - Math.max(a.right - innerWidth, -a.left))
      .slice(0, 12);

    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
      offenders
    };
  });

  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    throw new Error(
      `${label}: document overflow ${metrics.scrollWidth}px > ${metrics.clientWidth}px; offenders=${JSON.stringify(metrics.offenders)}`
    );
  }

  if (locale === "ar" && metrics.dir !== "rtl") {
    throw new Error(`${label}: expected rtl, got ${metrics.dir || "empty"}`);
  }

  if (consoleErrors.length > 0) {
    throw new Error(
      `${label}: browser console errors: ${consoleErrors.join(" | ")}`
    );
  }

  const screenshot = path.join(OUTPUT_DIR, `${label}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });

  const result = {
    label,
    locale,
    viewport,
    mode,
    screenshot,
    metrics,
    consoleErrors
  };

  await context.close();
  return result;
}

await mkdir(OUTPUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  results.push(
    await capture(browser, {
      label: "01-kitchen-board-desktop",
      mode: "board"
    })
  );
  results.push(
    await capture(browser, {
      label: "02-kitchen-tickets-desktop",
      mode: "tickets"
    })
  );
  results.push(
    await capture(browser, {
      label: "03-kitchen-print-desktop",
      mode: "print"
    })
  );
  results.push(
    await capture(browser, {
      label: "04-kitchen-board-mobile-390",
      mode: "board",
      viewport: { width: 390, height: 844 }
    })
  );
  results.push(
    await capture(browser, {
      label: "05-kitchen-tickets-mobile-390",
      mode: "tickets",
      viewport: { width: 390, height: 844 }
    })
  );
  results.push(
    await capture(browser, {
      label: "06-kitchen-board-ar-rtl-390",
      locale: "ar",
      mode: "board",
      viewport: { width: 390, height: 844 }
    })
  );
  results.push(
    await capture(browser, {
      label: "07-kitchen-print-ar-rtl-390",
      locale: "ar",
      mode: "print",
      viewport: { width: 390, height: 844 }
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
