import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire("/tmp/balcona-marketing-visual-qa/package.json");
const { chromium } = require("playwright");

const BASE_URL =
  process.env.BALCONA_VISUAL_BASE_URL ?? "http://localhost:3001";
const OUTPUT_DIR = path.resolve("artifacts/marketing-s1-visual-qa");

const publicRoutes = [
  "/",
  "/product",
  "/product/guest-experience",
  "/product/service",
  "/product/kitchen",
  "/product/office",
  "/product/setup",
  "/product/multi-location",
  "/solutions/independent-cafes",
  "/solutions/multi-branch",
  "/pricing",
  "/demo",
  "/request-demo",
  "/login",
  "/support",
];

const evidence = {
  baseUrl: BASE_URL,
  generatedAt: new Date().toISOString(),
  routes: {},
  checks: [],
  screenshots: [],
};

const failures = [];

function record(name, pass, details = "") {
  evidence.checks.push({ name, pass, details });
  if (!pass) {
    failures.push(details ? `${name}: ${details}` : name);
  }
}

async function settle(page, milliseconds = 450) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(milliseconds);
}

async function openRoute(page, route) {
  const response = await page.goto(`${BASE_URL}${route}`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await settle(page, 250);
  const status = response?.status() ?? 0;
  evidence.routes[route] = status;
  record(`route ${route}`, status >= 200 && status < 400, `HTTP ${status}`);

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  record(
    `no horizontal overflow ${route}`,
    dimensions.scrollWidth <= dimensions.clientWidth + 2,
    `${dimensions.scrollWidth}px scroll vs ${dimensions.clientWidth}px viewport`,
  );
}

async function screenshot(page, name) {
  const target = path.join(OUTPUT_DIR, name);
  await page.screenshot({ path: target, fullPage: true });
  evidence.screenshots.push(name);
}

async function openMobileNavigation(page) {
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  await toggle.waitFor({ state: "visible" });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await toggle.getAttribute("aria-expanded")) === "true") {
      return;
    }

    await toggle.click();
    await page.waitForTimeout(350);
  }

  await page
    .locator("#marketing-mobile-navigation")
    .waitFor({ state: "visible", timeout: 5_000 });
}

async function fillDemoRequest(page, suffix) {
  await page.getByLabel("Your name").fill(`Marketing QA ${suffix}`);
  await page.getByLabel("Business name").fill(`Balcona QA ${suffix}`);
  await page.getByLabel("Work email").fill(
    `marketing.qa+${suffix.toLowerCase()}@example.com`,
  );
  await page.getByLabel("Phone").fill("+201000000000");
  await page.getByLabel("City").fill("Cairo");
  await page.getByLabel("Number of locations").fill("2");
  await page
    .getByLabel("What should we understand before the demo?")
    .fill("Validate the connected Guest, Service, Kitchen, Office and Setup flow.");
  await page.getByRole("checkbox").check();
}

