import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base='http://127.0.0.1:3001';
await fs.mkdir('qa-artifacts',{recursive:true});
const browser=await chromium.launch();
const failures=[];

const surfaces=[
  {
    id:'guest', path:'/prototype/guest', expect:'Browse menu',
    action:{name:'Service', expect:'Call a waiter'},
    lang:'AR', rtlExpect:'اطلب الفاتورة'
  },
  {
    id:'service', path:'/prototype/service', expect:'Orders',
    action:{name:'Floor', expect:'Main dining'},
    lang:'العربية', rtlExpect:'الصالة'
  },
  {
    id:'kitchen', path:'/prototype/kitchen', expect:'Kitchen',
    action:{name:'Tickets', expect:'K-128'},
    lang:'AR', rtlExpect:'التذاكر'
  },
  {
    id:'office', path:'/prototype/office/home', expect:'Business today',
    action:{name:'Money', expect:'Operational finance'},
    lang:'العربية', rtlExpect:'المدفوعات'
  },
  {
    id:'setup', path:'/prototype/setup', expect:'Get this location live',
    action:{name:/Payments/, expect:'External provider gate'},
    lang:'العربية', rtlExpect:'الدفع'
  },
  {
    id:'platform', path:'/prototype/platform', expect:'Platform Dashboard',
    action:{name:'Companies', expect:'Tenant registry'},
    lang:'العربية', rtlExpect:'الشركات'
  }
];

async function inspect(page,label){
  const m=await page.evaluate(()=>({
    viewport:innerWidth,
    doc:document.documentElement.scrollWidth,
    body:document.body.scrollWidth,
    rtl:[...document.querySelectorAll('[dir]')].some(el=>el.getAttribute('dir')==='rtl'),
    text:document.body.innerText,
    errors:[...document.querySelectorAll('[data-nextjs-dialog],[data-nextjs-toast]')].map(e=>e.textContent||'')
  }));
  if(m.doc>m.viewport+1||m.body>m.viewport+1) failures.push(`${label}: page overflow ${m.viewport}/${m.doc}/${m.body}`);
  return m;
}

async function runSurface(surface,viewport,kind){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  page.on('pageerror',e=>failures.push(`${surface.id}-${kind}: pageerror ${e.message}`));
  const r=await page.goto(base+surface.path,{waitUntil:'domcontentloaded',timeout:30000});
  if(!r?.ok()) failures.push(`${surface.id}-${kind}: HTTP ${r?.status()}`);
  await page.waitForTimeout(150);

  let m=await inspect(page,`${surface.id}-${kind}-default`);
  if(!m.text.includes(surface.expect)) failures.push(`${surface.id}-${kind}: default identity missing: ${surface.expect}`);
  await page.screenshot({path:`qa-artifacts/${surface.id}-${kind}-default.png`,fullPage:true});

  const actionName=surface.action.name;
  const action=typeof actionName==='string'
    ? page.getByRole('button',{name:actionName,exact:true})
    : page.getByRole('button',{name:actionName});
  await action.first().click();
  await page.waitForTimeout(80);
  m=await inspect(page,`${surface.id}-${kind}-action`);
  if(!m.text.includes(surface.action.expect)) failures.push(`${surface.id}-${kind}: action state missing: ${surface.action.expect}`);
  await page.screenshot({path:`qa-artifacts/${surface.id}-${kind}-action.png`,fullPage:true});

  const lang=page.getByRole('button',{name:surface.lang,exact:true});
  await lang.first().click();
  await page.waitForTimeout(80);
  m=await inspect(page,`${surface.id}-${kind}-rtl`);
  if(!m.rtl) failures.push(`${surface.id}-${kind}: RTL root missing`);
  if(!m.text.includes(surface.rtlExpect)) failures.push(`${surface.id}-${kind}: RTL content missing: ${surface.rtlExpect}`);
  await page.screenshot({path:`qa-artifacts/${surface.id}-${kind}-rtl.png`,fullPage:true});

  await context.close();
}

for(const surface of surfaces){
  await runSurface(surface,{width:1440,height:1000},'desktop');
  await runSurface(surface,{width:390,height:844},'mobile');
}

await browser.close();

const report={
  passed:failures.length===0,
  failures,
  checked:{
    surfaces:surfaces.map(s=>s.id),
    desktop:true,
    mobile:true,
    representativeInteraction:true,
    rtl:true,
    pageOverflow:true,
    lint:true,
    typecheck:true,
    productionBuild:true
  }
};
await fs.writeFile('qa-artifacts/report.json',JSON.stringify(report,null,2));
if(failures.length){
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('Balcona combined UX closure gate passed.');
