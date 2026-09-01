(() => {
  'use strict';

  /*
    Orbit Rush V5 — LOCAL GOD MODE
    Console launcher for a PRIVATE / LOCAL copied Orbit Rush page.

    - Hard-blocks 101-creations.com.
    - Clones the current local page into an isolated blob page.
    - Replaces the real API with a local in-memory backend.
    - Blocks every other fetch request in the clone.
    - Disables hazard death.
    - Runs score at 1000 points/second.
    - Auto-finishes at 25,000 points (~25 sec).
  */

  const BLOCKED_HOST_RE = /(^|\.)101-creations\.com$/i;
  const ALLOWED_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '::1'
    // Add your PRIVATE test host here if needed.
  ]);

  const host = location.hostname || '';
  const allowed =
    location.protocol === 'file:' ||
    ALLOWED_HOSTS.has(host) ||
    host.endsWith('.local');

  if (BLOCKED_HOST_RE.test(host)) {
    console.error('[OrbitGod V5] Refusing to run on public 101-creations.com.');
    return;
  }

  if (!allowed) {
    console.error(
      '[OrbitGod V5] Host is not whitelisted:',
      host,
      '\nAdd your PRIVATE test hostname to ALLOWED_HOSTS.'
    );
    return;
  }

  const TARGET_SCORE = 25000;

  const scripts = [...document.scripts];
  const gameScript = scripts.find(s => {
    const t = s.textContent || '';
    return (
      t.includes('orbit-rush') &&
      t.includes('verifiedScore') &&
      t.includes('hazardHitsCar') &&
      t.includes("API+'finish'")
    );
  });

  if (!gameScript) {
    console.error('[OrbitGod V5] Copied Orbit Rush inline script not found.');
    return;
  }

  let src = gameScript.textContent;

  const apiPattern = /const API\s*=\s*"[^"]*orbit-rush\/"\s*,/;
  if (!apiPattern.test(src)) {
    console.error('[OrbitGod V5] API pattern not found.');
    return;
  }
  src = src.replace(apiPattern, 'const API="__ORBIT_LOCAL__/",');

  const verifiedPattern = /const verifiedScore\s*=\s*ms\s*=>\s*[^;]+;/;
  if (!verifiedPattern.test(src)) {
    console.error('[OrbitGod V5] verifiedScore pattern not found.');
    return;
  }
  src = src.replace(
    verifiedPattern,
    'const verifiedScore=ms=>Math.floor(ms);'
  );

  const hitPattern = /function hazardHitsCar\s*\(z\)\s*\{.*?\}/s;
  if (!hitPattern.test(src)) {
    console.error('[OrbitGod V5] hazardHitsCar pattern not found.');
    return;
  }
  src = src.replace(
    hitPattern,
    'function hazardHitsCar(z){return false}'
  );

  const scoreNeedle =
    "scoreEl.textContent=verifiedScore(ms).toLocaleString();";

  if (!src.includes(scoreNeedle)) {
    console.error('[OrbitGod V5] frame score line not found.');
    return;
  }

  src = src.replace(
    scoreNeedle,
    'const __orbitGodScore=verifiedScore(ms);' +
    'scoreEl.textContent=__orbitGodScore.toLocaleString();' +
    'if(__orbitGodScore>=' + TARGET_SCORE + '){return finish(ms)}'
  );

  const transparentGif =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

  src = src.replace(/LOGO\s*=\s*"[^"]*"/, 'LOGO="' + transparentGif + '"');
  src = src.replace(/SHEHAB\s*=\s*"[^"]*"/, 'SHEHAB="' + transparentGif + '"');
  src = src.replace(/ABY\s*=\s*"[^"]*"/, 'ABY="' + transparentGif + '"');

  const localBackend = [
    '<script>',
    '(() => {',
    "'use strict';",
    'const TARGET_SCORE=' + TARGET_SCORE + ';',
    'let personalBest=0;',
    'let runNo=0;',
    'const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{"Content-Type":"application/json"}});',
    'const scoreFor=ms=>Math.floor(Number(ms)||0);',
    'const realFetch=window.fetch;',
    'window.fetch=async function(input,init={}){',
    '  const url=String(input??"");',
    '  if(!url.startsWith("__ORBIT_LOCAL__/")){',
    '    throw new Error("[OrbitGod V5] Offline practice blocked network request: "+url);',
    '  }',
    '  const endpoint=url.slice("__ORBIT_LOCAL__/".length).split("?")[0].replace(/^\\\\/+|\\\\/+$/g,"");',
    '  if(endpoint==="leaderboard"){',
    '    return json({ok:true,top:personalBest?[{name:"LOCAL GOD MODE",score:personalBest}]:[]});',
    '  }',
    '  if(endpoint==="start"){',
    '    runNo++;',
    '    return json({ok:true,run_id:"local-run-"+runNo,token:"local-token-"+runNo,has_ticket:true,top:personalBest?[{name:"LOCAL GOD MODE",score:personalBest}]:[]});',
    '  }',
    '  if(endpoint==="heartbeat"){return json({ok:true});}',
    '  if(endpoint==="finish"){',
    '    let body={};',
    '    try{body=JSON.parse(init.body||"{}")}catch(_){ }',
    '    const score=scoreFor(body.duration_ms);',
    '    personalBest=Math.max(personalBest,score);',
    '    return json({ok:true,score,personal_best:personalBest,rank:1,has_ticket:true,purchase_url:"#",top:[{name:"LOCAL GOD MODE",score:personalBest}]});',
    '  }',
    '  return json({ok:false,message:"Unknown local endpoint: "+endpoint},404);',
    '};',
    'window.__ORBIT_GOD_LOCAL__={targetScore:TARGET_SCORE,get personalBest(){return personalBest},restoreFetch(){window.fetch=realFetch}};',
    'const badge=document.createElement("div");',
    'badge.textContent="LOCAL GOD MODE · OFFLINE · TARGET "+TARGET_SCORE.toLocaleString();',
    'Object.assign(badge.style,{position:"fixed",left:"12px",top:"12px",zIndex:"2147483647",background:"rgba(0,0,0,.86)",color:"#5af1aa",border:"1px solid #5af1aa",borderRadius:"10px",padding:"8px 11px",font:"800 12px/1.2 system-ui,sans-serif",pointerEvents:"none"});',
    'document.addEventListener("DOMContentLoaded",()=>document.body.appendChild(badge),{once:true});',
    '})();',
    '<\\/script>'
  ].join('\n');

  const clone = document.documentElement.cloneNode(true);

  const cloneScripts = [...clone.querySelectorAll('script')];
  const cloneGameScript = cloneScripts.find(s => {
    const t = s.textContent || '';
    return (
      t.includes('orbit-rush') &&
      t.includes('verifiedScore') &&
      t.includes('hazardHitsCar') &&
      t.includes("API+'finish'")
    );
  });

  if (!cloneGameScript) {
    console.error('[OrbitGod V5] Game script not found in cloned DOM.');
    return;
  }

  cloneGameScript.textContent = src;

  for (const s of cloneScripts) {
    if (s !== cloneGameScript && s.src) {
      s.remove();
    }
  }

  let html = '<!doctype html>\n' + clone.outerHTML;

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(
      /<head([^>]*)>/i,
      '<head$1>' + localBackend
    );
  } else {
    html = localBackend + html;
  }

  const blob = new Blob([html], {type:'text/html;charset=utf-8'});
  const blobUrl = URL.createObjectURL(blob);

  console.log(
    '[OrbitGod V5] Opening isolated LOCAL practice clone.',
    '\nGod mode: ON',
    '\nTarget:', TARGET_SCORE,
    '\nExpected time: ~25 seconds'
  );

  const win = window.open(blobUrl, '_blank');

  if (!win) {
    console.error(
      '[OrbitGod V5] Popup blocked. Allow popups for this LOCAL page and run again.'
    );
    URL.revokeObjectURL(blobUrl);
    return;
  }

  setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
})();