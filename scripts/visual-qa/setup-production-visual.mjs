import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire("/tmp/balcona-setup-visual-qa/package.json");
const { chromium } = require("playwright");

const BASE_URL = process.env.BALCONA_VISUAL_BASE_URL ?? "http://localhost:3001";
const OUTPUT_DIR = path.resolve("artifacts/setup-visual-qa");

const COMPANY_ID = "company-setup-visual";
const BRANCH_ID = "branch-setup-visual";

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
  slug: "main",
  address: "Main Street",
  status: "active"
};

const permissions = [
  "tenant_onboarding.read",
  "tenant_onboarding.manage",
  "staff.manage",
  "menu.read"
];

const access = {
  companies: [{ company, branchScope: "all_branches", roles: ["owner"], permissions }],
  branches: [{ company, branch, source: "company_membership", roles: ["owner"], permissions }],
  roles: ["owner"],
  permissions
};

const staffUser = {
  id: "staff-setup-visual",
  email: "owner@balcona.local",
  name: "Omar Owner",
  status: "active"
};

const staffSession = {
  id: "staff-session-setup-visual",
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  staffUserId: staffUser.id,
  status: "active",
  expiresAt: "2099-01-01T00:00:00.000Z"
};

const checklist = [
  ["company_profile", "Company profile complete", "ready", "Company name, slug, and active status are set.", "/staff/setup"],
  ["branch_profile", "Branch profile complete", "ready", "Branch name, slug, address, and active status are set.", "/staff/setup"],
  ["floors_created", "Floors or areas created", "ready", "2 floor or area records ready.", "/staff/setup"],
  ["tables_created", "Active tables created", "ready", "18 active tables ready.", "/staff/setup"],
  ["qr_links_ready", "QR links ready", "ready", "Every active table has a QR token.", "/staff/branches"],
  ["owner_staff_ready", "Owner or manager ready", "ready", "2 matching staff assignments found.", "/staff/setup"],
  ["cashier_staff_ready", "Cashier ready", "ready", "1 matching staff assignment found.", "/staff/setup"],
  ["kitchen_staff_ready", "Kitchen or barista ready", "ready", "1 matching staff assignment found.", "/staff/kitchen"],
  ["waiter_staff_ready", "Waiter ready", "ready", "1 matching staff assignment found.", "/staff/waiter"],
  ["menu_categories_ready", "Menu categories ready", "ready", "5 active categories ready.", "/staff/menu"],
  ["menu_items_ready", "Active menu items ready", "ready", "24 branch-available items.", "/staff/menu"],
  ["modifiers_ready", "Modifier structure checked", "ready", "Modifier groups are linked.", "/staff/menu"],
  ["ai_waiter_menu_grounding_ready", "AI waiter menu grounding ready", "ready", "Grounding is ready.", "/staff/menu"],
  ["inventory_foundation_ready", "Inventory foundation ready", "ready", "Inventory and branch stock are ready.", "/staff/inventory"],
  ["cashier_shift_ready", "Cashier shift can open", "ready", "Cashier role and active tables are ready.", "/staff/cashier"],
  ["printer_foundation_ready", "Printer foundation ready", "needs_attention", "Software print lifecycle is ready; physical transport remains a venue gate.", "/staff/kitchen"],
  ["bills_payment_ready", "Bill and manual payment flow ready", "ready", "Bill presentation and manual payment are enabled.", "/staff/cashier"],
  ["online_payment_provider_ready", "Online payment provider foundation", "needs_attention", "External merchant activation remains required.", "/staff/cashier"],
  ["kds_ready", "KDS ticket system ready", "ready", "Kitchen staff can work tasks and tickets.", "/staff/kitchen"],
  ["analytics_ready", "Owner analytics access ready", "ready", "Owner analytics access exists.", "/staff/owner"]
].map(([key,label,status,reason,actionHref]) => ({ key,label,status,reason,actionHref }));

