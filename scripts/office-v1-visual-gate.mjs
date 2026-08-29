import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = 'http://127.0.0.1:3001/prototype/office/home';
await fs.mkdir('qa-artifacts', { recursive: true });
const browser = await chromium.launch();
const failures = [];

async function open(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', e => failures.push(`pageerror: ${e.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') failures.push(`console: ${msg.text()}`);
  });
  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!response?.ok()) failures.push(`HTTP ${response?.status()}`);
  await page.waitForTimeout(180);
  return { context, page };
}

async function inspect(page, name, allowInnerTableScroll = true) {
  const m = await page.evaluate(() => {
    const viewport = innerWidth;
    const docWidth = document.documentElement.scrollWidth;
    const bodyWidth = document.body.scrollWidth;
    const wideScrollable = [...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return (s.overflowX === 'auto' || s.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1;
    }).length;
    return {
      viewport, docWidth, bodyWidth, wideScrollable,
      rtl: [...document.querySelectorAll('[dir]')].some(el => el.getAttribute('dir') === 'rtl'),
      body: document.body.innerText
    };
  });
  if (m.docWidth > m.viewport + 1 || m.bodyWidth > m.viewport + 1) {
    failures.push(`${name}: page-level horizontal overflow ${m.viewport}/${m.docWidth}/${m.bodyWidth}`);
  }
  if (!allowInnerTableScroll && m.wideScrollable) failures.push(`${name}: unexpected inner horizontal scroller`);
  return m;
}

async function shot(page, name, fullPage = true) {
  await page.screenshot({ path: `qa-artifacts/${name}.png`, fullPage });
}

async function domain(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(80);
}

async function section(page, name) {
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(80);
}

const desktop = await open({ width: 1440, height: 1000 });
const page = desktop.page;

let m = await inspect(page, 'home-desktop');
for (const text of ['Needs attention', 'Collected', 'Orders', 'Locations']) {
  if (!m.body.includes(text)) failures.push(`home: missing ${text}`);
}
if (!(await page.getByLabel('Search Balcona').isVisible())) failures.push('office shell: search entry missing on desktop');
await shot(page, 'office-home-all-locations-desktop');

// Scope discipline
await page.getByRole('button', { name: /All locations/ }).click();
m = await inspect(page, 'home-main-scope');
if (!m.body.includes('Balkona Main operational snapshot')) failures.push('scope: branch scope did not update Home');
await shot(page, 'office-home-main-branch-desktop');
await page.getByRole('button', { name: /Balkona Main/ }).first().click();

// Operations
await domain(page, 'Operations');
if (!(await page.getByRole('heading', { name: 'Operations', exact: true }).isVisible())) failures.push('operations: domain missing');
await section(page, 'Orders');
if (!((await page.locator('body').innerText()).includes('#ORD-10428'))) failures.push('operations/orders: representative rows missing');
await shot(page, 'office-operations-orders-desktop');
await section(page, 'Service & Attention');
await shot(page, 'office-operations-attention-desktop');

// Detail drawer
await page.getByText('Guest requested waiter', { exact: true }).click();
if (!(await page.getByRole('heading', { name: 'Guest requested waiter', exact: true }).isVisible())) failures.push('drawer: record detail did not open');
await shot(page, 'office-detail-drawer-desktop');
await page.getByRole('button', { name: 'Close', exact: true }).click();

// Catalog
await domain(page, 'Catalog');
await section(page, 'Availability');
await inspect(page, 'catalog-availability-desktop');
await shot(page, 'office-catalog-availability-desktop');

// Inventory
await domain(page, 'Inventory');
await section(page, 'Stock');
await shot(page, 'office-inventory-stock-desktop');
await section(page, 'Purchase Orders');
await shot(page, 'office-inventory-purchase-orders-desktop');
await section(page, 'Receiving');
await shot(page, 'office-inventory-receiving-desktop');

// Locations
await domain(page, 'Locations');
await section(page, 'Floors & Tables');
await shot(page, 'office-locations-floors-tables-desktop');

// Team
await domain(page, 'Team');
await section(page, 'Roles & Access');
await shot(page, 'office-team-roles-desktop');

// Money
await domain(page, 'Money');
await section(page, 'Overview');
m = await inspect(page, 'money-overview-desktop');
if (!m.body.includes('Needs review') && !m.body.includes('Payment issues')) failures.push('money: exception state not prominent');
await shot(page, 'office-money-overview-desktop');
await section(page, 'Reconciliation');
await shot(page, 'office-money-reconciliation-desktop');
await section(page, 'Issues');
await shot(page, 'office-money-issues-desktop');

// Insights
await domain(page, 'Insights');
await section(page, 'Sales');
await shot(page, 'office-insights-sales-desktop');

// Experience
await domain(page, 'Experience');
await section(page, 'AI Waiter');
await shot(page, 'office-experience-ai-desktop');

// Settings
await domain(page, 'Settings');
await section(page, 'Branch Operations');
await shot(page, 'office-settings-branch-desktop');

// RTL representative deep Office
await page.getByRole('button', { name: 'العربية', exact: true }).click();
m = await inspect(page, 'settings-arabic-desktop');
if (!m.rtl) failures.push('office: RTL missing');
if (!m.body.includes('تشغيل الفرع')) failures.push('office: Arabic deep section missing');
await shot(page, 'office-settings-arabic-desktop');

await desktop.context.close();

// Handheld containment. Office stays desktop-first; tables may scroll internally,
// but the page itself must never overflow.
const mobile = await open({ width: 390, height: 844 });
const mp = mobile.page;
m = await inspect(mp, 'home-mobile');
if (!m.body.includes('Home')) failures.push('mobile: Office Home missing');
await shot(mp, 'office-home-mobile');

await domain(mp, 'Money');
await section(mp, 'Issues');
m = await inspect(mp, 'money-issues-mobile');
if (m.wideScrollable < 1) failures.push('mobile: dense Office table should be internally scrollable rather than compressed');
await shot(mp, 'office-money-issues-mobile');

await mp.getByText('#PAY-24079', { exact: true }).click().catch(async () => {
  const firstRowButton = mp.locator('tbody button').first();
  await firstRowButton.click();
});
if (!(await mp.locator('aside.fixed').isVisible())) failures.push('mobile: detail drawer missing');
await shot(mp, 'office-detail-drawer-mobile');
await mp.locator('aside.fixed').getByRole('button', { name: /Close|إغلاق/ }).last().click();

await mp.getByRole('button', { name: 'العربية', exact: true }).click();
m = await inspect(mp, 'money-arabic-mobile');
if (!m.rtl) failures.push('mobile: RTL missing');
await shot(mp, 'office-money-arabic-mobile');

await mobile.context.close();
await browser.close();

await fs.writeFile('qa-artifacts/report.json', JSON.stringify({
  passed: failures.length === 0,
  failures,
  checked: {
    homeCompanyPulse: true,
    scopeSwitch: true,
    desktopSearchEntry: true,
    operationsOrdersAndAttention: true,
    recordDrawer: true,
    catalogAvailability: true,
    inventoryStockPurchaseReceiving: true,
    locationsFloorsTables: true,
    teamRoles: true,
    moneyOverviewReconciliationIssues: true,
    insightsSales: true,
    experienceAi: true,
    settingsBranch: true,
    arabicRtlDesktop: true,
    handheldContainment: true,
    denseTableInternalScroll: true,
    handheldDrawer: true,
    arabicRtlMobile: true
  }
}, null, 2));

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Office V1 visual gate automation passed.');
