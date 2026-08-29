import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire("/tmp/balcona-platform-visual-qa/package.json");
const { chromium } = require("playwright");

const BASE_URL = process.env.BALCONA_VISUAL_BASE_URL ?? "http://localhost:3001";
const OUTPUT_DIR = path.resolve("artifacts/platform-visual-qa");

const admin = {
  id: "platform-admin-visual",
  email: "ops@balcona.local",
  name: "Balcona Ops",
  role: "owner",
  status: "active",
  lastLoginAt: "2026-08-29T17:00:00.000Z"
};

const session = {
  id: "platform-session-visual",
  platformAdminUserId: admin.id,
  status: "active",
  expiresAt: "2099-01-01T00:00:00.000Z",
  lastUsedAt: "2026-08-29T17:00:00.000Z"
};

const plans = [
  {
    id: "plan-pilot",
    code: "pilot",
    name: "Pilot",
    status: "active",
    description: "Internal pilot plan",
    monthlyPriceMinor: null,
    currency: "EGP",
    maxBranches: 2,
    maxTables: 50,
    maxStaffUsers: 30,
    maxMenuItems: 300,
    maxInventoryItems: 300,
    maxAiMessagesPerMonth: 20000,
    setupEnabled: true,
    kdsEnabled: true,
    inventoryEnabled: true,
    onlinePaymentsEnabled: true,
    ownerAnalyticsEnabled: true,
    aiWaiterEnabled: true,
    multiBranchEnabled: true,
    advancedReportsEnabled: true,
    sortOrder: 0
  },
  {
    id: "plan-starter",
    code: "starter",
    name: "Starter",
    status: "active",
    description: "Single-location baseline",
    monthlyPriceMinor: 149900,
    currency: "EGP",
    maxBranches: 1,
    maxTables: 25,
    maxStaffUsers: 10,
    maxMenuItems: 150,
    maxInventoryItems: 150,
    maxAiMessagesPerMonth: 5000,
    setupEnabled: true,
    kdsEnabled: true,
    inventoryEnabled: true,
    onlinePaymentsEnabled: true,
    ownerAnalyticsEnabled: true,
    aiWaiterEnabled: false,
    multiBranchEnabled: false,
    advancedReportsEnabled: false,
    sortOrder: 1
  },
  {
    id: "plan-growth",
    code: "growth",
    name: "Growth",
    status: "active",
    description: "Multi-location capability",
    monthlyPriceMinor: 299900,
    currency: "EGP",
    maxBranches: 5,
    maxTables: 100,
    maxStaffUsers: 50,
    maxMenuItems: 500,
    maxInventoryItems: 500,
    maxAiMessagesPerMonth: 30000,
    setupEnabled: true,
    kdsEnabled: true,
    inventoryEnabled: true,
    onlinePaymentsEnabled: true,
    ownerAnalyticsEnabled: true,
    aiWaiterEnabled: true,
    multiBranchEnabled: true,
    advancedReportsEnabled: true,
    sortOrder: 2
  },
  {
    id: "plan-enterprise",
    code: "enterprise",
    name: "Enterprise",
    status: "active",
    description: "Negotiated limits",
    monthlyPriceMinor: null,
    currency: "EGP",
    maxBranches: null,
    maxTables: null,
    maxStaffUsers: null,
    maxMenuItems: null,
    maxInventoryItems: null,
    maxAiMessagesPerMonth: null,
    setupEnabled: true,
    kdsEnabled: true,
    inventoryEnabled: true,
    onlinePaymentsEnabled: true,
    ownerAnalyticsEnabled: true,
    aiWaiterEnabled: true,
    multiBranchEnabled: true,
    advancedReportsEnabled: true,
    sortOrder: 3
  }
];

function subscription(id, companyId, plan, status) {
  return {
    id,
    companyId,
    planId: plan.id,
    status,
    currentPeriodStart: "2026-08-01T00:00:00.000Z",
    currentPeriodEnd: "2026-09-01T00:00:00.000Z",
    plan
  };
}

const companies = [
  {
    id: "cmp-01",
    name: "Balcona Bar",
    slug: "balcona-bar",
    status: "active",
    createdAt: "2026-08-01T08:00:00.000Z",
    subscription: subscription("sub-01", "cmp-01", plans[0], "active"),
    branchCount: 1,
    staffMembershipCount: 7
  },
  {
    id: "cmp-02",
    name: "Nile Corner",
    slug: "nile-corner",
    status: "active",
    createdAt: "2026-08-08T08:00:00.000Z",
    subscription: subscription("sub-02", "cmp-02", plans[2], "trialing"),
    branchCount: 3,
    staffMembershipCount: 22
  },
  {
    id: "cmp-03",
    name: "Roast House",
    slug: "roast-house",
    status: "active",
    createdAt: "2026-08-12T08:00:00.000Z",
    subscription: subscription("sub-03", "cmp-03", plans[1], "past_due"),
    branchCount: 1,
    staffMembershipCount: 9
  },
  {
    id: "cmp-04",
    name: "Terrace Lab",
    slug: "terrace-lab",
    status: "active",
    createdAt: "2026-08-16T08:00:00.000Z",
    subscription: subscription("sub-04", "cmp-04", plans[1], "suspended"),
    branchCount: 1,
    staffMembershipCount: 4
  }
];

