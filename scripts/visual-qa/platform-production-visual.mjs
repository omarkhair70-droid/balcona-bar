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

const companyDetail = {
  company: companies[0],
  subscription: companies[0].subscription,
  plan: plans[0],
  branches: [
    {
      id: "branch-01",
      companyId: "cmp-01",
      name: "Downtown",
      slug: "downtown",
      address: "Cairo",
      status: "active",
      floorsCount: 1,
      tablesCount: 12
    }
  ],
  owners: [],
  saas: {
    company: companies[0],
    subscription: companies[0].subscription,
    plan: plans[0],
    entitlements: {},
    usage: {},
    limits: {},
    warnings: [],
    blockers: []
  },
  auditEvents: [
    {
      id: "audit-01",
      action: "company_subscription_updated",
      targetType: "company",
      targetId: "cmp-01",
      metadata: { planCode: "pilot", status: "active" },
      createdAt: "2026-08-29T17:30:00.000Z",
      platformAdminUser: admin
    },
    {
      id: "audit-02",
      action: "company_bootstrapped",
      targetType: "company",
      targetId: "cmp-01",
      metadata: { branchSlug: "downtown", starterTableCount: 12 },
      createdAt: "2026-08-01T08:00:00.000Z",
      platformAdminUser: admin
    }
  ]
};

const demoRequests = [
  {
    id: "lead-01",
    fullName: "Mariam Adel",
    businessName: "Nile Bakery",
    email: "mariam@nile-bakery.example",
    phone: "+201000000001",
    city: "Cairo",
    locationCount: 2,
    message: "We are opening a second location and need service, kitchen and office workflows.",
    consent: true,
    source: "request-demo",
    utmSource: "linkedin",
    utmMedium: "social",
    utmCampaign: "hospitality-ops",
    status: "new",
    internalNotes: "",
    lastContactedAt: null,
    createdAt: "2026-08-30T08:30:00.000Z",
    updatedAt: "2026-08-30T08:30:00.000Z"
  },
  {
    id: "lead-02",
    fullName: "Youssef Nabil",
    businessName: "Roast Yard",
    email: "ops@roast-yard.example",
    phone: null,
    city: "Alexandria",
    locationCount: 1,
    message: null,
    consent: true,
    source: "request-demo",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    status: "contacted",
    internalNotes: "Discovery call scheduled.",
    lastContactedAt: "2026-08-30T09:00:00.000Z",
    createdAt: "2026-08-29T15:00:00.000Z",
    updatedAt: "2026-08-30T09:00:00.000Z"
  }
];

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

    if (pathname === "/api/v1/platform/companies/cmp-01") {
      return route.fulfill(json(companyDetail));
    }

    if (pathname === "/api/v1/platform/demo-requests") {
      const url = new URL(route.request().url());
      const status = url.searchParams.get("status");
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const requests = demoRequests.filter((lead) => {
        const statusMatches = !status || lead.status === status;
        const searchMatches =
          !search ||
          lead.fullName.toLowerCase().includes(search) ||
          lead.businessName.toLowerCase().includes(search) ||
          lead.email.toLowerCase().includes(search);
        return statusMatches && searchMatches;
      });
      return route.fulfill(json({ requests, total: requests.length }));
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

async function newContext(browser, locale, viewport, authenticated = true) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: locale === "ar" ? "ar-EG" : "en-US"
  });

  await context.addCookies([
    { name: "balcona_locale", value: locale, url: BASE_URL }
  ]);

  await context.addInitScript(({ localeValue, sessionValue, isAuthenticated }) => {
    window.localStorage.setItem("balcona.locale", localeValue);
    if (isAuthenticated) {
      window.localStorage.setItem("balcona_platform_session", sessionValue);
    } else {
      window.localStorage.removeItem("balcona_platform_session");
    }
  }, {
    localeValue: locale,
    sessionValue: persistedPlatformSession(),
    isAuthenticated: authenticated
  });

  return context;
}

async function capture(browser, {
  label,
  pathName,
  locale = "en",
  viewport = { width: 1440, height: 1000 },
  readyText,
  afterOpen,
  authenticated = true
}) {
  const context = await newContext(browser, locale, viewport, authenticated);
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

  if (readyText) {
    await page.getByText(readyText, { exact: true }).first().waitFor({
      state: "visible",
      timeout: 15000
    });
  }

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
    label: "00-platform-login-desktop",
    pathName: "/platform/login",
    readyText: "Platform login",
    authenticated: false
  }));

  results.push(await capture(browser, {
    label: "00b-platform-unauthorized-desktop",
    pathName: "/platform/companies",
    readyText: "Platform login required",
    authenticated: false
  }));

  results.push(await capture(browser, {
    label: "01-platform-dashboard-desktop",
    pathName: "/platform",
    readyText: "Tenant attention"
  }));

  results.push(await capture(browser, {
    label: "02-platform-attention-drawer-desktop",
    pathName: "/platform",
    readyText: "Tenant attention",
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
    pathName: "/platform/companies",
    readyText: "All companies"
  }));

  results.push(await capture(browser, {
    label: "03b-platform-company-detail-desktop",
    pathName: "/platform/companies/cmp-01",
    readyText: "Platform activity"
  }));

  results.push(await capture(browser, {
    label: "03c-platform-leads-detail-desktop",
    pathName: "/platform/leads",
    readyText: "Matching requests",
    afterOpen: async (page) => {
      await page.getByText("Nile Bakery", { exact: true }).click();
      await page.getByText("Consent & provenance", { exact: true }).waitFor({
        state: "visible",
        timeout: 5000
      });
    }
  }));

  results.push(await capture(browser, {
    label: "04-platform-bootstrap-desktop",
    pathName: "/platform/companies/new",
    readyText: "Create the tenant foundation"
  }));

  results.push(await capture(browser, {
    label: "05-platform-plans-desktop",
    pathName: "/platform/plans",
    readyText: "Internal plan and entitlement model"
  }));

  results.push(await capture(browser, {
    label: "06-platform-status-desktop",
    pathName: "/platform/status",
    readyText: "Web API target"
  }));

  results.push(await capture(browser, {
    label: "07-platform-companies-mobile-390",
    pathName: "/platform/companies",
    viewport: { width: 390, height: 844 },
    readyText: "All companies"
  }));

  results.push(await capture(browser, {
    label: "08-platform-dashboard-ar-rtl-390",
    pathName: "/platform",
    locale: "ar",
    viewport: { width: 390, height: 844 },
    readyText: "تنبيهات الشركات"
  }));
} finally {
  await browser.close();
}

await writeFile(
  path.join(OUTPUT_DIR, "platform-visual-qa-report.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: BASE_URL, results }, null, 2)
);
