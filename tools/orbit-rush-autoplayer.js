(() => {
  'use strict';

  /*
    Orbit Rush visual auto-player
    - Reads only pixels from #canvas.
    - Steers by dispatching pointermove events.
    - Does NOT call start/finish/heartbeat or alter score/duration.
    - F8 toggles the bot.
  */

  const cv = document.querySelector('#canvas');
  if (!cv) {
    console.error('[OrbitBot] #canvas not found.');
    return;
  }

  if (window.orbitBot?.destroy) window.orbitBot.destroy();

  const cfg = {
    analysisFps: 30,
    sampleWidth: 300,
    roadLeft: 0.075,
    roadRight: 0.925,
    playerY: 0.84,
    candidates: 45,
    dangerLookahead: 0.72,
    emergencyBand: 0.20,
    movePenalty: 0.010,
    edgePenalty: 0.22,
    powerBias: 0.38,
    targetSmoothing: 0.72,
    debug: true
  };

  let enabled = true;
  let destroyed = false;
  let raf = 0;
  let lastVisionAt = 0;
  let targetCssX = null;
  let previousTargetCssX = null;
  let lastRisk = 0;

  const eye = document.createElement('canvas');
  const ectx = eye.getContext('2d', { willReadFrequently: true });

  const hud = document.createElement('div');
  Object.assign(hud.style, {
    position: 'fixed',
    zIndex: 2147483647,
    top: '12px',
    right: '12px',
    padding: '8px 11px',
    borderRadius: '9px',
    background: 'rgba(0,0,0,.72)',
    color: '#fff',
    font: '700 12px/1.35 system-ui,sans-serif',
    pointerEvents: 'none',
    whiteSpace: 'pre',
    backdropFilter: 'blur(6px)'
  });
  document.body.appendChild(hud);

  function isHazard(r, g, b, a) {
    return a > 90 &&
      r > 185 &&
      b > 65 &&
      r > g * 1.22 &&
      r > b * 1.10;
  }

  function isPower(r, g, b, a) {
    return a > 100 &&
      g > 175 &&
      g > r * 1.22 &&
      g > b * 1.08 &&
      r < 185;
  }

  function vision() {
    const rect = cv.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 100) return;

    const W = cfg.sampleWidth;
    const H = Math.max(160, Math.round(W * rect.height / rect.width));
    if (eye.width !== W || eye.height !== H) {
      eye.width = W;
      eye.height = H;
    }

    ectx.clearRect(0, 0, W, H);
    ectx.drawImage(cv, 0, 0, W, H);

    let img;
    try {
      img = ectx.getImageData(0, 0, W, H).data;
    } catch (e) {
      console.error('[OrbitBot] Canvas pixels are not readable:', e);
      enabled = false;
      return;
    }

    const left = W * cfg.roadLeft;
    const right = W * cfg.roadRight;
    const py = H * cfg.playerY;
    const topY = Math.max(0, py - H * cfg.dangerLookahead);

    const N = cfg.candidates;
    const cand = new Float32Array(N);
    const risk = new Float64Array(N);
    const reward = new Float64Array(N);

    for (let i = 0; i < N; i++) {
      cand[i] = left + (right - left) * i / (N - 1);
    }

    for (let y = Math.floor(topY); y < Math.min(H, Math.ceil(py + 8)); y += 2) {
      const dy = Math.max(0, py - y);
      const near = Math.exp(-dy / (H * 0.145));
      const emergency = dy < H * cfg.emergencyBand
        ? 1.0 + 2.2 * (1 - dy / (H * cfg.emergencyBand))
        : 1.0;
      const sigma = W * (0.043 + 0.025 * Math.min(1, dy / (H * 0.45)));
      const inv2s2 = 1 / (2 * sigma * sigma);

      for (let x = Math.floor(left); x <= Math.ceil(right); x += 2) {
        const p = (y * W + x) * 4;
        const r = img[p], g = img[p + 1], b = img[p + 2], a = img[p + 3];

        const hz = isHazard(r, g, b, a);
        const pw = !hz && cfg.powerBias > 0 && isPower(r, g, b, a);
        if (!hz && !pw) continue;

        for (let i = 0; i < N; i++) {
          const dx = cand[i] - x;
          const lateral = Math.exp(-(dx * dx) * inv2s2);

          if (hz) {
            risk[i] += near * emergency * lateral;
          } else {
            reward[i] += Math.exp(-dy / (H * 0.19)) * lateral;
          }
        }
      }
    }

    const prevVisionX = previousTargetCssX == null
      ? W / 2
      : (previousTargetCssX / Math.max(1, rect.width)) * W;

    let bestI = 0;
    let bestScore = Infinity;

    for (let i = 0; i < N; i++) {
      const x = cand[i];
      const movement = Math.abs(x - prevVisionX) * cfg.movePenalty;
      const edgeDist = Math.min(x - left, right - x);
      const edge = cfg.edgePenalty / Math.max(1, edgeDist);
      const score = risk[i] + movement + edge - reward[i] * cfg.powerBias;

      if (score < bestScore) {
        bestScore = score;
        bestI = i;
      }
    }

    let chosen = cand[bestI];

    let safestI = 0;
    for (let i = 1; i < N; i++) {
      if (risk[i] < risk[safestI]) safestI = i;
    }
    if (risk[bestI] > risk[safestI] * 1.45 + 0.7) {
      chosen = cand[safestI];
      bestI = safestI;
    }

    const rawCssX = chosen / W * rect.width;
    if (targetCssX == null) targetCssX = rawCssX;
    targetCssX += (rawCssX - targetCssX) * cfg.targetSmoothing;
    previousTargetCssX = targetCssX;
    lastRisk = risk[bestI];

    if (cfg.debug) {
      hud.textContent =
        `ORBIT BOT: ${enabled ? 'ON' : 'OFF'}\n` +
        `target: ${Math.round(targetCssX)} px\n` +
        `risk: ${lastRisk.toFixed(2)}\n` +
        `F8 = toggle`;
    }
  }

  function steer() {
    if (targetCssX == null) return;

    const rect = cv.getBoundingClientRect();
    const x = rect.left + Math.max(1, Math.min(rect.width - 1, targetCssX));
    const y = rect.top + rect.height * cfg.playerY;

    cv.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      cancelable: true,
      pointerType: 'mouse',
      clientX: x,
      clientY: y
    }));
  }

  function loop(now) {
    if (destroyed) return;

    if (enabled) {
      const gap = 1000 / cfg.analysisFps;
      if (now - lastVisionAt >= gap) {
        lastVisionAt = now;
        vision();
      }
      steer();
    } else if (cfg.debug) {
      hud.textContent = 'ORBIT BOT: OFF\nF8 = toggle';
    }

    raf = requestAnimationFrame(loop);
  }

  function toggle() {
    enabled = !enabled;
    cv.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      pointerType: 'mouse'
    }));
    console.log(`[OrbitBot] ${enabled ? 'ON' : 'OFF'}`);
  }

  function destroy() {
    destroyed = true;
    enabled = false;
    cancelAnimationFrame(raf);
    hud.remove();
    window.removeEventListener('keydown', keyHandler, true);
    if (window.orbitBot?.destroy === destroy) delete window.orbitBot;
  }

  function keyHandler(e) {
    if (e.key === 'F8') {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    }
  }

  window.addEventListener('keydown', keyHandler, true);

  window.orbitBot = {
    start() { enabled = true; },
    stop() { enabled = false; },
    toggle,
    destroy,
    config: cfg,
    status() {
      return {
        enabled,
        targetCssX,
        risk: lastRisk,
        config: { ...cfg }
      };
    }
  };

  cv.dispatchEvent(new PointerEvent('pointerup', {
    bubbles: true,
    pointerType: 'mouse'
  }));

  console.log(
    '[OrbitBot] Loaded. Start the game normally. F8 toggles. ' +
    'Controls: orbitBot.start(), orbitBot.stop(), orbitBot.status().'
  );

  raf = requestAnimationFrame(loop);
})();