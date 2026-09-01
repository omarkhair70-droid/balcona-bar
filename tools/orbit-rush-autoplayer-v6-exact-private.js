(() => {
  'use strict';

  /*
    Orbit Rush Autoplayer V6 — PRIVATE / LOCAL COPY ONLY
    ====================================================
    Pure autoplayer. The game rules are NOT modified.

    Key change vs V5:
    - Instead of estimating hazard state from canvas pixels/render matching,
      V6 passively observes Array.push/splice to keep references to the exact
      hazard and power objects created by the game itself.
    - It reads x/y/vx/vy/size directly from those objects.
    - It still uses normal pointermove steering only.
    - It does NOT alter score, collision logic, spawn logic, timers, API calls,
      duration_ms, run_id, token, leaderboard, shield or HYPE behavior.

    Host guard:
    - blocked on 101-creations.com and subdomains;
    - allowed on file://, localhost, 127.0.0.1, ::1, *.local,
      or a private hostname explicitly added to ALLOWED_HOSTS.
  */

  // ---------------------------------------------------------------------------
  // Host guard ONLY
  // ---------------------------------------------------------------------------

  const BLOCKED_HOST_RE = /(^|\.)101-creations\.com$/i;

  const ALLOWED_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '::1'
    // Add your own PRIVATE test hostname here if needed:
    // 'orbit-private.example.com'
  ]);

  const host = location.hostname || '';
  const isFile = location.protocol === 'file:';
  const allowed =
    isFile ||
    ALLOWED_HOSTS.has(host) ||
    host.endsWith('.local');

  if (BLOCKED_HOST_RE.test(host)) {
    console.error('[OrbitBot V6] Refusing to run on public 101-creations.com.');
    return;
  }

  if (!allowed) {
    console.error(
      '[OrbitBot V6] Host is not whitelisted:',
      host,
      '\nAdd your PRIVATE test hostname to ALLOWED_HOSTS.'
    );
    return;
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  const cv = document.querySelector('#canvas');
  if (!cv) {
    console.error('[OrbitBot V6] #canvas not found.');
    return;
  }

  if (window.orbitBot?.destroy) {
    try { window.orbitBot.destroy(); } catch (_) {}
  }

  const ctx = cv.getContext('2d');
  if (!ctx) {
    console.error('[OrbitBot V6] 2D context not found.');
    return;
  }

  const cfg = {
    debug: true,

    // Planner time resolution
    dt: 0.045,
    replanEveryMs: 18,

    // Candidate x positions
    laneCount: 151,
    beamWidth: 260,

    // Collision model from the game
    playerHalfWidth: 24,
    playerHalfHeight: 18,
    playerEdge: 31,
    safetyMargin: 10,
    nearMissRadius: 105,

    // Game steering model
    followRate: 12.5,

    // Cost model
    nearMissCost: 72,
    moveCost: 0.004,
    turnCost: 0.016,
    reverseCost: 0.12,
    centerCost: 0.0,
    hysteresisCost: 0.0014,

    // Power rewards
    chasePowers: true,
    abyRewardNoShield: 120,
    abyRewardWithShield: 3,
    shehabReward: 88,

    // Emergency
    emergencySamples: 181,

    // Keep horizon inside the time in which unseen newly-spawned hazards
    // cannot realistically reach the car.
    minHorizonSec: 1.05,
    maxHorizonSec: 2.15,
    unseenArrivalSafety: 0.82,

    // Debug/death snapshot
    historyFrames: 120
  };

  let enabled = true;
  let destroyed = false;

  // Exact object references observed from game Array.push/splice.
  const hazardRefs = new Set();
  const powerRefs = new Set();

  let player = null;
  let targetX = null;
  let previousChosenX = null;
  let previousDelta = 0;
  let plannerMode = 'INIT';
  let lastRisk = 0;
  let lastPlanAt = -Infinity;
  let lastScore = 0;
  let lastPlaying = false;
  let frameCounter = 0;
  const history = [];

  const original = {
    arrayPush: Array.prototype.push,
    arraySplice: Array.prototype.splice,
    stroke: ctx.stroke
  };

  const hud = document.createElement('div');
  Object.assign(hud.style, {
    position: 'fixed',
    zIndex: 2147483647,
    top: '12px',
    right: '12px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'rgba(0,0,0,.82)',
    color: '#fff',
    font: '700 12px/1.44 system-ui,sans-serif',
    pointerEvents: 'none',
    whiteSpace: 'pre',
    backdropFilter: 'blur(7px)'
  });
  document.body.appendChild(hud);

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function cssColor(v) {
    return String(v || '').toLowerCase().replace(/\s+/g, '');
  }

  function classify(obj) {
    if (!obj || typeof obj !== 'object') return null;

    // Hazard object:
    // {x,y,size,vy,vx,rot}
    if (
      Number.isFinite(obj.x) &&
      Number.isFinite(obj.y) &&
      Number.isFinite(obj.size) &&
      Number.isFinite(obj.vy) &&
      Number.isFinite(obj.vx) &&
      'rot' in obj &&
      !('w' in obj) &&
      !('r' in obj)
    ) {
      return 'hazard';
    }

    // Power object:
    // {kind:'shehab'|'aby',x,y,r,vy}
    if (
      (obj.kind === 'shehab' || obj.kind === 'aby') &&
      Number.isFinite(obj.x) &&
      Number.isFinite(obj.y) &&
      Number.isFinite(obj.r) &&
      Number.isFinite(obj.vy)
    ) {
      return 'power';
    }

    return null;
  }

  function observeAdded(item) {
    const type = classify(item);

    if (type === 'hazard') {
      hazardRefs.add(item);
    } else if (type === 'power') {
      powerRefs.add(item);
    }
  }

  function observeRemoved(item) {
    hazardRefs.delete(item);
    powerRefs.delete(item);
  }

  // ---------------------------------------------------------------------------
  // Passive exact-state hooks
  // ---------------------------------------------------------------------------

  Array.prototype.push = function(...items) {
    for (const item of items) {
      try { observeAdded(item); } catch (_) {}
    }

    return original.arrayPush.apply(this, items);
  };

  Array.prototype.splice = function(...args) {
    const removed = original.arraySplice.apply(this, args);

    for (const item of removed) {
      try { observeRemoved(item); } catch (_) {}
    }

    return removed;
  };

  function cssScaleX() {
    const r = cv.getBoundingClientRect();
    return cv.width / Math.max(1, r.width);
  }

  function cssScaleY() {
    const r = cv.getBoundingClientRect();
    return cv.height / Math.max(1, r.height);
  }

  function transformedOrigin() {
    const m = ctx.getTransform();

    return {
      x: m.e / Math.max(0.01, cssScaleX()),
      y: m.f / Math.max(0.01, cssScaleY())
    };
  }

  // Observe exact car center from the game's own final car-body stroke.
  ctx.stroke = function() {
    if (this === ctx) {
      const lw = Number(this.lineWidth);
      const style = cssColor(this.strokeStyle);

      if (
        Math.abs(lw - 2.4) < 0.16 &&
        (
          style === '#7adfff' ||
          style === 'rgb(122,223,255)' ||
          style === '#5af1aa' ||
          style === 'rgb(90,241,170)'
        )
      ) {
        const p = transformedOrigin();
        player = { x: p.x, y: p.y };

        onGameFrame();
      }
    }

    return original.stroke.apply(this, arguments);
  };

  // ---------------------------------------------------------------------------
  // Game state helpers
  // ---------------------------------------------------------------------------

  function currentScore() {
    const el = document.querySelector('#score');
    if (!el) return 0;

    const n =
      Number(
        String(el.textContent || '')
          .replace(/[^\d]/g, '')
      );

    return Number.isFinite(n) ? n : 0;
  }

  function isPlaying() {
    return document.body.classList.contains('gameLocked') ||
      document.querySelector('#mainCard')?.classList.contains('isPlaying');
  }

  function shieldActive() {
    return !!document.querySelector('#abyPower')?.classList.contains('on');
  }

  function hypeActive() {
    return !!document.querySelector('#shehabPower')?.classList.contains('on');
  }

  function cleanupRefs() {
    // Splice removes almost all live objects. These filters cover run resets
    // where arrays are replaced wholesale and old refs otherwise remain.
    for (const z of [...hazardRefs]) {
      if (
        !z ||
        !Number.isFinite(z.x) ||
        !Number.isFinite(z.y) ||
        z.y > (cv.getBoundingClientRect().height + 180)
      ) {
        hazardRefs.delete(z);
      }
    }

    for (const p of [...powerRefs]) {
      if (
        !p ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.y > (cv.getBoundingClientRect().height + 180)
      ) {
        powerRefs.delete(p);
      }
    }
  }

  function resetObservedRun() {
    hazardRefs.clear();
    powerRefs.clear();
    history.length = 0;
    targetX = null;
    previousChosenX = null;
    previousDelta = 0;
    plannerMode = 'RESET';
    lastRisk = 0;
  }

  // ---------------------------------------------------------------------------
  // Exact physics prediction
  // ---------------------------------------------------------------------------

  function alphaFor(dt) {
    return 1 - Math.exp(-cfg.followRate * dt);
  }

  function carNextX(x, pointerTarget, dt) {
    const a = alphaFor(dt);
    return (1 - a) * x + a * pointerTarget;
  }

  function predictHazardPath(z, steps, dt, width, hype) {
    let x = z.x;
    let y = z.y;
    let vx = z.vx;
    const vy = z.vy;
    const size = z.size;
    const arr = new Array(steps);

    for (let i = 0; i < steps; i++) {
      x += vx * dt;
      y += vy * dt * (hype ? 0.74 : 1);

      // Mirror the game's bounce condition.
      if (x < size || x > width - size) {
        vx *= -1;
      }

      arr[i] = {
        x,
        y,
        size
      };
    }

    return arr;
  }

  function predictPowerY(p, t) {
    return p.y + p.vy * t;
  }

  function collisionAt(px, py, z, margin) {
    const rr = z.size * 0.76 + margin;

    const cx =
      Math.max(
        px - cfg.playerHalfWidth,
        Math.min(z.x, px + cfg.playerHalfWidth)
      );

    const cy =
      Math.max(
        py - cfg.playerHalfHeight,
        Math.min(z.y, py + cfg.playerHalfHeight)
      );

    const dx = z.x - cx;
    const dy = z.y - cy;

    return dx * dx + dy * dy <= rr * rr;
  }

  function clearanceAt(px, py, z) {
    const rr = z.size * 0.76 + cfg.safetyMargin;

    const dx =
      Math.max(
        0,
        Math.abs(z.x - px) - cfg.playerHalfWidth
      );

    const dy =
      Math.max(
        0,
        Math.abs(z.y - py) - cfg.playerHalfHeight
      );

    return Math.sqrt(dx * dx + dy * dy) - rr;
  }

  function dynamicHorizon() {
    if (!player) return cfg.minHorizonSec;

    // Fastest desktop L5 hazard is ~595 px/s in the supplied game logic.
    // Use a slightly higher conservative bound.
    const fastestPossibleVy = 650;

    // New hazards spawn around y ~= -2*size. Use 50px conservative offset.
    const earliestUnseenArrival =
      (player.y + 50) / fastestPossibleVy;

    return clamp(
      earliestUnseenArrival * cfg.unseenArrivalSafety,
      cfg.minHorizonSec,
      cfg.maxHorizonSec
    );
  }

  function powerRewardAt(x, t) {
    if (!cfg.chasePowers || !player) return 0;

    let reward = 0;
    const shield = shieldActive();

    for (const p of powerRefs) {
      const py = predictPowerY(p, t);

      if (
        Math.abs(py - player.y) > 39 ||
        Math.abs(p.x - x) > 42
      ) {
        continue;
      }

      if (p.kind === 'aby') {
        reward +=
          shield
            ? cfg.abyRewardWithShield
            : cfg.abyRewardNoShield;
      } else if (p.kind === 'shehab') {
        reward += cfg.shehabReward;
      }
    }

    return reward;
  }

  // ---------------------------------------------------------------------------
  // Short-horizon exact-state beam MPC
  // ---------------------------------------------------------------------------

  function buildPlan() {
    if (!player) return null;

    const rect = cv.getBoundingClientRect();
    const width = rect.width;
    const py = player.y;
    const minX = cfg.playerEdge;
    const maxX = width - cfg.playerEdge;

    const horizon = dynamicHorizon();
    const dt = cfg.dt;
    const steps = Math.max(4, Math.ceil(horizon / dt));

    const hazards = [...hazardRefs];

    const paths = hazards.map(z =>
      predictHazardPath(
        z,
        steps,
        dt,
        width,
        hypeActive()
      )
    );

    const N = cfg.laneCount;
    const laneX = i =>
      minX + (maxX - minX) * i / (N - 1);

    const nearestLane = x =>
      clamp(
        Math.round(
          (x - minX) /
          Math.max(1, maxX - minX) *
          (N - 1)
        ),
        0,
        N - 1
      );

    let beam = [{
      x: player.x,
      cost: 0,
      firstTarget: null,
      firstActualX: null,
      delta: previousDelta
    }];

    const alpha = alphaFor(dt);

    for (let step = 0; step < steps; step++) {
      const t = (step + 1) * dt;
      const nextByLane = new Map();

      for (const st of beam) {
        const centerI = nearestLane(st.x);

        // Because pointer target can be anywhere, candidate targets span the
        // full width, but we sample more densely around the current corridor.
        const indexes = new Set([0, N - 1, centerI]);

        const fan =
          hazardRefs.size > 20 ? 26 :
          hazardRefs.size > 12 ? 22 :
          18;

        for (let k = -fan; k <= fan; k++) {
          indexes.add(clamp(centerI + k, 0, N - 1));
        }

        // Also inject coarse global targets so the bot can make a decisive
        // cross-road escape when a wall is forming.
        for (let i = 0; i < N; i += 10) {
          indexes.add(i);
        }

        for (const ti of indexes) {
          const pointerTarget = laneX(ti);
          const x1 =
            (1 - alpha) * st.x +
            alpha * pointerTarget;

          let blocked = false;
          let risk = 0;

          for (let h = 0; h < paths.length; h++) {
            const z = paths[h][step];

            if (
              z.y < py - 165 ||
              z.y > py + 100
            ) {
              continue;
            }

            if (
              collisionAt(
                x1,
                py,
                z,
                cfg.safetyMargin
              )
            ) {
              blocked = true;
              break;
            }

            const c = clearanceAt(x1, py, z);

            if (c < cfg.nearMissRadius) {
              risk +=
                cfg.nearMissCost *
                Math.exp(
                  -Math.max(0, c) / 24
                ) /
                Math.max(0.16, t);
            }
          }

          if (blocked) continue;

          // Mid-slice collision check to reduce tunneling between samples.
          if (step > 0) {
            const midX = (st.x + x1) * 0.5;
            const midStep = Math.max(0, step - 1);

            for (let h = 0; h < paths.length; h++) {
              const z0 = paths[h][midStep];
              const z1 = paths[h][step];

              const zm = {
                x: (z0.x + z1.x) * 0.5,
                y: (z0.y + z1.y) * 0.5,
                size: z1.size
              };

              if (
                zm.y < py - 165 ||
                zm.y > py + 100
              ) {
                continue;
              }

              if (
                collisionAt(
                  midX,
                  py,
                  zm,
                  cfg.safetyMargin
                )
              ) {
                blocked = true;
                break;
              }
            }

            if (blocked) continue;
          }

          const delta = x1 - st.x;
          const reversed =
            st.delta !== 0 &&
            delta !== 0 &&
            Math.sign(st.delta) !== Math.sign(delta);

          const edge =
            Math.min(x1, width - x1);

          let cost =
            st.cost +
            risk +
            Math.abs(delta) * cfg.moveCost +
            Math.abs(delta - st.delta) * cfg.turnCost +
            (reversed ? cfg.reverseCost : 0) +
            cfg.centerCost * Math.abs(x1 - width / 2) -
            powerRewardAt(x1, t);

          if (previousChosenX != null) {
            cost +=
              Math.abs(x1 - previousChosenX) *
              cfg.hysteresisCost;
          }

          const key = nearestLane(x1);

          const candidate = {
            x: x1,
            cost,
            firstTarget:
              st.firstTarget == null
                ? pointerTarget
                : st.firstTarget,
            firstActualX:
              st.firstActualX == null
                ? x1
                : st.firstActualX,
            delta
          };

          const old = nextByLane.get(key);

          if (!old || candidate.cost < old.cost) {
            nextByLane.set(key, candidate);
          }
        }
      }

      beam =
        [...nextByLane.values()]
          .sort((a, b) => a.cost - b.cost)
          .slice(0, cfg.beamWidth);

      if (!beam.length) {
        return emergencyPlan(width, paths, steps);
      }
    }

    const best = beam[0];

    return {
      emergency: false,
      target: best.firstTarget,
      firstActualX: best.firstActualX,
      risk: best.cost,
      horizon
    };
  }

  function emergencyPlan(width, paths, steps) {
    const minX = cfg.playerEdge;
    const maxX = width - cfg.playerEdge;
    const py = player.y;

    let bestX = player.x;
    let bestScore = -Infinity;

    for (let i = 0; i < cfg.emergencySamples; i++) {
      const x =
        minX +
        (maxX - minX) *
        i /
        (cfg.emergencySamples - 1);

      let minClearance = Infinity;

      for (let h = 0; h < paths.length; h++) {
        const path = paths[h];

        for (let s = 0; s < Math.min(steps, path.length); s++) {
          const z = path[s];

          if (
            z.y < py - 170 ||
            z.y > py + 105
          ) {
            continue;
          }

          minClearance =
            Math.min(
              minClearance,
              clearanceAt(x, py, z)
            );
        }
      }

      const score =
        minClearance -
        Math.abs(x - player.x) * 0.012;

      if (score > bestScore) {
        bestScore = score;
        bestX = x;
      }
    }

    return {
      emergency: true,
      target: bestX,
      firstActualX: bestX,
      risk: 99999,
      horizon: dynamicHorizon()
    };
  }

  // ---------------------------------------------------------------------------
  // Steering / diagnostics
  // ---------------------------------------------------------------------------

  function steerCurrentTarget() {
    if (!player || targetX == null) return;

    const rect = cv.getBoundingClientRect();

    cv.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerType: 'mouse',
        clientX:
          rect.left +
          clamp(
            targetX,
            cfg.playerEdge,
            rect.width - cfg.playerEdge
          ),
        clientY:
          rect.top +
          player.y
      })
    );
  }

  function planAndSteer() {
    const plan = buildPlan();

    if (!plan || !player) return;

    plannerMode =
      plan.emergency
        ? 'EMERGENCY'
        : 'EXACT-STATE MPC';

    lastRisk =
      Number.isFinite(plan.risk)
        ? plan.risk
        : 99999;

    const rect = cv.getBoundingClientRect();

    targetX =
      clamp(
        plan.target,
        cfg.playerEdge,
        rect.width - cfg.playerEdge
      );

    const chosen =
      plan.firstActualX ?? player.x;

    const oldChosen =
      previousChosenX ?? player.x;

    previousDelta =
      chosen - oldChosen;

    previousChosenX =
      chosen;

    steerCurrentTarget();

    history.push({
      t: performance.now(),
      score: currentScore(),
      carX: Math.round(player.x),
      targetX: Math.round(targetX),
      hazards: hazardRefs.size,
      powers: powerRefs.size,
      risk: Math.round(lastRisk),
      mode: plannerMode,
      shield: shieldActive(),
      hype: hypeActive()
    });

    while (history.length > cfg.historyFrames) {
      history.shift();
    }

    renderHud(plan.horizon);
  }

  function onGameFrame() {
    frameCounter++;

    const playing = isPlaying();
    const score = currentScore();

    // Detect a new run by score wrapping back near zero.
    if (
      playing &&
      (
        (!lastPlaying && score <= 5) ||
        (lastScore > 50 && score <= 5)
      )
    ) {
      resetObservedRun();
    }

    lastPlaying = playing;
    lastScore = score;

    cleanupRefs();

    if (!enabled || !playing) {
      renderHud(dynamicHorizon());
      return;
    }

    const now = performance.now();

    if (now - lastPlanAt >= cfg.replanEveryMs) {
      planAndSteer();
      lastPlanAt = now;
    } else {
      steerCurrentTarget();
    }
  }

  function renderHud(horizon = dynamicHorizon()) {
    if (!cfg.debug) return;

    hud.textContent =
      'ORBIT BOT V6: ' +
      (enabled ? 'ON' : 'OFF') + '\n' +
      'planner: ' + plannerMode + '\n' +
      'hazards exact: ' + hazardRefs.size + '\n' +
      'powers exact: ' + powerRefs.size + '\n' +
      'car: ' +
      (player ? Math.round(player.x) : '-') +
      ' → ' +
      (targetX == null ? '-' : Math.round(targetX)) + '\n' +
      'risk: ' + Math.round(lastRisk) + '\n' +
      'horizon: ' + Number(horizon || 0).toFixed(2) + 's\n' +
      'shield: ' + (shieldActive() ? 'YES' : 'NO') +
      ' · hype: ' + (hypeActive() ? 'YES' : 'NO') + '\n' +
      'F8 = toggle';
  }

  function toggle() {
    enabled = !enabled;
    renderHud();
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

    try {
      Array.prototype.push = original.arrayPush;
    } catch (_) {}

    try {
      Array.prototype.splice = original.arraySplice;
    } catch (_) {}

    try {
      ctx.stroke = original.stroke;
    } catch (_) {}

    window.removeEventListener('keydown', keyHandler, true);
    hud.remove();

    hazardRefs.clear();
    powerRefs.clear();

    if (window.orbitBot?.destroy === destroy) {
      delete window.orbitBot;
    }

    console.log('[OrbitBot V6] destroyed.');
  }

  window.addEventListener('keydown', keyHandler, true);

  window.orbitBot = {
    version: 6,

    start() {
      enabled = true;
      renderHud();
    },

    stop() {
      enabled = false;
      renderHud();
    },

    toggle,
    destroy,

    resetRefs() {
      resetObservedRun();
      renderHud();
    },

    status() {
      return {
        version: 6,
        enabled,
        host,
        plannerMode,
        score: currentScore(),
        risk: lastRisk,
        player,
        targetX,
        shield: shieldActive(),
        hype: hypeActive(),
        hazards: [...hazardRefs].map(z => ({
          x: Math.round(z.x),
          y: Math.round(z.y),
          vx: Math.round(z.vx),
          vy: Math.round(z.vy),
          size: Math.round(z.size)
        })),
        powers: [...powerRefs].map(p => ({
          kind: p.kind,
          x: Math.round(p.x),
          y: Math.round(p.y),
          vy: Math.round(p.vy)
        })),
        horizon: dynamicHorizon(),
        config: { ...cfg }
      };
    },

    lastFrames(n = 20) {
      return history.slice(-Math.max(1, n));
    },

    config: cfg
  };

  renderHud();

  console.log(
    '[OrbitBot V6] loaded.',
    '\nPURE AUTOPLAYER: game rules untouched.',
    '\nExact hazard/power object references enabled.',
    '\nHost:', host || '(file://)',
    '\nF8 toggles.'
  );
})();