await mkdir(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1,
  });
  const page = await desktop.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const route of publicRoutes) {
    await openRoute(page, route);
  }

  await openRoute(page, "/");
  const primaryCta = page.getByRole("link", { name: "Request a live demo" }).first();
  record(
    "home primary CTA is visible",
    await primaryCta.isVisible(),
    "Request a live demo",
  );

  if (await primaryCta.isVisible()) {
    const ctaStyle = await primaryCta.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        color: styles.color,
        backgroundColor: styles.backgroundColor,
      };
    });
    record(
      "dark CTA foreground survives CSS cascade",
      ctaStyle.color !== ctaStyle.backgroundColor &&
        ctaStyle.color !== "rgba(0, 0, 0, 0)",
      JSON.stringify(ctaStyle),
    );
  }

  const productTour = page.getByRole("link", { name: "Take the product tour" });
  record(
    "home links to public product tour",
    (await productTour.getAttribute("href")) === "/demo",
    (await productTour.getAttribute("href")) ?? "missing href",
  );

  const blankLinks = await page.locator('a[href=""], a:not([href])').count();
  record("home has no empty anchors", blankLinks === 0, `${blankLinks} empty anchors`);
  await screenshot(page, "desktop-home.png");

  await openRoute(page, "/demo");
  const demoBody = await page.locator("body").innerText();
  record(
    "demo does not fake sandbox availability",
    demoBody.includes("Request a live demo") &&
      demoBody.includes("isolated seeded demo tenant"),
    "fallback demo state must stay truthful while sandbox URL is unset",
  );
  record(
    "demo hides self-serve CTA until sandbox exists",
    (await page.getByText("Try Balcona Demo", { exact: true }).count()) === 0,
    "Try Balcona Demo should be environment-gated",
  );
  await screenshot(page, "desktop-demo.png");

  await openRoute(page, "/product/service");
  await screenshot(page, "desktop-product-service.png");

  await openRoute(page, "/request-demo");
  await screenshot(page, "desktop-request-demo.png");

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.emulateMedia({ reducedMotion: "reduce" });

  await openRoute(mobilePage, "/");
  const mobileMenu = mobilePage.getByRole("button", { name: "Toggle navigation" });
  await openMobileNavigation(mobilePage);
  record(
    "mobile navigation exposes key CTAs",
    (await mobilePage.getByRole("link", { name: "Request a demo" }).count()) > 0 &&
      (await mobilePage.getByRole("link", { name: "Sign in" }).count()) > 0,
    "request-demo and sign-in",
  );
  await screenshot(mobilePage, "mobile-home-menu.png");

  await openRoute(mobilePage, "/request-demo");
  await screenshot(mobilePage, "mobile-request-demo.png");

  const rtl = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const rtlPage = await rtl.newPage();
  await rtlPage.emulateMedia({ reducedMotion: "reduce" });
  await openRoute(rtlPage, "/");
  await openMobileNavigation(rtlPage);
  await rtlPage.getByRole("button", { name: "العربية", exact: true }).last().click();
  await rtlPage.waitForFunction(() => document.documentElement.dir === "rtl");
  const rtlState = await rtlPage.evaluate(() => ({
    dir: document.documentElement.dir,
    lang: document.documentElement.lang,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  record("representative RTL direction", rtlState.dir === "rtl", JSON.stringify(rtlState));
  record(
    "RTL has no horizontal overflow",
    rtlState.scrollWidth <= rtlState.clientWidth + 2,
    JSON.stringify(rtlState),
  );
  await screenshot(rtlPage, "rtl-mobile-home.png");

  const success = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const successPage = await success.newPage();
  await successPage.route("**/public/demo-requests", async (route) => {
    const request = route.request();
    record(
      "demo form submits to persisted public API",
      request.method() === "POST",
      `${request.method()} ${request.url()}`,
    );
    const payload = request.postDataJSON();
    record(
      "demo payload retains consent and source",
      payload?.consent === true && payload?.source === "marketing-site",
      JSON.stringify({
        consent: payload?.consent,
        source: payload?.source,
        locationCount: payload?.locationCount,
      }),
    );
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "marketing-visual-lead-1",
        status: "new",
        createdAt: "2026-08-30T10:30:00.000Z",
      }),
    });
  });
  await openRoute(successPage, "/request-demo");
  await fillDemoRequest(successPage, "Success");
  await successPage.getByRole("button", { name: "Request the demo" }).click();
  await successPage
    .getByRole("heading", { name: "Request received." })
    .waitFor({ timeout: 10_000 });
  record(
    "demo form success state",
    (await successPage.getByText("marketing-visual-lead-1").count()) > 0,
    "reference ID rendered",
  );
  await screenshot(successPage, "form-success.png");

  const failure = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const failurePage = await failure.newPage();
  await failurePage.route("**/public/demo-requests", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        code: "demo_request_rate_limit_exceeded",
        message: "Too many demo requests. Try again later.",
        retryAfter: 420,
      }),
    });
  });
  await openRoute(failurePage, "/request-demo");
  await fillDemoRequest(failurePage, "Failure");
  await failurePage.getByRole("button", { name: "Request the demo" }).click();
  const alert = failurePage.locator('form [role="alert"]').last();
  await alert.waitFor({ state: "visible", timeout: 10_000 });
  const alertText = await alert.innerText();
  record(
    "demo form failure state",
    alertText.toLowerCase().includes("too many demo requests"),
    alertText,
  );
  await screenshot(failurePage, "form-failure.png");

  await desktop.close();
  await mobile.close();
  await rtl.close();
  await success.close();
  await failure.close();
} catch (error) {
  failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  await browser.close();
}

evidence.failures = failures;
evidence.passed = failures.length === 0;
await writeFile(
  path.join(OUTPUT_DIR, "report.json"),
  JSON.stringify(evidence, null, 2),
  "utf8",
);
await writeFile(
  path.join(OUTPUT_DIR, "summary.txt"),
  [
    `Marketing S1 visual QA: ${evidence.passed ? "PASS" : "FAIL"}`,
    `Routes checked: ${Object.keys(evidence.routes).length}`,
    `Checks: ${evidence.checks.length}`,
    `Screenshots: ${evidence.screenshots.length}`,
    failures.length ? `Failures:\n- ${failures.join("\n- ")}` : "Failures: none",
  ].join("\n"),
  "utf8",
);

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Marketing S1 visual QA passed with ${evidence.screenshots.length} screenshots.\n`,
  );
}