const sections = [
  { key: "company_profile", label: "Company profile", status: "ready", readyCount: 1, totalCount: 1, percentage: 100, items: checklist.filter((i)=>i.key==="company_profile") },
  { key: "branch_profile", label: "Branch profile", status: "ready", readyCount: 1, totalCount: 1, percentage: 100, items: checklist.filter((i)=>i.key==="branch_profile") },
  { key: "tables_qr", label: "Tables and QR", status: "ready", readyCount: 3, totalCount: 3, percentage: 100, items: checklist.filter((i)=>["floors_created","tables_created","qr_links_ready"].includes(i.key)) },
  { key: "staff_setup", label: "Staff setup", status: "ready", readyCount: 4, totalCount: 4, percentage: 100, items: checklist.filter((i)=>i.key.endsWith("_staff_ready")) },
  { key: "menu_readiness", label: "Menu readiness", status: "ready", readyCount: 4, totalCount: 4, percentage: 100, items: checklist.filter((i)=>i.key.startsWith("menu_") || i.key==="modifiers_ready" || i.key==="ai_waiter_menu_grounding_ready") },
  { key: "operations_readiness", label: "Operations readiness", status: "needs_attention", readyCount: 4, totalCount: 6, percentage: 67, items: checklist.filter((i)=>["cashier_shift_ready","printer_foundation_ready","bills_payment_ready","online_payment_provider_ready","kds_ready","analytics_ready"].includes(i.key)) }
];

const onboarding = {
  company,
  branch,
  generatedAt: "2026-08-29T17:00:00.000Z",
  sections,
  tables: {
    floorCount: 2,
    tableCount: 18,
    activeTableCount: 18,
    qrReadyTableCount: 18,
    missingQrTableCount: 0,
    floors: [{ id: "floor-1", branchId: BRANCH_ID, name: "Main Floor", sortOrder: 0 }],
    recentTables: [
      { id:"table-1", branchId:BRANCH_ID, floorId:"floor-1", code:"T01", displayName:"Table 01", capacity:2, qrToken:"balcona-main-t01", status:"active", customerPreviewPath:"/customer/table/balcona-main-t01" }
    ]
  },
  staff: {
    total: 5,
    roleCounts: { owner:1, branch_manager:1, cashier:1, waiter:1, kitchen:1 },
    staff: [
      { membership:{id:"m1",companyId:COMPANY_ID,branchId:BRANCH_ID,role:"owner",status:"active"}, staffUser:{id:"u1",email:"owner@balcona.local",name:"Omar Owner",status:"active",passwordSetAt:"2026-08-01T08:00:00.000Z"} }
    ]
  },
  menu: {
    activeCategoryCount: 5,
    totalItemCount: 24,
    activeItemCount: 24,
    availableItemCount: 24,
    branchOverrideCount: 24,
    activeModifierGroupCount: 6,
    itemModifierLinkCount: 12,
    itemsWithModifiersCount: 12,
    missingPriceItemCount: 0,
    aiWaiterMenuGroundingReady: true,
    inventoryItemCount: 16,
    trackedInventoryLevelCount: 16,
    lowStockCount: 1,
    outOfStockCount: 0
  },
  operations: {
    operatingSettings: { operatingMode:"live", serviceMode:"table_service", aiWaiterEnabled:true, billFlowEnabled:true, analyticsEnabled:true },
    smartCashierSettings: { enabled:true, mode:"assist" },
    featureFlags: { ai_waiter:true, inventory:true, online_payments:true, smart_cashier:true },
    printerStationCount: 3,
    activePrinterStationCount: 3,
    currentOpenShift: null,
    cashierShiftCanOpen: true
  },
  launchChecklist: checklist,
  launchSummary: {
    status: "ready_for_demo",
    readyForDemo: true,
    readyForPilot: false,
    blockedReasons: [],
    missingCriticalCount: 0,
    totalCriticalCount: 13
  }
};

const companyOnboarding = {
  company,
  branches: [branch],
  staff: { total:5, roleCounts:onboarding.staff.roleCounts, companyScopedCount:1, branchScopedCount:4 },
  menu: { activeCategoryCount:5, activeItemCount:24 },
  sections: [],
  launchSummary: onboarding.launchSummary
};

