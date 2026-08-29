import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const url='http://127.0.0.1:3001/prototype/platform';
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
    text:document.body.innerText,
    scrollers:[...document.querySelectorAll('*')].filter(el=>{
      const s=getComputedStyle(el);
      return (s.overflowX==='auto'||s.overflowX==='scroll')&&el.scrollWidth>el.clientWidth+1;
    }).length
  }));
  if(m.doc>m.viewport+1||m.body>m.viewport+1) failures.push(`${name}: page overflow ${m.viewport}/${m.doc}/${m.body}`);
  return m;
}
async function shot(page,name){await page.screenshot({path:`qa-artifacts/${name}.png`,fullPage:true});}

const desktop=await open({width:1440,height:1000});
const p=desktop.page;
let m=await inspect(p,'dashboard-desktop');
for(const t of ['Platform Dashboard','Tenant attention','Companies','System status']){
  if(!m.text.includes(t)) failures.push('dashboard missing '+t);
}
await shot(p,'platform-dashboard-desktop');

await p.getByText('Terrace Lab',{exact:true}).first().click();
if(!(await p.getByRole('heading',{name:'Terrace Lab',exact:true}).isVisible())) failures.push('company drawer failed');
if(!(await p.getByText('Subscription control',{exact:true}).isVisible())) failures.push('company drawer subscription context missing');
await shot(p,'platform-company-drawer-desktop');
await p.getByRole('button',{name:'Close company detail',exact:true}).last().click();

await p.getByRole('button',{name:'Companies',exact:true}).click();
m=await inspect(p,'companies-desktop');
if(!m.text.includes('All companies')||!m.text.includes('past_due')||!m.text.includes('suspended')) failures.push('companies registry state missing');
await shot(p,'platform-companies-desktop');

await p.getByRole('button',{name:'New Cafe',exact:true}).click();
m=await inspect(p,'new-cafe-desktop');
if(!m.text.includes('Create the tenant foundation')||!m.text.includes('Not created here')) failures.push('bootstrap boundaries missing');
await shot(p,'platform-new-cafe-desktop');

await p.getByRole('button',{name:'Plans',exact:true}).click();
m=await inspect(p,'plans-desktop');
if(!m.text.includes('Real recurring billing remains a separate billing program.')) failures.push('plans billing boundary missing');
await shot(p,'platform-plans-desktop');

await p.getByRole('button',{name:'System Status',exact:true}).click();
m=await inspect(p,'status-desktop');
if(!m.text.includes('Billing provider')||!m.text.includes('Not connected')) failures.push('system status external billing state missing');
await shot(p,'platform-status-desktop');

await p.getByRole('button',{name:'العربية',exact:true}).click();
m=await inspect(p,'status-arabic-desktop');
if(!m.rtl||!m.text.includes('حالة النظام')) failures.push('platform desktop RTL missing');
await shot(p,'platform-status-arabic-desktop');
await desktop.context.close();

const mobile=await open({width:390,height:844});
const mp=mobile.page;
m=await inspect(mp,'dashboard-mobile');
if(!m.text.includes('Platform Dashboard')) failures.push('platform mobile dashboard missing');
await shot(mp,'platform-dashboard-mobile');

await mp.getByRole('button',{name:'Companies',exact:true}).click();
m=await inspect(mp,'companies-mobile');
if(!m.text.includes('All companies')) failures.push('platform mobile companies missing');
await shot(mp,'platform-companies-mobile');

await mp.getByText('Roast House',{exact:true}).first().click();
if(!(await mp.locator('aside.fixed').isVisible())) failures.push('platform mobile drawer missing');
await shot(mp,'platform-company-drawer-mobile');
await mp.getByRole('button',{name:'Close company detail',exact:true}).last().click();

await mp.getByRole('button',{name:'New Cafe',exact:true}).click();
m=await inspect(mp,'new-cafe-mobile');
await shot(mp,'platform-new-cafe-mobile');

await mp.getByRole('button',{name:'العربية',exact:true}).click();
m=await inspect(mp,'new-cafe-arabic-mobile');
if(!m.rtl) failures.push('platform mobile RTL missing');
await shot(mp,'platform-new-cafe-arabic-mobile');
await mobile.context.close();

await browser.close();
await fs.writeFile('qa-artifacts/report.json',JSON.stringify({
  passed:failures.length===0,failures,
  checked:{dashboard:true,tenantAttention:true,companyDrawer:true,companies:true,bootstrap:true,plansBoundary:true,status:true,desktop:true,mobile:true,rtl:true,overflow:true}
},null,2));
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('Platform V1 visual gate passed.');