const companiesResult = {
  companies,
  summary: {
    totalCompanies: 4,
    activeSubscriptions: 1,
    trialingSubscriptions: 1,
    suspendedSubscriptions: 1
  }
};

const systemInfo = {
  name: "balcona-api",
  version: "0.1.0",
  environment: "production",
  appEnvironment: "production",
  nodeEnvironment: "production",
  apiPrefix: "/api/v1",
  gitSha: "platform-visual",
  migration: { status: "ok", check: "current" },
  timestamp: "2026-08-29T17:00:00.000Z"
};

function persistedPlatformSession() {
  return JSON.stringify({
    state: {
      accessToken: "platform-visual-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      platformAdminUser: admin,
      platformAdminSession: session,
      lastLoadedAt: "2026-08-29T17:00:00.000Z"
    },
    version: 0
  });
}

function json(body, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

async function installApiMocks(page) {
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;

    if (pathname === "/api/v1/platform-auth/me") {
      return route.fulfill(json({ platformAdminUser: admin, platformAdminSession: session }));
    }

    if (pathname === "/api/v1/platform/companies") {
      return route.fulfill(json(companiesResult));
    }

    if (pathname === "/api/v1/platform/plans") {
      return route.fulfill(json({ plans }));
    }

    if (pathname === "/api/v1/system/info") {
      return route.fulfill(json(systemInfo));
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
    { name: "balcona_locale", value: locale, url: BASE_URL }
  ]);

  await context.addInitScript(({ localeValue, sessionValue }) => {
    window.localStorage.setItem("balcona.locale", localeValue);
    window.localStorage.setItem("balcona_platform_session", sessionValue);
  }, { localeValue: locale, sessionValue: persistedPlatformSession() });

  return context;
}

async function capture(browser, {
  label,
  pathName,
  locale = "en",
  viewport = { width: 1440, height: 1000 },
  afterOpen
}) {
  const context = await newContext(browser, locale, viewport);
  const page = await context.newPage();
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await installApiMocks(page);
  await page.goto(`${BASE_URL}${pathName}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  await page.locator('nav[aria-label="Platform"]').waitFor({
    state: "visible",
    timeout: 15000
  });

  if (afterOpen) {
    await afterOpen(page);
  }

  await page.waitForTimeout(450);

  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    dir: document.documentElement.dir,
    lang: document.documentElement.lang
  }));

  if (
    metrics.scrollWidth > metrics.clientWidth ||
    metrics.bodyScrollWidth > metrics.clientWidth
  ) {
    throw new Error(`${label}: document horizontal overflow ${JSON.stringify(metrics)}`);
  }

  if (consoleErrors.length > 0) {
    throw new Error(`${label}: console errors: ${consoleErrors.join(" | ")}`);
  }

  const screenshot = path.join(OUTPUT_DIR, `${label}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await context.close();

  return { label, pathName, locale, viewport, metrics, consoleErrors, screenshot };
}

await mkdir(OUTPUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  results.push(await capture(browser, {
    label: "01-platform-dashboard-desktop",
    pathName: "/platform"
  }));

  results.push(await capture(browser, {
    label: "02-platform-attention-drawer-desktop",
    pathName: "/platform",
    afterOpen: async (page) => {
      const attention = page.getByText("Tenant attention", { exact: true });
      await attention.waitFor({ state: "visible", timeout: 15000 });
      const row = page.getByText("Roast House", { exact: true }).first();
      await row.click();
      await page.getByText("Tenant summary", { exact: true }).waitFor({ state: "visible", timeout: 5000 });
    }
  }));

  results.push(await capture(browser, {
    label: "03-platform-companies-desktop",
    pathName: "/platform/companies"
  }));

  results.push(await capture(browser, {
    label: "04-platform-bootstrap-desktop",
    pathName: "/platform/companies/new"
  }));

  results.push(await capture(browser, {
    label: "05-platform-plans-desktop",
    pathName: "/platform/plans"
  }));

  results.push(await capture(browser, {
    label: "06-platform-status-desktop",
    pathName: "/platform/status"
  }));

  results.push(await capture(browser, {
    label: "07-platform-companies-mobile-390",
    pathName: "/platform/companies",
    viewport: { width: 390, height: 844 }
  }));

  results.push(await capture(browser, {
    label: "08-platform-dashboard-ar-rtl-390",
    pathName: "/platform",
    locale: "ar",
    viewport: { width: 390, height: 844 }
  }));
} finally {
  await browser.close();
}

await writeFile(
  path.join(OUTPUT_DIR, "platform-visual-qa-report.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: BASE_URL, results }, null, 2)
);
