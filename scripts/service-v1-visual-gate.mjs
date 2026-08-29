import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = 'http://127.0.0.1:3001/prototype/service';
await fs.mkdir('qa-artifacts', { recursive: true });

const browser = await chromium.launch();
const failures = [];

async function assertBase(page, name) {
  const m = await page.evaluate(() => ({
    viewport: innerWidth,
    docWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    dir: [...document.querySelectorAll('[dir]')].map((el) => el.getAttribute('dir')).find((value) => value === 'rtl') ?? 'ltr',
    buttons: document.querySelectorAll('button').length,
    body: document.body.innerText
  }));
  if (m.docWidth > m.viewport + 1 || m.bodyWidth > m.viewport + 1) failures.push(`${name}: horizontal overflow ${m.viewport}/${m.docWidth}/${m.bodyWidth}`);
  if (m.buttons < 5) failures.push(`${name}: too few interactive controls`);
  return m;
}

async function openContext(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', e => failures.push(`pageerror: ${e.message}`));
  const r = await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!r?.ok()) failures.push(`HTTP ${r?.status()}`);
  await page.waitForTimeout(250);
  return { context, page };
}

async function shot(page, name) {
  await page.screenshot({ path: `qa-artifacts/${name}.png`, fullPage: true });
}

const desktop = await openContext({ width: 1440, height: 1000 });
await assertBase(desktop.page, 'orders-desktop');
if (!(await desktop.page.getByRole('heading', { name: 'Orders', exact: true }).first().isVisible())) failures.push('orders desktop missing');
await shot(desktop.page, 'service-orders-desktop');

await desktop.page.getByRole('button', { name: 'Floor', exact: true }).click();
if (!(await desktop.page.getByRole('heading', { name: 'Main dining', exact: true }).isVisible())) failures.push('floor view missing');
await shot(desktop.page, 'service-floor-desktop');

await desktop.page.getByRole('button', { name: 'Terrace', exact: true }).click();
if (!(await desktop.page.getByRole('heading', { name: 'Terrace', exact: true }).isVisible())) failures.push('terrace switch failed');
await desktop.page.getByRole('button', { name: /12/ }).first().click().catch(() => {});
await shot(desktop.page, 'service-floor-terrace-desktop');

await desktop.page.getByRole('button', { name: 'Attention', exact: true }).click();
if (!(await desktop.page.getByRole('heading', { name: 'Attention', exact: true }).isVisible())) failures.push('attention view missing');
await shot(desktop.page, 'service-attention-desktop');

await desktop.page.getByRole('button', { name: 'Bills', exact: true }).click();
if (!(await desktop.page.getByRole('heading', { name: 'Bills', exact: true }).isVisible())) failures.push('bills view missing');
await desktop.page.getByText('#B-8819', { exact: true }).first().click();
if (!(await desktop.page.getByText('Payment status unknown', { exact: true }).isVisible())) failures.push('unknown payment safety state missing');
await shot(desktop.page, 'service-bills-unknown-desktop');

await desktop.page.getByRole('button', { name: 'Shift', exact: true }).click();
if (!(await desktop.page.getByRole('heading', { name: 'Cashier shift', exact: true }).isVisible())) failures.push('shift view missing');
await desktop.page.getByRole('button', { name: 'Begin close', exact: true }).click();
if (!(await desktop.page.getByText('Close blockers', { exact: true }).isVisible())) failures.push('close blockers missing');
await shot(desktop.page, 'service-shift-close-desktop');

await desktop.page.getByRole('button', { name: 'Waiter / Floor', exact: true }).click();
if (!(await desktop.page.getByRole('heading', { name: 'Attention', exact: true }).isVisible())) failures.push('waiter mode default did not switch to attention');
await shot(desktop.page, 'service-waiter-mode-desktop');

await desktop.page.getByRole('button', { name: 'العربية', exact: true }).click();
const ar = await assertBase(desktop.page, 'arabic-desktop');
if (ar.dir !== 'rtl') failures.push(`Arabic direction expected rtl, got ${ar.dir}`);
if (!ar.body.includes('التنبيهات')) failures.push('Arabic labels missing');
await shot(desktop.page, 'service-arabic-rtl-desktop');
await desktop.context.close();

const mobile = await openContext({ width: 390, height: 844 });
await assertBase(mobile.page, 'orders-mobile');
await shot(mobile.page, 'service-orders-mobile');

await mobile.page.getByRole('button', { name: 'Waiter / Floor', exact: true }).click();
await shot(mobile.page, 'service-attention-mobile');

await mobile.page.getByRole('button', { name: 'Floor', exact: true }).click();
await assertBase(mobile.page, 'floor-mobile');
await shot(mobile.page, 'service-floor-mobile');

await mobile.page.getByRole('button', { name: 'العربية', exact: true }).click();
const arm = await assertBase(mobile.page, 'arabic-mobile');
if (arm.dir !== 'rtl') failures.push(`Arabic mobile direction expected rtl, got ${arm.dir}`);
await shot(mobile.page, 'service-floor-arabic-mobile');
await mobile.context.close();

await browser.close();

await fs.writeFile('qa-artifacts/report.json', JSON.stringify({
  passed: failures.length === 0,
  failures,
  checked: {
    ordersDesktop: true,
    floorDesktop: true,
    terraceSwitch: true,
    attentionDesktop: true,
    billsUnknownSafety: true,
    shiftCloseBlockers: true,
    waiterMode: true,
    arabicRtlDesktop: true,
    ordersMobile: true,
    attentionMobile: true,
    floorMobile: true,
    arabicRtlMobile: true,
    overflow: true
  }
}, null, 2));

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Service V1 visual gate automation passed.');
