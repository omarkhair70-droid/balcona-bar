import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = 'http://127.0.0.1:3001/prototype/guest';
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
  await page.waitForTimeout(200);
  return { context, page };
}

async function baseCheck(page, name) {
  const m = await page.evaluate(() => ({
    viewport: innerWidth,
    docWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    rtl: [...document.querySelectorAll('[dir]')].some(el => el.getAttribute('dir') === 'rtl'),
    body: document.body.innerText,
    fixedNav: !!document.querySelector('nav.fixed')
  }));
  if (m.docWidth > m.viewport + 1 || m.bodyWidth > m.viewport + 1) {
    failures.push(`${name}: horizontal overflow ${m.viewport}/${m.docWidth}/${m.bodyWidth}`);
  }
  return m;
}

async function shot(page, name, fullPage = true) {
  await page.screenshot({ path: `qa-artifacts/${name}.png`, fullPage });
}

const mobile = await open({ width: 390, height: 844 });
const page = mobile.page;

let m = await baseCheck(page, 'menu-mobile');
if (!m.body.includes('Browse menu')) failures.push('menu: default view is not Menu');
if (!m.body.includes('Balkona Main') || !m.body.includes('T12')) failures.push('menu: branch/table context missing');
if (!m.body.includes('Unavailable')) failures.push('menu: unavailable item state missing');
await shot(page, 'guest-menu-mobile');

// Category browsing
await page.getByRole('button', { name: 'Coffee', exact: true }).click();
if (!(await page.getByText('Flat White', { exact: true }).isVisible())) failures.push('menu: Coffee category filter failed');
await page.getByRole('button', { name: 'All', exact: true }).click();

// AI contextual proposal
await page.getByRole('button', { name: /Ask Balcona AI/ }).click();
if (!(await page.getByText('Balcona AI Waiter', { exact: true }).isVisible())) failures.push('ai: sheet did not open');
await page.getByRole('button', { name: 'Oat milk coffee', exact: true }).click();
if (!(await page.getByText('Cart proposal', { exact: true }).isVisible())) failures.push('ai: cart proposal missing');
await shot(page, 'guest-ai-proposal-mobile');
await page.getByRole('button', { name: 'Apply', exact: true }).click();
if (!(await page.getByText('Proposal applied to the cart.', { exact: true }).isVisible())) failures.push('ai: proposal apply state missing');
await page.getByRole('button', { name: 'Close', exact: true }).last().click();
if (!(await page.getByRole('button', { name: /View cart/ }).isVisible())) failures.push('ai: applied proposal did not create cart state');

// Item detail / modifier / note
await page.getByRole('button', { name: /Spanish Latte.*95 EGP/ }).first().click().catch(async () => {
  await page.getByText('Spanish Latte', { exact: true }).first().click();
});
const itemSheet = page.locator('section.fixed').filter({ has: page.getByRole('heading', { name: 'Spanish Latte', exact: true }) });
if (!(await itemSheet.getByRole('heading', { name: 'Spanish Latte', exact: true }).isVisible())) failures.push('item: detail sheet missing');
await page.getByRole('button', { name: 'Oat milk', exact: true }).click();
const itemNote = page.locator('section.fixed textarea').first();
await itemNote.fill('Less sweet');
await shot(page, 'guest-item-detail-mobile');
await page.getByRole('button', { name: /Add to cart/ }).click();

// Cart review / order note
await page.getByRole('button', { name: /View cart/ }).click();
if (!(await page.getByRole('heading', { name: 'Review order', exact: true }).isVisible())) failures.push('cart: review sheet missing');
const cartNote = page.locator('section.fixed textarea').last();
await cartNote.fill('Serve together');
await shot(page, 'guest-cart-review-mobile');
await page.getByRole('button', { name: /Place order/ }).click();

// Order lifecycle
if (!(await page.getByRole('heading', { name: 'Order sent', exact: true }).isVisible())) failures.push('order: submit did not move to status');
await shot(page, 'guest-order-submitted-mobile');
for (let i = 0; i < 3; i++) {
  await page.getByRole('button', { name: 'Prototype control: advance status', exact: true }).click();
}
if (!(await page.getByRole('heading', { name: 'Ready to serve', exact: true }).isVisible())) failures.push('order: lifecycle advance failed');
await shot(page, 'guest-order-ready-mobile');

// Service / waiter state
await page.getByRole('button', { name: 'Service', exact: true }).click();
await page.getByRole('button', { name: /Call a waiter/ }).click();
if (!(await page.getByText('Team notified · waiting for acknowledgement', { exact: true }).isVisible())) failures.push('service: waiter active state missing');
await shot(page, 'guest-service-waiter-mobile');

// Bill/payment unknown safety
await page.getByRole('button', { name: /Request the bill/ }).click();
if (!(await page.getByRole('heading', { name: 'Bill requested', exact: true }).isVisible())) failures.push('bill: requested state missing');
await page.getByRole('button', { name: 'Prototype control: present bill', exact: true }).click();
if (!(await page.getByRole('button', { name: 'Pay online', exact: true }).isVisible())) failures.push('bill: presented/pay action missing');
await shot(page, 'guest-bill-presented-mobile');
await page.getByRole('button', { name: 'Pay online', exact: true }).click();
if (!(await page.getByText('Payment pending', { exact: true }).isVisible())) failures.push('payment: pending state missing');
await page.getByRole('button', { name: 'Simulate unknown', exact: true }).click();
if (!(await page.getByText("We're checking your payment", { exact: true }).isVisible())) failures.push('payment: unknown state missing');
if (!(await page.getByText("Don't pay again yet. This is not the same as a failed payment.", { exact: true }).isVisible())) failures.push('payment: unknown safety copy missing');
await shot(page, 'guest-payment-unknown-mobile');

// Arabic / RTL on unresolved financial state
await page.getByRole('button', { name: 'AR', exact: true }).click();
m = await baseCheck(page, 'arabic-mobile');
if (!m.rtl) failures.push('arabic: RTL missing');
if (!m.body.includes('بنتأكد من حالة الدفع')) failures.push('arabic: payment unknown translation missing');
await shot(page, 'guest-payment-unknown-arabic-mobile');
await mobile.context.close();

// Desktop containment / responsive smoke
const desktop = await open({ width: 1440, height: 1000 });
const dm = await baseCheck(desktop.page, 'menu-desktop');
if (!dm.body.includes('Browse menu')) failures.push('desktop: menu missing');
await shot(desktop.page, 'guest-menu-desktop');
await desktop.context.close();

await browser.close();

await fs.writeFile('qa-artifacts/report.json', JSON.stringify({
  passed: failures.length === 0,
  failures,
  checked: {
    menuDefault: true,
    tableContext: true,
    categoryBrowse: true,
    availability: true,
    aiProposalApply: true,
    itemModifiersAndNote: true,
    cartOrderNote: true,
    orderSubmitAndTimeline: true,
    waiterCallState: true,
    billRequestAndPresented: true,
    paymentPendingAndUnknown: true,
    arabicRtl: true,
    desktopContainment: true,
    horizontalOverflow: true
  }
}, null, 2));

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Guest V1 visual gate automation passed.');
