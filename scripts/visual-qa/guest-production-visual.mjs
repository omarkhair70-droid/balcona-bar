import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire("/tmp/balcona-visual-qa/package.json");
const { chromium } = require("playwright");

const BASE_URL = process.env.BALCONA_VISUAL_BASE_URL ?? "http://127.0.0.1:3001";
const OUTPUT_DIR = path.resolve("artifacts/guest-visual-qa");
const SESSION_ID = "visual-session";
const BRANCH_ID = "visual-branch";

const startSessionResult = {
  session: {
    id: SESSION_ID,
    companyId: "company-visual",
    branchId: BRANCH_ID,
    tableId: "table-12",
    status: "active",
    source: "qr",
    startedAt: "2026-08-29T03:00:00.000Z"
  },
  company: {
    id: "company-visual",
    name: "Balcona",
    slug: "balcona",
    status: "active"
  },
  branch: {
    id: BRANCH_ID,
    companyId: "company-visual",
    name: "Balcona Zamalek",
    slug: "balcona-zamalek",
    status: "active"
  },
  floor: {
    id: "floor-main",
    name: "Main",
    sortOrder: 1
  },
  table: {
    id: "table-12",
    code: "T12",
    displayName: "Table 12",
    capacity: 4,
    qrToken: "visual-table-12",
    status: "active"
  },
  wasResumed: false,
  customerAccess: {
    customerAccessToken: "visual-token",
    customerAccessTokenExpiresAt: "2099-01-01T00:00:00.000Z",
    customerSessionIdentityId: "visual-identity"
  }
};

const totals = {
  subtotalMinor: 23500,
  totalQuantity: 2,
  itemCount: 2,
  currency: "EGP"
};

const cart = {
  cart: {
    id: "cart-visual",
    tableSessionId: SESSION_ID,
    status: "active",
    currency: "EGP"
  },
  items: [
    {
      id: "cart-item-1",
      menuItemId: "item-flat-white",
      quantity: 1,
      notes: "Extra hot",
      itemNameSnapshot: "Flat White",
      effectiveBasePriceMinorSnapshot: 12500,
      modifiersTotalMinorSnapshot: 1500,
      unitPriceMinorSnapshot: 14000,
      lineTotalMinorSnapshot: 14000,
      currency: "EGP",
      modifierOptions: [
        {
          id: "cart-mod-1",
          modifierGroupId: "milk",
          modifierOptionId: "oat",
          modifierGroupNameSnapshot: "Milk",
          modifierOptionNameSnapshot: "Oat milk",
          priceDeltaMinorSnapshot: 1500
        }
      ]
    },
    {
      id: "cart-item-2",
      menuItemId: "item-croissant",
      quantity: 1,
      itemNameSnapshot: "Butter Croissant",
      effectiveBasePriceMinorSnapshot: 9500,
      modifiersTotalMinorSnapshot: 0,
      unitPriceMinorSnapshot: 9500,
      lineTotalMinorSnapshot: 9500,
      currency: "EGP",
      modifierOptions: []
    }
  ],
  totals
};

