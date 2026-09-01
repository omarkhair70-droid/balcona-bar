(() => {
  'use strict';

  /*
    Orbit Rush Autoplayer V3 — PRIVATE COPY / LOCAL TESTING ONLY
    ------------------------------------------------------------
    Console script for a copied/private Orbit Rush build.

    Safety guard:
    - Hard-blocks 101-creations.com and subdomains.
    - Runs on file://, localhost, 127.0.0.1, ::1, and *.local by default.
    - For your own private test host, add it to ALLOWED_HOSTS below.

    V3 upgrades over V2:
    - Exact canvas render interception (player / hazards / powers).
    - Persistent hazard tracking with vx/vy estimation.
    - Model-predictive trajectory planning over future time slices.
    - Reachability-aware lane changes instead of one static target.
    - Emergency corridor escape for imminent collisions.
    - Optional power-up interception only when the route is already safe.
    - Shield-aware risk scoring.
    - Adaptive planning horizon and lane count under REDLINE density.
    - Anti-oscillation / hysteresis to avoid zig-zagging into hazards.
    - Debug HUD with hazard count, risk, target and planner mode.

    Does NOT:
    - call /start, /heartbeat or /finish
    - modify score, duration, run_id, token or leaderboard state
  */

  const BLOCKED_HOST_RE = /(^|\.)101-creations\.com$/i;
  const ALLOWED_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '::1'
    // Add your own private test hostname here, e.g.
    // 'orbit-test.example.com'
  ]);

  const host = location.hostname || '';
  const isFile = location.protocol === 'file:';
  const isLocal =
    isFile ||
    ALLOWED_HOSTS.has(host) ||
    host.endsWith('.local');

  if (BLOCKED_HOST_RE.test(host)) {
    console.error('[OrbitBot V3] Refusing to run on the public 101-creations.com site.');
    return;
  }

  if (!isLocal) {
    console.error(
      '[OrbitBot V3] Host is not whitelisted:', host,
      '\nAdd your private test hostname to ALLOWED_HOSTS in the script.'
    );
    return;
  }

  const cv = document.querySelector('#canvas');
  if (!cv) {
    console.error('[OrbitBot V3] #canvas not found.');
    return;
  }

  if (window.orbitBot?.destroy) {
    try { window.orbitBot.destroy(); } catch (_) {}
  }

  const ctx = cv.getContext('2d');
  if (!ctx) {
    console.error('[OrbitBot V3] 2D context not found.');
    return;
  }

  const cfg = {
    debug: true,

    // Tracking
    velocitySmoothing: 0.56,
    maxTrackDistance: 105,
    staleTrackMs: 220,

    // Planning
    baseLaneCount: 73,
    denseLaneCount: 91,
    planDt: 0.070,
    baseHorizonSec: 2.60,
    denseHorizonSec: 3.25,
    replanEveryMs: 34,
    followRate: 12.5,

    // Collision envelope
    playerHalfWidth: 24,
    playerHalfHeight: 18,
    safetyMargin: 8,
    emergencyMargin: 15,

    // Objective
    movementCost: 0.010,
    turnCost: 0.040,
    edgeCost: 0.16,
    targetHysteresis: 0.35,

    // Powers
    chasePowers: true,
    abyReward: 34,
    shehabReward: 22,
    unsafePowerPenalty: 400,

    // Planner thresholds
    emergencyRisk: 1100,
    denseHazardCount: 18,

    // Steering
    targetSmoothing: 0.90
  };

  let enabled = true;
  let destroyed = false;

  let frameHazards = [];
  let framePowers = [];
  let hazardSizeScratch = null;

  let tracks = [];
  let nextTrackId = 1;
  let player = null;
  let shieldVisual = false;

  let targetX = null;
  let lastTargetX = null;
  let lastTargetDelta = 0;
  let lastRisk = 0;
  let plannerMode = 'INIT';
  let lastPlanAt = -Infinity;

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
    padding: '9px 12px',
    borderRadius: '10px',
    background: 'rgba(0,0,0,.78)',
    color: '#fff',
    font: '700 12px/1.42 system-ui,sans-serif',
    pointerEvents: 'none',
    whiteSpace: 'pre',
    backdropFilter: 'blur(7px)'
  });
  document.body.appendChild(hud);

  function cssColor(v) {
    return String(v || '').toLowerCase().replace(/\s+/g, '');
  }

  function colorEq(v, hex, rgb) {
    const c = cssColor(v);
    return c === hex || c === rgb;
  }

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

  function resetFrameCapture() {
    frameHazards = [];
    framePowers = [];
    hazardSizeScratch = null;
  }

  ctx.fillRect = function(x, y, w, h) {
    if (
      this === ctx &&
      x === 0 && y === 0 &&
      w > 200 && h > 300 &&
      colorEq(this.fillStyle, '#020811', 'rgb(2,8,17)')
    ) {
      resetFrameCapture();
    }
    return original.fillRect.apply(this, arguments);
  };

  ctx.moveTo = function(x, y) {
    if (
      this === ctx &&
      Math.abs(Number(this.lineWidth) - 7) < 0.15 &&
      colorEq(this.strokeStyle, '#ff476d', 'rgb(255,71,109)')
    ) {
      const s = Math.max(Math.abs(Number(x)), Math.abs(Number(y))) / 0.58;
      if (Number.isFinite(s) && s > 10 && s < 90) {
        hazardSizeScratch = s;
      }
    }

    return original.moveTo.apply(this, arguments);
  };

  ctx.stroke = function() {
    if (this === ctx) {
      const lw = Number(this.lineWidth);
      const style = cssColor(this.strokeStyle);

      // Hazard
      if (
        Math.abs(lw - 7) < 0.15 &&
        (style === '#ff476d' || style === 'rgb(255,71,109)')
      ) {
        const p = transformedOrigin();
        frameHazards.push({
          x: p.x,
          y: p.y,
          size: hazardSizeScratch || 34
        });
        hazardSizeScratch = null;
      }

      // Green power ring / shield ring
      if (
        Math.abs(lw - 3) < 0.15 &&
        (style === '#5af1aa' || style === 'rgb(90,241,170)')
      ) {
        const p = transformedOrigin();
        framePowers.push({
          x: p.x,
          y: p.y,
          kind: 'unknown'
        });
      }

      // Car body stroke => end-of-frame capture point.
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
        shieldVisual =
          style === '#5af1aa' ||
          style === 'rgb(90,241,170)';

        if (enabled) {
          updateTracks();
          if (performance.now() - lastPlanAt >= cfg.replanEveryMs) {
            planAndSteer();
            lastPlanAt = performance.now();
          } else {
            steerCurrentTarget();
          }
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

    for (const d of frameHazards) {
      let best = null;
      let bestCost = Infinity;

      for (const tr of old) {
        if (used.has(tr.id)) continue;
        if (now - tr.t > cfg.staleTrackMs) continue;

        const dt = Math.max(0.001, (now - tr.t) / 1000);
        const px = tr.x + tr.vx * dt;
        const py = tr.y + tr.vy * dt;
        const dx = d.x - px;
        const dy = d.y - py;
        const dist2 = dx * dx + dy * dy;

        if (
          dist2 < bestCost &&
          Math.sqrt(dist2) <= cfg.maxTrackDistance
        ) {
          bestCost = dist2;
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
        vy: Math.max(
          30,
          best.vy * (1 - a) + rawVy * a
        ),
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

  function predictHazard(z, t, w) {
    const size = z.size;
    const lo = Math.max(size, 18);
    const hi = Math.max(lo + 1, w - Math.max(size, 18));

    return {
      x: reflectPosition(z.x, z.vx || 0, t, lo, hi),
      y: z.y + Math.max(40, z.vy || 330) * t,
      size
    };
  }

  function collisionAt(px, py, z, margin) {
    const rr = z.size * 0.76 + margin;

    const cx = Math.max(
      px - cfg.playerHalfWidth,
      Math.min(z.x, px + cfg.playerHalfWidth)
    );

    const cy = Math.max(
      py - cfg.playerHalfHeight,
      Math.min(z.y, py + cfg.playerHalfHeight)
    );

    const dx = z.x - cx;
    const dy = z.y - cy;

    return dx * dx + dy * dy <= rr * rr;
  }

  function clearanceAt(px, py, z) {
    const rr = z.size * 0.76 + cfg.safetyMargin;

    const dx = Math.max(
      0,
      Math.abs(z.x - px) - cfg.playerHalfWidth
    );

    const dy = Math.max(
      0,
      Math.abs(z.y - py) - cfg.playerHalfHeight
    );

    return Math.sqrt(dx * dx + dy * dy) - rr;
  }

  function filteredPowers() {
    if (!player) return [];

    // framePowers includes the player's shield ring when shield is active.
    return framePowers.filter(p => {
      const dx = p.x - player.x;
      const dy = p.y - player.y;

      return Math.sqrt(dx * dx + dy * dy) > 55;
    });
  }

  function plannerSettings() {
    const dense = tracks.length >= cfg.denseHazardCount;

    return {
      laneCount: dense ? cfg.denseLaneCount : cfg.baseLaneCount,
      horizon: dense ? cfg.denseHorizonSec : cfg.baseHorizonSec,
      dense
    };
  }

  function estimatePowerReward(x, t, powers, unsafe) {
    if (!cfg.chasePowers || unsafe) return 0;

    let reward = 0;

    for (const p of powers) {
      // We cannot infer shehab vs aby from the ring alone,
      // so use a blended expected value.
      const predictedY = p.y + 150 * t;

      if (Math.abs(predictedY - player.y) > 40) continue;

      const dx = Math.abs(p.x - x);
      if (dx > 44) continue;

      const expected =
        shieldVisual
          ? cfg.shehabReward
          : (cfg.abyReward + cfg.shehabReward) / 2;

      reward += expected * (1 - dx / 44);
    }

    return reward;
  }

  function buildTrajectory() {
    if (!player) {
      return {
        xs: [],
        risk: Infinity,
        emergency: true
      };
    }

    const rect = cv.getBoundingClientRect();
    const w = rect.width;
    const py = player.y;

    const settings = plannerSettings();
    const N = settings.laneCount;
    const dt = cfg.planDt;
    const steps = Math.ceil(settings.horizon / dt);

    const minX = 31;
    const maxX = w - 31;

    const lanes = Array.from(
      { length: N },
      (_, i) => minX + (maxX - minX) * i / (N - 1)
    );

    const parents = Array.from(
      { length: steps },
      () => new Int16Array(N).fill(-1)
    );

    let prev = new Float64Array(N);
    let next = new Float64Array(N);
    prev.fill(Infinity);

    let startI = 0;
    let startDist = Infinity;

    for (let i = 0; i < N; i++) {
      const d = Math.abs(lanes[i] - player.x);
      if (d < startDist) {
        startDist = d;
        startI = i;
      }
    }

    prev[startI] = 0;

    const powers = filteredPowers();

    // realistic lateral reach per time slice
    const laneSpacing = (maxX - minX) / (N - 1);
    const pxPerSlice = 295 * dt * 1.45;
    const maxJump = Math.max(
      2,
      Math.ceil(pxPerSlice / laneSpacing)
    );

    let terminalRisk = Infinity;

    for (let s = 0; s < steps; s++) {
      const t = (s + 1) * dt;
      next.fill(Infinity);

      const hz = tracks.map(z => predictHazard(z, t, w));

      for (let j = 0; j < N; j++) {
        const x = lanes[j];

        let blocked = false;
        let localRisk = 0;

        for (const z of hz) {
          if (z.y < py - 125 || z.y > py + 80) continue;

          if (collisionAt(x, py, z, cfg.safetyMargin)) {
            blocked = true;
            break;
          }

          const clearance = clearanceAt(x, py, z);

          if (clearance < 80) {
            localRisk +=
              28 *
              Math.exp(-Math.max(0, clearance) / 23) /
              Math.max(0.18, t);
          }
        }

        if (blocked) continue;

        const unsafeForPower = localRisk > 18;
        const powerReward = estimatePowerReward(
          x,
          t,
          powers,
          unsafeForPower
        );

        const edge = Math.min(x, w - x);

        const lo = Math.max(0, j - maxJump);
        const hi = Math.min(N - 1, j + maxJump);

        for (let i = lo; i <= hi; i++) {
          if (!Number.isFinite(prev[i])) continue;

          const dx = lanes[j] - lanes[i];
          const turn =
            s === 0
              ? dx
              : dx - lastTargetDelta;

          let cost =
            prev[i] +
            Math.abs(dx) * cfg.movementCost +
            Math.abs(turn) * cfg.turnCost +
            cfg.edgeCost / Math.max(10, edge) +
            localRisk -
            powerReward;

          // Hysteresis: slightly favor the previous chosen target
          // to reduce unnecessary lane swapping.
          if (lastTargetX != null) {
            cost +=
              Math.abs(x - lastTargetX) *
              cfg.targetHysteresis *
              0.004;
          }

          if (cost < next[j]) {
            next[j] = cost;
            parents[s][j] = i;
          }
        }
      }

      const tmp = prev;
      prev = next;
      next = tmp;
    }

    let endI = -1;
    let best = Infinity;

    for (let i = 0; i < N; i++) {
      if (prev[i] < best) {
        best = prev[i];
        endI = i;
      }
    }

    terminalRisk = best;

    if (endI < 0) {
      return emergencyTrajectory(lanes, w);
    }

    const idx = new Int16Array(steps);
    let cur = endI;

    for (let s = steps - 1; s >= 0; s--) {
      idx[s] = cur;

      cur = parents[s][cur];
      if (cur < 0) cur = startI;
    }

    return {
      xs: Array.from(idx, i => lanes[i]),
      risk: terminalRisk,
      emergency: false,
      dense: settings.dense
    };
  }

  function emergencyTrajectory(lanes, w) {
    let bestX = player.x;
    let bestScore = -Infinity;

    for (const x of lanes) {
      let minClearance = Infinity;

      for (const z of tracks) {
        const vy = Math.max(80, z.vy || 330);
        const t = Math.max(
          0,
          Math.min(
            0.65,
            (player.y - z.y) / vy
          )
        );

        const hz = predictHazard(z, t, w);
        const c = clearanceAt(x, player.y, hz);

        minClearance = Math.min(minClearance, c);
      }

      // Prefer wider escape corridor; small distance penalty
      // prevents senseless full-width jumps.
      const score =
        minClearance -
        Math.abs(x - player.x) * 0.035;

      if (score > bestScore) {
        bestScore = score;
        bestX = x;
      }
    }

    return {
      xs: [bestX],
      risk: cfg.emergencyRisk + 1,
      emergency: true,
      dense: true
    };
  }

  function planAndSteer() {
    const plan = buildTrajectory();

    plannerMode =
      plan.emergency
        ? 'EMERGENCY'
        : plan.dense
          ? 'DENSE MPC'
          : 'MPC';

    lastRisk = Number.isFinite(plan.risk)
      ? plan.risk
      : 99999;

    let chosen =
      plan.xs.length > 2
        ? plan.xs[2]
        : plan.xs[0];

    if (!Number.isFinite(chosen)) {
      chosen = player.x;
    }

    const prevTarget = targetX ?? player.x;

    if (lastRisk >= cfg.emergencyRisk || plan.emergency) {
      targetX = chosen;
    } else {
      if (targetX == null) targetX = chosen;

      targetX +=
        (chosen - targetX) *
        cfg.targetSmoothing;
    }

    const rect = cv.getBoundingClientRect();
    targetX = Math.max(
      31,
      Math.min(rect.width - 31, targetX)
    );

    lastTargetDelta = targetX - prevTarget;
    lastTargetX = targetX;

    steerCurrentTarget();
    renderHud();
  }

  function steerCurrentTarget() {
    if (!player || targetX == null) return;

    const rect = cv.getBoundingClientRect();

    const clientX = rect.left + targetX;
    const clientY = rect.top + player.y;

    cv.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerType: 'mouse',
        clientX,
        clientY
      })
    );
  }

  function renderHud() {
    if (!cfg.debug) return;

    const powerCount = filteredPowers().length;

    hud.textContent =
      'ORBIT BOT V3: ' +
      (enabled ? 'ON' : 'OFF') + '\n' +
      'planner: ' + plannerMode + '\n' +
      'hazards: ' + tracks.length + '\n' +
      'powers: ' + powerCount + '\n' +
      'car: ' +
      (player ? Math.round(player.x) : '-') +
      ' → ' +
      (targetX == null ? '-' : Math.round(targetX)) + '\n' +
      'risk: ' + Math.round(lastRisk) + '\n' +
      'shield: ' + (shieldVisual ? 'YES' : 'NO') + '\n' +
      'F8 = toggle';
  }

  function toggle() {
    enabled = !enabled;
    renderHud();

    console.log(
      '[OrbitBot V3]',
      enabled ? 'ON' : 'OFF'
    );
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

    console.log('[OrbitBot V3] destroyed');
  }

  window.addEventListener('keydown', keyHandler, true);

  window.orbitBot = {
    version: 3,
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
    status() {
      return {
        version: 3,
        enabled,
        host,
        plannerMode,
        hazards: tracks.map(z => ({
          id: z.id,
          x: Math.round(z.x),
          y: Math.round(z.y),
          vx: Math.round(z.vx),
          vy: Math.round(z.vy),
          size: Math.round(z.size),
          age: z.age
        })),
        player,
        targetX,
        risk: lastRisk,
        shieldVisual,
        powers: filteredPowers(),
        config: { ...cfg }
      };
    },
    config: cfg
  };

  renderHud();

  console.log(
    '[OrbitBot V3] loaded on private/local host:',
    host || '(file://)',
    '\nPredictive MPC steering active. F8 toggles.'
  );
})();