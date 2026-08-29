import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = 'http://127.0.0.1:3001/prototype/kitchen';
await fs.mkdir('qa-artifacts', { recursive: true });

const browser = await chromium.launch();
const failures = [];

async function openContext(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', e => failures.push(`pageerror: ${e.message}`));
  const response = await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!response?.ok()) failures.push(`HTTP ${response?.status()}`);
  await page.waitForTimeout(250);
  return { context, page };
}

async function inspectBase(page, name) {
  const m = await page.evaluate(() => ({
    viewport: innerWidth,
    docWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    hasRtl: [...document.querySelectorAll('[dir]')].some(el => el.getAttribute('dir') === 'rtl'),
    body: document.body.innerText,
    buttons: document.querySelectorAll('button').length
  }));
  if (m.docWidth > m.viewport + 1 || m.bodyWidth > m.viewport + 1) failures.push(`${name}: horizontal overflow ${m.viewport}/${m.docWidth}/${m.bodyWidth}`);
  if (m.buttons < 6) failures.push(`${name}: too few controls`);
  return m;
}

async function shot(page, name) {
  await page.screenshot({ path: `qa-artifacts/${name}.png`, fullPage: true });
}

const desktop = await openContext({ width: 1440, height: 1000 });
await inspectBase(desktop.page, 'board-desktop');
if (!(await desktop.page.getByRole('heading', { name: 'Kitchen', exact: true }).first().isVisible())) failures.push('Kitchen board heading missing');
if (!(await desktop.page.getByText('18m', { exact: true }).first().isVisible())) failures.push('oldest/late age missing');
await shot(desktop.page, 'kitchen-board-desktop');

const startButton = desktop.page.getByRole('button', { name: 'Start', exact: true }).first();
await startButton.click();
if (!(await desktop.page.getByRole('button', { name: 'Mark ready', exact: true }).first().isVisible())) failures.push('task Start did not advance to in-progress');
await shot(desktop.page, 'kitchen-board-after-start-desktop');

await desktop.page.getByRole('button', { name: 'Barista', exact: true }).click();
if (!(await desktop.page.getByRole('heading', { name: 'Barista', exact: true }).first().isVisible())) failures.push('Barista station switch failed');
await shot(desktop.page, 'kitchen-barista-board-desktop');

await desktop.page.getByRole('button', { name: 'Dessert', exact: true }).click();
if (!(await desktop.page.getByRole('heading', { name: 'Dessert', exact: true }).first().isVisible())) failures.push('Dessert station switch failed');

await desktop.page.getByRole('button', { name: 'Expediter', exact: true }).click();
if (!(await desktop.page.getByRole('heading', { name: 'Expediter', exact: true }).first().isVisible())) failures.push('Expediter station switch failed');
await shot(desktop.page, 'kitchen-expediter-board-desktop');

await desktop.page.getByRole('button', { name: 'Tickets', exact: true }).click();
if (!(await desktop.page.getByText('K-128', { exact: true }).isVisible())) failures.push('Expediter ticket aggregation missing');
await shot(desktop.page, 'kitchen-expediter-tickets-desktop');

await desktop.page.getByRole('button', { name: 'Barista', exact: true }).click();
await desktop.page.getByRole('button', { name: 'Print', exact: true }).click();
if (!(await desktop.page.getByText('Printer unreachable', { exact: true }).isVisible())) failures.push('failed print exception missing');
await shot(desktop.page, 'kitchen-print-failed-desktop');

await desktop.page.getByRole('button', { name: 'Retry', exact: true }).click();
if (await desktop.page.getByText('Printer unreachable', { exact: true }).isVisible().catch(() => false)) failures.push('Retry did not clear failed print error');
if (!(await desktop.page.getByRole('button', { name: 'Mark printed', exact: true }).isVisible())) failures.push('Retry did not move print job to pending');
await shot(desktop.page, 'kitchen-print-retry-desktop');

await desktop.page.getByRole('button', { name: 'AR', exact: true }).click();
const ar = await inspectBase(desktop.page, 'arabic-desktop');
if (!ar.hasRtl) failures.push('Arabic desktop RTL missing');
if (!ar.body.includes('حالة الطباعة التشغيلية')) failures.push('Arabic print labels missing');
await shot(desktop.page, 'kitchen-arabic-rtl-desktop');
await desktop.context.close();

const mobile = await openContext({ width: 390, height: 844 });
await inspectBase(mobile.page, 'board-mobile');
await shot(mobile.page, 'kitchen-board-mobile');

await mobile.page.getByRole('button', { name: 'Tickets', exact: true }).click();
await inspectBase(mobile.page, 'tickets-mobile');
await shot(mobile.page, 'kitchen-tickets-mobile');

await mobile.page.getByRole('button', { name: 'Print', exact: true }).click();
await inspectBase(mobile.page, 'print-mobile');
await shot(mobile.page, 'kitchen-print-mobile');

await mobile.page.getByRole('button', { name: 'AR', exact: true }).click();
const arm = await inspectBase(mobile.page, 'arabic-mobile');
if (!arm.hasRtl) failures.push('Arabic mobile RTL missing');
await shot(mobile.page, 'kitchen-print-arabic-mobile');
await mobile.context.close();

await browser.close();

await fs.writeFile('qa-artifacts/report.json', JSON.stringify({
  passed: failures.length === 0,
  failures,
  checked: {
    boardDesktop: true,
    taskAdvance: true,
    barista: true,
    dessert: true,
    expediter: true,
    ticketsDesktop: true,
    printFailure: true,
    printRetry: true,
    arabicRtlDesktop: true,
    boardMobile: true,
    ticketsMobile: true,
    printMobile: true,
    arabicRtlMobile: true,
    overflow: true
  }
}, null, 2));

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Kitchen V1 visual gate automation passed.');