const menu = {
  branch: {
    id: BRANCH_ID,
    companyId: "company-visual",
    name: "Balcona Zamalek",
    slug: "balcona-zamalek",
    status: "active",
    company: {
      id: "company-visual",
      name: "Balcona",
      slug: "balcona",
      status: "active"
    }
  },
  categories: [
    {
      id: "coffee",
      name: "Coffee",
      slug: "coffee",
      description: "Espresso, milk drinks and signatures",
      sortOrder: 1,
      status: "active",
      items: [
        {
          id: "item-flat-white",
          companyId: "company-visual",
          categoryId: "coffee",
          name: "Flat White",
          slug: "flat-white",
          description: "Double espresso with silky steamed milk.",
          basePriceMinor: 12500,
          effectivePriceMinor: 12500,
          currency: "EGP",
          status: "active",
          isFeatured: true,
          isAvailable: true,
          isVisible: true,
          canOrder: true,
          stockStatus: "in_stock",
          modifiers: []
        },
        {
          id: "item-spanish",
          companyId: "company-visual",
          categoryId: "coffee",
          name: "Spanish Latte",
          slug: "spanish-latte",
          description: "Espresso, milk and a soft caramel sweetness.",
          basePriceMinor: 14500,
          effectivePriceMinor: 14500,
          currency: "EGP",
          status: "active",
          isFeatured: true,
          isAvailable: true,
          isVisible: true,
          canOrder: true,
          stockStatus: "low_stock",
          modifiers: []
        },
        {
          id: "item-americano",
          companyId: "company-visual",
          categoryId: "coffee",
          name: "Iced Americano",
          slug: "iced-americano",
          description: "Bright double espresso over ice and water.",
          basePriceMinor: 10500,
          effectivePriceMinor: 10500,
          currency: "EGP",
          status: "active",
          isFeatured: false,
          isAvailable: true,
          isVisible: true,
          canOrder: true,
          stockStatus: "in_stock",
          modifiers: []
        }
      ]
    },
    {
      id: "bakery",
      name: "Bakery",
      slug: "bakery",
      description: "Fresh baked favorites",
      sortOrder: 2,
      status: "active",
      items: [
        {
          id: "item-croissant",
          companyId: "company-visual",
          categoryId: "bakery",
          name: "Butter Croissant",
          slug: "butter-croissant",
          description: "Flaky, buttery and baked this morning.",
          basePriceMinor: 9500,
          effectivePriceMinor: 9500,
          currency: "EGP",
          status: "active",
          isFeatured: true,
          isAvailable: true,
          isVisible: true,
          canOrder: true,
          stockStatus: "in_stock",
          modifiers: []
        }
      ]
    }
  ]
};

const orders = {
  tableSession: { id: SESSION_ID, status: "active" },
  orders: [
    {
      id: "order-1042",
      orderNumber: "B-1042",
      status: "preparing",
      lifecycle: { customerLabel: "Preparing your order" },
      submittedAt: "2026-08-29T03:05:00.000Z"
    }
  ]
};

const timeline = {
  tableSession: { id: SESSION_ID, status: "active" },
  branch: { id: BRANCH_ID, name: "Balcona Zamalek", slug: "balcona-zamalek" },
  table: { id: "table-12", code: "T12", displayName: "Table 12" },
  timeline: [
    { type: "submitted", label: "Order received", occurredAt: "2026-08-29T03:05:00.000Z" },
    { type: "accepted", label: "Accepted by the team", occurredAt: "2026-08-29T03:06:00.000Z" },
    { type: "preparing", label: "Preparing your order", occurredAt: "2026-08-29T03:08:00.000Z" }
  ]
};

const bill = {
  activeBillRequest: {
    id: "bill-request-1",
    status: "ready",
    createdAt: "2026-08-29T03:10:00.000Z"
  },
  activeBill: {
    bill: {
      id: "bill-1",
      billNumber: "BL-1042",
      status: "payment_pending",
      totalMinor: 23500,
      paidMinor: 0,
      balanceDueMinor: 23500,
      currency: "EGP"
    },
    lines: [
      { id: "line-1", quantity: 1, itemNameSnapshot: "Flat White", lineTotalMinor: 14000, currency: "EGP" },
      { id: "line-2", quantity: 1, itemNameSnapshot: "Butter Croissant", lineTotalMinor: 9500, currency: "EGP" }
    ],
    onlinePaymentIntents: [
      {
        id: "intent-1",
        status: "pending",
        provider: "paymob",
        providerCheckoutUrl: "https://checkout.example.test/intent-1"
      }
    ]
  },
  totals: {
    orderCount: 1,
    subtotalMinor: 23500,
    currency: "EGP"
  }
};

const aiMessages = [
  {
    id: "ai-msg-1",
    role: "assistant",
    kind: "text",
    content: "I can help you choose from the menu, adjust modifiers, or call a human waiter."
  },
  {
    id: "ai-msg-2",
    role: "customer",
    kind: "text",
    content: "I want something smooth, not too sweet."
  },
  {
    id: "ai-msg-3",
    role: "assistant",
    kind: "text",
    content: "Try the Flat White. It is smooth and balanced, and I can add oat milk if you prefer."
  }
];