function persistedStaffSession() {
  return JSON.stringify({
    state: {
      accessToken: "setup-visual-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      staffUser,
      staffSession,
      effectiveAccess: access,
      defaultBranch: branch,
      selectedBranchId: BRANCH_ID,
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

    if (pathname === "/api/v1/staff-auth/me") {
      return route.fulfill(json({ staffUser, staffSession, staffAccess: access }));
    }
    if (pathname === `/api/v1/branches/${BRANCH_ID}/onboarding`) {
      return route.fulfill(json(onboarding));
    }
    if (pathname === `/api/v1/companies/${COMPANY_ID}/onboarding`) {
      return route.fulfill(json(companyOnboarding));
    }
    if (pathname === `/api/v1/branches/${BRANCH_ID}/onboarding/launch-checklist`) {
      return route.fulfill(json({
        company,
        branch,
        launchChecklist: checklist,
        launchSummary: onboarding.launchSummary,
        generatedAt: onboarding.generatedAt
      }));
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

  await context.addCookies([{ name:"balcona_locale", value:locale, url:BASE_URL }]);
  await context.addInitScript(({ localeValue, staffValue }) => {
    window.localStorage.setItem("balcona.locale", localeValue);
    window.localStorage.setItem("balcona_staff_session", staffValue);
  }, { localeValue:locale, staffValue:persistedStaffSession() });

  return context;
}

async function capture(browser, { label, locale="en", viewport={width:1440,height:1000}, phaseLabel }) {
  const context = await newContext(browser, locale, viewport);
  const page = await context.newPage();
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await installApiMocks(page);
  await page.goto(`${BASE_URL}/staff/setup`, { waitUntil:"domcontentloaded", timeout:30000 });

  const title = locale === "ar" ? "جهّز الفرع للتشغيل" : "Get this location live";
  await page.waitForTimeout(800);
  const titleLocator = page.getByText(title, { exact:true });
  if (!(await titleLocator.isVisible())) {
    const bodyText = (await page.locator("body").innerText()).slice(0, 1800);
    throw new Error(`${label}: Setup title not visible. Body: ${bodyText}`);
  }

  const phaseLinks = page.locator('nav[aria-label] button');
  if (await phaseLinks.count() !== 10) {
    throw new Error(`${label}: expected 10 Setup phases, got ${await phaseLinks.count()}`);
  }

  if (phaseLabel) {
    const phaseButton = page.locator('nav[aria-label] button').filter({ hasText: phaseLabel }).first();
    await phaseButton.waitFor({ state:"visible", timeout:5000 });
    await phaseButton.click();
    await page.waitForTimeout(250);
  }

  await page.waitForTimeout(350);

  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    dir: document.documentElement.dir,
    lang: document.documentElement.lang
  }));

  if (metrics.scrollWidth > metrics.clientWidth || metrics.bodyScrollWidth > metrics.clientWidth) {
    throw new Error(`${label}: document horizontal overflow ${JSON.stringify(metrics)}`);
  }

  if (consoleErrors.length > 0) {
    throw new Error(`${label}: console errors: ${consoleErrors.join(" | ")}`);
  }

  const screenshot = path.join(OUTPUT_DIR, `${label}.png`);
  await page.screenshot({ path:screenshot, fullPage:true });

  await context.close();
  return { label, locale, viewport, phaseLabel, metrics, consoleErrors, screenshot };
}

await mkdir(OUTPUT_DIR, { recursive:true });
const browser = await chromium.launch({ headless:true });
const results = [];

try {
  results.push(await capture(browser, { label:"01-setup-business-desktop", phaseLabel:"Business" }));
  results.push(await capture(browser, { label:"02-setup-final-desktop", phaseLabel:"Final readiness" }));
  results.push(await capture(browser, { label:"03-setup-tables-mobile-390", viewport:{width:390,height:844}, phaseLabel:"Tables & QR" }));
  results.push(await capture(browser, { label:"04-setup-final-ar-rtl-390", locale:"ar", viewport:{width:390,height:844}, phaseLabel:"الجاهزية النهائية" }));
} finally {
  await browser.close();
}

await writeFile(
  path.join(OUTPUT_DIR, "setup-visual-qa-report.json"),
  JSON.stringify({ generatedAt:new Date().toISOString(), baseUrl:BASE_URL, results }, null, 2)
);
