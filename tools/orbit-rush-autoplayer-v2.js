(() => {
  'use strict';

  /*
    Orbit Rush Auto-player V2
    =========================
    Uses the game's own canvas render calls to observe exact hazard/player
    positions, then predicts future collisions and steers through the safest
    corridor.

    It does NOT call or modify start / heartbeat / finish, score, duration,
    run_id, token, or leaderboard APIs.

    Controls:
      F8                 toggle
      orbitBot.status()  debug status
      orbitBot.stop()
      orbitBot.start()
      orbitBot.destroy()
  */

  const cv = document.querySelector('#canvas');
  if (!cv) {
    console.error('[OrbitBot V2] #canvas not found');
    return;
  }

  // Remove V1 / an older V2 first.
  if (window.orbitBot?.destroy) {
    try { window.orbitBot.destroy(); } catch (_) {}
  }

  const ctx = cv.getContext('2d');
  if (!ctx) {
    console.error('[OrbitBot V2] 2D context not found');
    return;
  }

  const cfg = {
    enabled: true,
    debug: true,

    // Planning
    candidateCount: 61,
    horizonSec: 2.15,
    followRate: 12.5,          // matches game desktop mouse follow rate
    safetyMargin: 7,
    emergencyMargin: 13,
    movementPenalty: 0.010,
    edgePenalty: 0.12,
    targetSmoothing: 0.86,

    // Tracker
    maxTrackDistance: 90,
    velocitySmoothing: 0.50,

    // Do not chase powerups until survival is reliable.
    powerBias: 0.0
  };

  let enabled = true;
  let destroyed = false;
  let currentHazards = [];
  let currentPowers = [];
  let tracks = [];
  let nextTrackId = 1;
  let hazardSizeScratch = null;
  let player = null;
  let targetX = null;
  let lastPlanScore = 0;
  let lastFrameT = performance.now();
  let shieldVisual = false;

  const original = {
    fillRect: ctx.fillRect,
    moveTo: ctx.moveTo,
    stroke: ctx.stroke
  };

  const hud = document.createElement('div');
  Object.assign(hud.style, {
    position: 'fixed',
    zIndex: 2147483647,
    top: '12px',
    right: '12px',
    padding: '8px 11px',
    borderRadius: '9px',
    background: 'rgba(0,0,0,.76)',
    color: '#fff',
    font: '700 12px/1.38 system-ui,sans-serif',
    pointerEvents: 'none',
    whiteSpace: 'pre',
    backdropFilter: 'blur(6px)'
  });
  document.body.appendChild(hud);

  function cssColor(v) {
    return String(v || '').toLowerCase().replace(/\s+/g, '');
  }

  function isColor(v, hex, rgb) {
    const c = cssColor(v);
    return c === hex || c === rgb;
  }

  function dprX() {
    const r = cv.getBoundingClientRect();
    return cv.width / Math.max(1, r.width);
  }

  function dprY() {
    const r = cv.getBoundingClientRect();
    return cv.height / Math.max(1, r.height);
  }

  function transformedOrigin() {
    const m = ctx.getTransform();
    return {
      x: m.e / Math.max(0.01, dprX()),
      y: m.f / Math.max(0.01, dprY())
    };
  }

  function startFrame() {
    currentHazards = [];
    currentPowers = [];
    hazardSizeScratch = null;
    lastFrameT = performance.now();
  }

  // Detect the first full-canvas background fill at the start of each game frame.
  ctx.fillRect = function(x, y, w, h) {
    if (this === ctx &&
        x === 0 && y === 0 &&
        w > 200 && h > 300 &&
        isColor(this.fillStyle, '#020811', 'rgb(2,8,17)')) {
      startFrame();
    }
    return original.fillRect.apply(this, arguments);
  };

  // During drawHazard(), the first red-X moveTo contains +/- size*.58.
  ctx.moveTo = function(x, y) {
    if (this === ctx &&
        Math.abs(Number(this.lineWidth) - 7) < 0.15 &&
        isColor(this.strokeStyle, '#ff476d', 'rgb(255,71,109)')) {
      const s = Math.max(Math.abs(x), Math.abs(y)) / 0.58;
      if (Number.isFinite(s) && s > 10 && s < 80) {
        hazardSizeScratch = s;
      }
    }
    return original.moveTo.apply(this, arguments);
  };

  ctx.stroke = function() {
    if (this === ctx) {
      const lw = Number(this.lineWidth);
      const style = cssColor(this.strokeStyle);

      // Exact hazard render event.
      if (Math.abs(lw - 7) < 0.15 &&
          (style === '#ff476d' || style === 'rgb(255,71,109)')) {
        const p = transformedOrigin();
        currentHazards.push({
          x: p.x,
          y: p.y,
          size: hazardSizeScratch || 34
        });
        hazardSizeScratch = null;
      }

      // Powerup green ring. Shield ring is also green/3px, but its center is
      // the player; we filter it during planning.
      if (Math.abs(lw - 3) < 0.15 &&
          (style === '#5af1aa' || style === 'rgb(90,241,170)')) {
        const p = transformedOrigin();
        currentPowers.push({ x: p.x, y: p.y });
      }

      // Car body stroke: this happens at the end of drawCar(), after hazards.
      if (Math.abs(lw - 2.4) < 0.16 &&
          (
            style === '#7adfff' ||
            style === 'rgb(122,223,255)' ||
            style === '#5af1aa' ||
            style === 'rgb(90,241,170)'
          )) {
        const p = transformedOrigin();
        player = { x: p.x, y: p.y };
        shieldVisual =
          style === '#5af1aa' || style === 'rgb(90,241,170)';

        if (enabled) {
          updateTracks();
          planAndSteer();
        }
      }
    }

    return original.stroke.apply(this, arguments);
  };

  function updateTracks() {
    const now = performance.now();
    const old = tracks.slice();
    const used = new Set();
    const next = [];

    for (const d of currentHazards) {
      let best = null;
      let bestCost = Infinity;

      for (const tr of old) {
        if (used.has(tr.id)) continue;

        const dt = Math.max(0.001, (now - tr.t) / 1000);
        const px = tr.x + tr.vx * dt;
        const py = tr.y + tr.vy * dt;
        const dx = d.x - px;
        const dy = d.y - py;
        const cost = dx * dx + dy * dy;

        if (cost < bestCost && Math.sqrt(cost) <= cfg.maxTrackDistance) {
          bestCost = cost;
          best = tr;
        }
      }

      if (!best) {
        next.push({
          id: nextTrackId++,
          x: d.x,
          y: d.y,
          size: d.size,
          vx: 0,
          vy: 330,
          t: now,
          age: 1
        });
        continue;
      }

      used.add(best.id);

      const dt = Math.max(0.004, (now - best.t) / 1000);
      const rawVx = (d.x - best.x) / dt;
      const rawVy = (d.y - best.y) / dt;
      const a = cfg.velocitySmoothing;

      next.push({
        id: best.id,
        x: d.x,
        y: d.y,
        size: d.size,
        vx: best.vx * (1 - a) + rawVx * a,
        vy: Math.max(40, best.vy * (1 - a) + rawVy * a),
        t: now,
        age: best.age + 1
      });
    }

    tracks = next;
  }

  function reflectPosition(x, vx, t, lo, hi) {
    if (!(hi > lo)) return x;
    const span = hi - lo;
    const period = span * 2;
    let q = (x - lo + vx * t) % period;
    if (q < 0) q += period;
    if (q > span) q = period - q;
    return lo + q;
  }

  function predictedPlayerX(current, target, t) {
    // x(t) for dx/dt ~= followRate * (target - x)
    return target + (current - target) * Math.exp(-cfg.followRate * t);
  }

  function collisionRiskForCandidate(candidate, w, h) {
    if (!player) return 1e9;

    let risk = 0;
    const currentX = player.x;
    const py = player.y;

    for (const z of tracks) {
      if (z.y > py + 70) continue;

      const vy = Math.max(80, z.vy || 330);
      const radius = Math.max(16, Math.min(36, z.size * 0.76));
      const verticalReach = 18 + radius + cfg.safetyMargin;
      const horizontalReach = 24 + radius + cfg.safetyMargin;

      const centerT = (py - z.y) / vy;
      if (centerT < -0.12 || centerT > cfg.horizonSec) continue;

      const dtBand = verticalReach / vy;
      const times = [
        Math.max(0, centerT - dtBand),
        Math.max(0, centerT),
        Math.max(0, centerT + dtBand)
      ];

      for (const t of times) {
        if (t > cfg.horizonSec) continue;

        const lo = Math.max(z.size, 18);
        const hi = Math.max(lo + 1, w - Math.max(z.size, 18));
        const hx = reflectPosition(z.x, z.vx || 0, t, lo, hi);
        const px = predictedPlayerX(currentX, candidate, t);

        const dx = Math.abs(hx - px);
        const clearance = dx - horizontalReach;

        // Imminent hazards dominate long-term ones.
        const urgency = 1 / Math.max(0.12, t + 0.10);

        if (clearance < 0) {
          const depth = Math.min(2.5, (-clearance) / horizontalReach);
          risk += 1200 * urgency * (1 + depth);
        } else {
          risk += 22 * urgency * Math.exp(-clearance / 24);
        }
      }
    }

    // Penalize crossing an immediately dangerous horizontal zone during the
    // first ~0.25 sec, not only the final target.
    for (const z of tracks) {
      if (z.y < py - 150 || z.y > py + 45) continue;
      const radius = Math.max(16, Math.min(36, z.size * 0.76));
      const reach = 24 + radius + cfg.emergencyMargin;
      const minX = Math.min(currentX, candidate) - reach;
      const maxX = Math.max(currentX, candidate) + reach;
      if (z.x >= minX && z.x <= maxX) {
        const yDist = Math.abs(py - z.y);
        risk += 500 * Math.exp(-yDist / 45);
      }
    }

    // Prefer small movements when equally safe.
    risk += Math.abs(candidate - currentX) * cfg.movementPenalty;

    // Mild edge penalty.
    const edge = Math.min(candidate, w - candidate);
    risk += cfg.edgePenalty * (1 / Math.max(8, edge));

    return risk;
  }

  function planAndSteer() {
    if (!player) return;

    const rect = cv.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w < 100 || h < 200) return;

    const minX = 34;
    const maxX = w - 34;
    const N = cfg.candidateCount;

    let bestX = player.x;
    let bestRisk = Infinity;

    for (let i = 0; i < N; i++) {
      const x = minX + (maxX - minX) * i / (N - 1);
      const r = collisionRiskForCandidate(x, w, h);

      if (r < bestRisk) {
        bestRisk = r;
        bestX = x;
      }
    }

    if (targetX == null) targetX = bestX;

    // If danger is high, respond immediately. Otherwise smooth target changes.
    const alpha = bestRisk > 500 ? 1 : cfg.targetSmoothing;
    targetX += (bestX - targetX) * alpha;
    targetX = Math.max(minX, Math.min(maxX, targetX));
    lastPlanScore = bestRisk;

    const clientX = rect.left + targetX;
    const clientY = rect.top + player.y;

    cv.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      cancelable: true,
      pointerType: 'mouse',
      clientX,
      clientY
    }));

    if (cfg.debug) {
      hud.textContent =
        'ORBIT BOT V2: ' + (enabled ? 'ON' : 'OFF') + '\n' +
        'hazards: ' + tracks.length + '\n' +
        'car: ' + Math.round(player.x) + ' → ' + Math.round(targetX) + '\n' +
        'risk: ' + Math.round(bestRisk) + '\n' +
        'shield: ' + (shieldVisual ? 'YES' : 'NO') + '\n' +
        'F8 = toggle';
    }
  }

  function toggle() {
    enabled = !enabled;
    if (cfg.debug) {
      hud.textContent =
        'ORBIT BOT V2: ' + (enabled ? 'ON' : 'OFF') + '\nF8 = toggle';
    }
  }

  function keyHandler(e) {
    if (e.key === 'F8') {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    enabled = false;

    try { ctx.fillRect = original.fillRect; } catch (_) {}
    try { ctx.moveTo = original.moveTo; } catch (_) {}
    try { ctx.stroke = original.stroke; } catch (_) {}

    window.removeEventListener('keydown', keyHandler, true);
    hud.remove();

    if (window.orbitBot?.destroy === destroy) {
      delete window.orbitBot;
    }

    console.log('[OrbitBot V2] destroyed');
  }

  window.addEventListener('keydown', keyHandler, true);

  window.orbitBot = {
    version: 2,
    start() { enabled = true; },
    stop() { enabled = false; },
    toggle,
    destroy,
    status() {
      return {
        version: 2,
        enabled,
        hazards: tracks.map(z => ({
          id: z.id,
          x: Math.round(z.x),
          y: Math.round(z.y),
          vx: Math.round(z.vx),
          vy: Math.round(z.vy),
          size: Math.round(z.size)
        })),
        player,
        targetX,
        risk: lastPlanScore,
        shieldVisual,
        config: { ...cfg }
      };
    },
    config: cfg
  };

  console.log('[OrbitBot V2] loaded — exact render tracking + predictive steering. F8 toggles.');
})();