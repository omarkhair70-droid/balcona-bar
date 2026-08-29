import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const url='http://127.0.0.1:3001/prototype/setup';
await fs.mkdir('qa-artifacts',{recursive:true});
const browser=await chromium.launch();
const failures=[];

async function open(viewport){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  page.on('pageerror',e=>failures.push('pageerror: '+e.message));
  const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  if(!r?.ok()) failures.push('HTTP '+r?.status());
  await page.waitForTimeout(150);
  return {context,page};
}

async function inspect(page,name){
  const m=await page.evaluate(()=>({
    viewport:innerWidth,
    doc:document.documentElement.scrollWidth,
    body:document.body.scrollWidth,
    rtl:[...document.querySelectorAll('[dir]')].some(e=>e.getAttribute('dir')==='rtl'),
    text:document.body.innerText
  }));
  if(m.doc>m.viewport+1||m.body>m.viewport+1) failures.push(`${name}: horizontal overflow ${m.viewport}/${m.doc}/${m.body}`);
  return m;
}
async function shot(page,name){await page.screenshot({path:`qa-artifacts/${name}.png`,fullPage:true});}

const desktop=await open({width:1440,height:1000});
const p=desktop.page;
let m=await inspect(p,'menu-desktop');
if(!m.text.includes('Get this location live')||!m.text.includes('Launch progress')) failures.push('Setup Home structure missing');
await shot(p,'setup-menu-desktop');

for(const [label,file,expect] of [
  ['Tables & QR','setup-tables-desktop','Tables and QR entry are ready.'],
  ['Team','setup-team-desktop','One role still needs handoff.'],
  ['Kitchen / Devices','setup-kitchen-desktop','physical print remains a venue check'],
  ['Payments','setup-payments-desktop','live merchant certification is not'],
  ['Final readiness','setup-final-desktop','Not ready for live activation yet.']
]){
  await p.getByRole('button',{name:new RegExp(label)}).click();
  await p.waitForTimeout(50);
  const text=await p.locator('body').innerText();
  if(!text.includes(expect)) failures.push(`${label}: expected readiness copy missing`);
  await shot(p,file);
}

await p.getByRole('button',{name:'العربية'}).click();
m=await inspect(p,'final-arabic-desktop');
if(!m.rtl||!m.text.includes('لسه مش جاهز للتفعيل الحي')) failures.push('Setup Arabic RTL/final state missing');
await shot(p,'setup-final-arabic-desktop');
await desktop.context.close();

const mobile=await open({width:390,height:844});
const mp=mobile.page;
m=await inspect(mp,'menu-mobile');
if(!m.text.includes('Get this location live')) failures.push('Setup mobile heading missing');
await shot(mp,'setup-menu-mobile');
await mp.getByRole('button',{name:/Payments/}).click();
m=await inspect(mp,'payments-mobile');
if(!m.text.includes('External provider gate')) failures.push('Setup mobile external gate missing');
await shot(mp,'setup-payments-mobile');
await mp.getByRole('button',{name:/Final readiness/}).click();
await shot(mp,'setup-final-mobile');
await mp.getByRole('button',{name:'العربية'}).click();
m=await inspect(mp,'final-arabic-mobile');
if(!m.rtl) failures.push('Setup mobile RTL missing');
await shot(mp,'setup-final-arabic-mobile');
await mobile.context.close();

await browser.close();
await fs.writeFile('qa-artifacts/report.json',JSON.stringify({
  passed:failures.length===0,failures,
  checked:{phaseNavigation:true,progress:true,tables:true,team:true,kitchen:true,paymentsExternalGate:true,finalNoGo:true,desktop:true,mobile:true,rtl:true,overflow:true}
},null,2));
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('Setup V1 visual gate passed.');