const aiState = {
  tableSession: { id: SESSION_ID, status: "active" },
  session: { id: "ai-session-1", status: "active", language: "en", provider: "stub" },
  messages: aiMessages,
  latestCartProposal: null,
  cartSummary: cart,
  effectiveExperience: {
    brandVoice: { tone: "Warm, concise and useful" },
    aiWaiterTone: {
      title: "Balcona AI Waiter",
      description: "Menu-grounded help for this table."
    }
  }
};

function persistedSession(expired = false) {
  return JSON.stringify({
    state: {
      hasHydrated: true,
      sessionId: SESSION_ID,
      branchId: BRANCH_ID,
      tableId: "table-12",
      qrToken: "visual-table-12",
      customerAccessToken: "visual-token",
      customerAccessTokenExpiresAt: expired
        ? "2020-01-01T00:00:00.000Z"
        : "2099-01-01T00:00:00.000Z",
      customerSessionIdentityId: "visual-identity",
      lastLoadedAt: "2026-08-29T03:00:00.000Z"
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
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();

    if (pathname === "/api/v1/table-sessions/start" && method === "POST") {
      return route.fulfill(json(startSessionResult));
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/experience/effective`) {
      return route.fulfill(json({
        company: { id: "company-visual", name: "Balcona", slug: "balcona" },
        branch: { id: BRANCH_ID, name: "Balcona Zamalek", slug: "balcona-zamalek" },
        profile: null,
        source: "branch",
        contentBlocks: [],
        venueZones: [],
        mediaUsages: [],
        brandVoice: { tone: "Warm, concise and useful" },
        aiWaiterTone: {
          title: "Balcona AI Waiter",
          description: "Menu-grounded help for this table."
        }
      }));
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/menu`) {
      return route.fulfill(json(menu));
    }

    if (pathname === `/api/v1/table-sessions/${SESSION_ID}/cart` && method === "GET") {
      return route.fulfill(json(cart));
    }

    if (pathname === `/api/v1/table-sessions/${SESSION_ID}/cart/validate`) {
      return route.fulfill(json({
        isValid: true,
        issues: [],
        recalculatedTotals: totals,
        cart
      }));
    }

    if (pathname === `/api/v1/table-sessions/${SESSION_ID}/orders`) {
      return route.fulfill(json(orders));
    }

    if (pathname === `/api/v1/table-sessions/${SESSION_ID}/customer-status`) {
      return route.fulfill(json({
        customerStatus: "preparing",
        orders: orders.orders
      }));
    }

    if (pathname === `/api/v1/table-sessions/${SESSION_ID}/customer-timeline`) {
      return route.fulfill(json(timeline));
    }

    if (pathname === `/api/v1/table-sessions/${SESSION_ID}/waiter-calls` && method === "GET") {
      return route.fulfill(json({
        tableSession: { id: SESSION_ID, status: "active" },
        waiterCalls: [
          {
            id: "call-1",
            type: "need_water",
            status: "acknowledged",
            createdAt: "2026-08-29T03:09:00.000Z"
          }
        ]
      }));
    }

    if (pathname === `/api/v1/table-sessions/${SESSION_ID}/bill`) {
      return route.fulfill(json(bill));
    }

    if (pathname === `/api/v1/table-sessions/${SESSION_ID}/ai-waiter`) {
      return route.fulfill(json(aiState));
    }

    if (
      pathname === `/api/v1/table-sessions/${SESSION_ID}/ai-waiter/messages` &&
      method === "GET"
    ) {
      return route.fulfill(json({
        session: aiState.session,
        messages: aiMessages
      }));
    }

    if (pathname === `/api/v1/realtime/table-sessions/${SESSION_ID}/stream`) {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "cache-control": "no-cache" },
        body: "event: ready\ndata: {}\n\n"
      });
    }

    return route.fulfill(json({}));
  });
}

async function newContext(browser, locale = "en") {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
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

  return context;
}

async function capture(browser, {
  label,
  route,
  locale = "en",
  expired = false
}) {
  const context = await newContext(browser, locale);
  const page = await context.newPage();
  const consoleErrors = [];
  const apiRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/")) {
      apiRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  await installApiMocks(page);

  if (route.startsWith("/customer/session/")) {
    await page.goto(`${BASE_URL}/customer/table/visual-table-12`, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    try {
      await page.waitForURL(`**/customer/session/${SESSION_ID}/menu`, {
        timeout: 15000
      });
    } catch (error) {
      const bodyText = (await page.locator("body").innerText()).slice(0, 3000);
      throw new Error(
        `QR bootstrap did not reach production customer menu. url=${page.url()} apiRequests=${JSON.stringify(apiRequests)} body=${JSON.stringify(bodyText)} cause=${String(error)}`
      );
    }

    if (expired) {
      await page.evaluate(() => {
        const key = "balcona_customer_session";
        const raw = window.localStorage.getItem(key);
        if (!raw) {
          throw new Error("customer session was not persisted after QR bootstrap");
        }
        const parsed = JSON.parse(raw);
        parsed.state.customerAccessTokenExpiresAt = "2020-01-01T00:00:00.000Z";
        window.localStorage.setItem(key, JSON.stringify(parsed));
      });
    }

    await page.goto(`${BASE_URL}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    await page.waitForFunction(
      ({ expectExpired }) => {
        const text = document.body.innerText;
        if (expectExpired) {
          return text.includes("expired") || text.includes("انته");
        }
        return !text.includes("Restoring your table") && !text.includes("استعادة");
      },
      { expectExpired: expired },
      { timeout: 15000 }
    );
  } else {
    await page.goto(`${BASE_URL}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });
  }

  await page.waitForTimeout(900);

  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    dir: document.documentElement.dir,
    lang: document.documentElement.lang
  }));

  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    throw new Error(
      `${label}: document overflow ${metrics.scrollWidth}px > ${metrics.clientWidth}px`
    );
  }

  if (locale === "ar" && metrics.dir !== "rtl") {
    throw new Error(`${label}: expected rtl, got ${metrics.dir || "empty"}`);
  }

  const screenshot = path.join(OUTPUT_DIR, `${label}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await context.close();

  return {
    label,
    route,
    locale,
    expired,
    screenshot,
    metrics,
    consoleErrors: consoleErrors.slice(0, 20),
    apiRequests: apiRequests.slice(0, 40)
  };
}

await mkdir(OUTPUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  results.push(await capture(browser, {
    label: "01-production-menu-en-390",
    route: `/customer/session/${SESSION_ID}/menu`
  }));
  results.push(await capture(browser, {
    label: "02-prototype-guest-en-390",
    route: "/prototype/guest"
  }));
  results.push(await capture(browser, {
    label: "03-production-menu-ar-rtl-390",
    route: `/customer/session/${SESSION_ID}/menu`,
    locale: "ar"
  }));
  results.push(await capture(browser, {
    label: "04-prototype-guest-ar-rtl-390",
    route: "/prototype/guest",
    locale: "ar"
  }));
  results.push(await capture(browser, {
    label: "05-production-order-en-390",
    route: `/customer/session/${SESSION_ID}/status`
  }));
  results.push(await capture(browser, {
    label: "06-production-service-bill-en-390",
    route: `/customer/session/${SESSION_ID}/service#bill`
  }));
  results.push(await capture(browser, {
    label: "07-production-ai-waiter-en-390",
    route: `/customer/session/${SESSION_ID}/ai-waiter`
  }));
  results.push(await capture(browser, {
    label: "08-production-expired-session-en-390",
    route: `/customer/session/${SESSION_ID}/menu`,
    expired: true
  }));
} finally {
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  viewport: { width: 390, height: 844 },
  results
};

await writeFile(
  path.join(OUTPUT_DIR, "guest-visual-qa-report.json"),
  JSON.stringify(report, null, 2),
  "utf8"
);

console.log(JSON.stringify(report, null, 2));
