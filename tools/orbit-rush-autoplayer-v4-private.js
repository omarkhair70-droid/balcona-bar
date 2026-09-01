(() => {
  'use strict';

  /*
    Orbit Rush Autoplayer V4 — PRIVATE / LOCAL COPY ONLY
    =====================================================
    Console script for your copied/private Orbit Rush build.

    HARD GUARD
    ----------
    This script refuses to run on 101-creations.com and subdomains.
    It runs on file://, localhost, 127.0.0.1, ::1, *.local,
    or an explicitly added private hostname in ALLOWED_HOSTS.

    V4 changes
    ----------
    1) Exact render capture for hazards, player and actual power type.
    2) Global hazard-track assignment instead of fragile nearest-per-item matching.
    3) Exact measured vx/vy with filtering and bounce prediction.
    4) Model-predictive control over ACTUAL reachable car positions.
    5) Two-layer planner that can intentionally spend ONE shield if necessary.
    6) Aby pickup can restore shield state inside the planner.
    7) Shehab/Aby are distinguished from their real drawImage source.
    8) Power rewards adapt to hazard density.
    9) Continuous collision/clearance scoring with emergency escape.
   10) Inverse steering solves the targetX needed to hit the next planned position.
   11) Dense REDLINE mode increases lanes/horizon automatically.
   12) Strong anti-zig-zag / hysteresis.

    The script does NOT call or modify:
    /start, /heartbeat, /finish, run_id, token, duration_ms, score, leaderboard.
  */

  // ---------------------------------------------------------------------------
  // Host guard
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
    console.error(
      '[OrbitBot V4] Refusing to run on public 101-creations.com.'
    );
    return;
  }

  if (!allowed) {
    console.error(
      '[OrbitBot V4] Host is not whitelisted:',
      host,
      '\nAdd your PRIVATE test host to ALLOWED_HOSTS.'
    );
    return;
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  const cv = document.querySelector('#canvas');

  if (!cv) {
    console.error('[OrbitBot V4] #canvas not found.');
    return;
  }

  if (window.orbitBot?.destroy) {
    try { window.orbitBot.destroy(); } catch (_) {}
  }

  const ctx = cv.getContext('2d');

  if (!ctx) {
    console.error('[OrbitBot V4] 2D context not found.');
    return;
  }

  const cfg = {
    debug: true,

    // Track estimation
    velocitySmoothing: 0.62,
    maxTrackDistance: 115,
    maxTrackAgeMs: 240,
    maxVx: 160,
    minVy: 35,
    maxVy: 760,

    // Power tracking
    powerTrackDistance: 90,
    defaultPowerVy: 152,

    // MPC
    normalLaneCount: 75,
    denseLaneCount: 101,
    normalHorizonSec: 2.9,
    denseHorizonSec: 4.0,
    dt: 0.060,
    replanEveryMs: 28,
    followRate: 12.5,

    // Collision model
    playerHalfWidth: 24,
    playerHalfHeight: 18,
    safetyMargin: 9,
    emergencyMargin: 17,

    // Cost model
    movementCost: 0.009,
    turnCost: 0.030,
    edgeCost: 0.10,
    nearMissCost: 38,
    shieldSpendCost: 135,
    targetHysteresis: 0.0018,

    // Power rewards
    chasePowers: true,
    abyReward: 62,
    shehabRewardBase: 34,
    shehabRewardDenseBonus: 55,

    // Density
    denseHazardCount: 17,
    extremeHazardCount: 28,

    // Steering
    maxTargetJumpPx: 280,

    // Debug
    showTrajectory: false
  };

  let enabled = true;
  let destroyed = false;

  let frameHazards = [];
  let framePowers = [];
  let hazardSizeScratch = null;

  let hazardTracks = [];
  let powerTracks = [];

  let nextHazardId = 1;
  let nextPowerId = 1;

  let player = null;
  let shieldVisual = false;

  let currentTargetX = null;
  let previousPlanX = null;
  let previousPlanDelta = 0;

  let lastRisk = 0;
  let lastPlanAt = -Infinity;
  let plannerMode = 'INIT';
  let currentPlanPreview = [];

  const original = {
    fillRect: ctx.fillRect,
    moveTo: ctx.moveTo,
    stroke: ctx.stroke,
    drawImage: ctx.drawImage
  };

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  const hud = document.createElement('div');

  Object.assign(hud.style, {
    position: 'fixed',
    zIndex: 2147483647,
    top: '12px',
    right: '12px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'rgba(0,0,0,.80)',
    color: '#fff',
    font: '700 12px/1.44 system-ui,sans-serif',
    pointerEvents: 'none',
    whiteSpace: 'pre',
    backdropFilter: 'blur(7px)'
  });

  document.body.appendChild(hud);

  function renderHud() {
    if (!cfg.debug) return;

    hud.textContent =
      'ORBIT BOT V4: ' + (enabled ? 'ON' : 'OFF') + '\n' +
      'planner: ' + plannerMode + '\n' +
      'hazards: ' + hazardTracks.length + '\n' +
      'powers: ' + powerTracks.length + '\n' +
      'car: ' +
      (player ? Math.round(player.x) : '-') +
      ' → ' +
      (currentTargetX == null ? '-' : Math.round(currentTargetX)) + '\n' +
      'risk: ' + Math.round(lastRisk) + '\n' +
      'shield: ' + (shieldVisual ? 'YES' : 'NO') + '\n' +
      'F8 = toggle';
  }

  // ---------------------------------------------------------------------------
  // Canvas capture helpers
  // ---------------------------------------------------------------------------

  function cssColor(v) {
    return String(v || '')
      .toLowerCase()
      .replace(/\s+/g, '');
  }

  function colorEq(v, hex, rgb) {
    const c = cssColor(v);
    return c === hex || c === rgb;
  }

  function canvasCssScaleX() {
    const r = cv.getBoundingClientRect();
    return cv.width / Math.max(1, r.width);
  }

  function canvasCssScaleY() {
    const r = cv.getBoundingClientRect();
    return cv.height / Math.max(1, r.height);
  }

  function transformedOrigin() {
    const m = ctx.getTransform();

    return {
      x: m.e / Math.max(0.01, canvasCssScaleX()),
      y: m.f / Math.max(0.01, canvasCssScaleY())
    };
  }

  function resetFrameCapture() {
    frameHazards = [];
    framePowers = [];
    hazardSizeScratch = null;
  }

  // ---------------------------------------------------------------------------
  // Canvas interception
  // ---------------------------------------------------------------------------

  ctx.fillRect = function(x, y, w, h) {
    if (
      this === ctx &&
      x === 0 &&
      y === 0 &&
      w > 200 &&
      h > 300 &&
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
      const s =
        Math.max(
          Math.abs(Number(x)),
          Math.abs(Number(y))
        ) / 0.58;

      if (Number.isFinite(s) && s > 10 && s < 95) {
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
      if (
        Math.abs(lw - 7) < 0.15 &&
        (
          style === '#ff476d' ||
          style === 'rgb(255,71,109)'
        )
      ) {
        const p = transformedOrigin();

        frameHazards.push({
          x: p.x,
          y: p.y,
          size: hazardSizeScratch || 34
        });

        hazardSizeScratch = null;
      }

      // Exact car render event. This occurs after hazards/powers are drawn.
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

        player = {
          x: p.x,
          y: p.y
        };

        shieldVisual =
          style === '#5af1aa' ||
          style === 'rgb(90,241,170)';

        if (enabled) {
          updateHazardTracks();
          updatePowerTracks();

          const now = performance.now();

          if (now - lastPlanAt >= cfg.replanEveryMs) {
            planAndSteer();
            lastPlanAt = now;
          } else {
            steerToCurrentTarget();
          }
        }
      }
    }

    return original.stroke.apply(this, arguments);
  };

  ctx.drawImage = function(img) {
    if (this === ctx && img) {
      const src = String(img.currentSrc || img.src || '').toLowerCase();

      let kind = null;

      if (src.includes('shehab-removebg')) {
        kind = 'shehab';
      } else if (
        src.includes('artworks-pzwr') ||
        src.includes('jkwdmqt500x500') ||
        src.includes('aby')
      ) {
        kind = 'aby';
      }

      if (kind) {
        const p = transformedOrigin();

        framePowers.push({
          x: p.x,
          y: p.y,
          kind
        });
      }
    }

    return original.drawImage.apply(this, arguments);
  };

  // ---------------------------------------------------------------------------
  // Generic global assignment
  // ---------------------------------------------------------------------------

  function assignGlobally(
    detections,
    tracks,
    predictFn,
    maxDistance,
    sameTypeFn = null
  ) {
    const now = performance.now();
    const pairs = [];

    for (let di = 0; di < detections.length; di++) {
      const d = detections[di];

      for (let ti = 0; ti < tracks.length; ti++) {
        const tr = tracks[ti];

        if (
          now - tr.t >
          cfg.maxTrackAgeMs
        ) {
          continue;
        }

        if (
          sameTypeFn &&
          !sameTypeFn(d, tr)
        ) {
          continue;
        }

        const p = predictFn(tr, now);

        const dx = d.x - p.x;
        const dy = d.y - p.y;

        // Y matters slightly more because falling motion is dominant.
        const cost =
          dx * dx +
          dy * dy * 1.18;

        const distance = Math.sqrt(cost);

        if (distance <= maxDistance) {
          pairs.push({
            di,
            ti,
            cost
          });
        }
      }
    }

    pairs.sort((a, b) => a.cost - b.cost);

    const usedD = new Set();
    const usedT = new Set();
    const matches = [];

    for (const p of pairs) {
      if (
        usedD.has(p.di) ||
        usedT.has(p.ti)
      ) {
        continue;
      }

      usedD.add(p.di);
      usedT.add(p.ti);

      matches.push(p);
    }

    return {
      now,
      matches,
      usedD,
      usedT
    };
  }

  // ---------------------------------------------------------------------------
  // Hazard tracking
  // ---------------------------------------------------------------------------

  function predictTrackLinear(tr, now) {
    const dt =
      Math.max(
        0,
        (now - tr.t) / 1000
      );

    return {
      x: tr.x + tr.vx * dt,
      y: tr.y + tr.vy * dt
    };
  }

  function updateHazardTracks() {
    const old = hazardTracks;

    const assignment =
      assignGlobally(
        frameHazards,
        old,
        predictTrackLinear,
        cfg.maxTrackDistance
      );

    const next = [];

    for (const m of assignment.matches) {
      const d = frameHazards[m.di];
      const tr = old[m.ti];

      const dt =
        Math.max(
          0.003,
          (assignment.now - tr.t) / 1000
        );

      const rawVx =
        (d.x - tr.x) / dt;

      const rawVy =
        (d.y - tr.y) / dt;

      const a = cfg.velocitySmoothing;

      const vx =
        clamp(
          tr.vx * (1 - a) +
          rawVx * a,
          -cfg.maxVx,
          cfg.maxVx
        );

      const vy =
        clamp(
          tr.vy * (1 - a) +
          rawVy * a,
          cfg.minVy,
          cfg.maxVy
        );

      next.push({
        id: tr.id,
        x: d.x,
        y: d.y,
        size: d.size,
        vx,
        vy,
        t: assignment.now,
        age: tr.age + 1
      });
    }

    for (let di = 0; di < frameHazards.length; di++) {
      if (assignment.usedD.has(di)) continue;

      const d = frameHazards[di];

      next.push({
        id: nextHazardId++,
        x: d.x,
        y: d.y,
        size: d.size,
        vx: 0,
        vy: 330,
        t: assignment.now,
        age: 1
      });
    }

    hazardTracks = next;
  }

  // ---------------------------------------------------------------------------
  // Power tracking
  // ---------------------------------------------------------------------------

  function updatePowerTracks() {
    const old = powerTracks;

    const assignment =
      assignGlobally(
        framePowers,
        old,
        predictTrackLinear,
        cfg.powerTrackDistance,
        (d, tr) => d.kind === tr.kind
      );

    const next = [];

    for (const m of assignment.matches) {
      const d = framePowers[m.di];
      const tr = old[m.ti];

      const dt =
        Math.max(
          0.003,
          (assignment.now - tr.t) / 1000
        );

      const rawVy =
        (d.y - tr.y) / dt;

      next.push({
        id: tr.id,
        kind: tr.kind,
        x: d.x,
        y: d.y,
        vx: 0,
        vy:
          tr.vy * 0.45 +
          clamp(rawVy, 90, 220) * 0.55,
        t: assignment.now,
        age: tr.age + 1
      });
    }

    for (let di = 0; di < framePowers.length; di++) {
      if (assignment.usedD.has(di)) continue;

      const d = framePowers[di];

      next.push({
        id: nextPowerId++,
        kind: d.kind,
        x: d.x,
        y: d.y,
        vx: 0,
        vy: cfg.defaultPowerVy,
        t: assignment.now,
        age: 1
      });
    }

    powerTracks = next;
  }

  // ---------------------------------------------------------------------------
  // Math helpers
  // ---------------------------------------------------------------------------

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function reflectPosition(
    x,
    vx,
    t,
    lo,
    hi
  ) {
    if (!(hi > lo)) return x;

    const span = hi - lo;
    const period = span * 2;

    let q =
      (x - lo + vx * t) %
      period;

    if (q < 0) q += period;
    if (q > span) q = period - q;

    return lo + q;
  }

  function predictHazard(
    z,
    t,
    width
  ) {
    const margin =
      Math.max(z.size, 18);

    const lo = margin;
    const hi =
      Math.max(lo + 1, width - margin);

    return {
      x: reflectPosition(
        z.x,
        z.vx || 0,
        t,
        lo,
        hi
      ),
      y:
        z.y +
        Math.max(cfg.minVy, z.vy || 330) *
        t,
      size: z.size
    };
  }

  function predictPower(p, t) {
    return {
      x: p.x,
      y:
        p.y +
        Math.max(90, p.vy || cfg.defaultPowerVy) *
        t,
      kind: p.kind
    };
  }

  function collisionAt(
    px,
    py,
    z,
    margin
  ) {
    const rr =
      z.size * 0.76 +
      margin;

    const cx =
      Math.max(
        px - cfg.playerHalfWidth,
        Math.min(
          z.x,
          px + cfg.playerHalfWidth
        )
      );

    const cy =
      Math.max(
        py - cfg.playerHalfHeight,
        Math.min(
          z.y,
          py + cfg.playerHalfHeight
        )
      );

    const dx = z.x - cx;
    const dy = z.y - cy;

    return (
      dx * dx +
      dy * dy <=
      rr * rr
    );
  }

  function clearanceAt(px, py, z) {
    const rr =
      z.size * 0.76 +
      cfg.safetyMargin;

    const dx =
      Math.max(
        0,
        Math.abs(z.x - px) -
        cfg.playerHalfWidth
      );

    const dy =
      Math.max(
        0,
        Math.abs(z.y - py) -
        cfg.playerHalfHeight
      );

    return (
      Math.sqrt(dx * dx + dy * dy) -
      rr
    );
  }

  // ---------------------------------------------------------------------------
  // Planner helpers
  // ---------------------------------------------------------------------------

  function plannerSettings() {
    const count = hazardTracks.length;

    const dense =
      count >= cfg.denseHazardCount;

    const extreme =
      count >= cfg.extremeHazardCount;

    return {
      dense,
      extreme,
      laneCount:
        dense
          ? cfg.denseLaneCount
          : cfg.normalLaneCount,
      horizon:
        extreme
          ? cfg.denseHorizonSec + 0.55
          : dense
            ? cfg.denseHorizonSec
            : cfg.normalHorizonSec
    };
  }

  function alphaFor(dt) {
    return (
      1 -
      Math.exp(-cfg.followRate * dt)
    );
  }

  function reachableTargetForTransition(
    currentX,
    nextActualX,
    dt,
    minX,
    maxX
  ) {
    const a = alphaFor(dt);

    if (a <= 1e-6) return null;

    const target =
      (
        nextActualX -
        (1 - a) * currentX
      ) / a;

    if (
      target < minX - 0.01 ||
      target > maxX + 0.01
    ) {
      return null;
    }

    return target;
  }

  function nearPowerAt(
    x,
    py,
    t
  ) {
    let aby = false;
    let shehab = false;

    for (const p of powerTracks) {
      const q = predictPower(p, t);

      if (
        Math.abs(q.y - py) <= 37 &&
        Math.abs(q.x - x) <= 40
      ) {
        if (p.kind === 'aby') {
          aby = true;
        } else if (p.kind === 'shehab') {
          shehab = true;
        }
      }
    }

    return {
      aby,
      shehab
    };
  }

  function powerRewardFor(
    x,
    py,
    t,
    shieldState,
    settings
  ) {
    if (!cfg.chasePowers) {
      return {
        reward: 0,
        restoreShield: false
      };
    }

    const hit =
      nearPowerAt(
        x,
        py,
        t
      );

    let reward = 0;
    let restoreShield = false;

    if (hit.aby) {
      if (!shieldState) {
        reward += cfg.abyReward;
        restoreShield = true;
      } else {
        reward += 4;
      }
    }

    if (hit.shehab) {
      reward +=
        cfg.shehabRewardBase +
        (
          settings.dense
            ? cfg.shehabRewardDenseBonus
            : 0
        );
    }

    return {
      reward,
      restoreShield
    };
  }

  // ---------------------------------------------------------------------------
  // V4 MPC: state = lane + shield availability
  // ---------------------------------------------------------------------------

  function buildPlan() {
    if (!player) {
      return null;
    }

    const rect =
      cv.getBoundingClientRect();

    const width = rect.width;
    const py = player.y;

    const settings =
      plannerSettings();

    const N =
      settings.laneCount;

    const dt =
      cfg.dt;

    const steps =
      Math.ceil(
        settings.horizon / dt
      );

    const minX = 31;
    const maxX = width - 31;

    const lanes =
      Array.from(
        { length: N },
        (_, i) =>
          minX +
          (maxX - minX) *
          i /
          (N - 1)
      );

    // State index:
    // shield=0 => 0..N-1
    // shield=1 => N..2N-1
    const S = N * 2;

    let prev =
      new Float64Array(S);

    let next =
      new Float64Array(S);

    prev.fill(Infinity);

    const parents =
      Array.from(
        { length: steps },
        () =>
          new Int32Array(S).fill(-1)
      );

    const controlTargets =
      Array.from(
        { length: steps },
        () =>
          new Float32Array(S)
      );

    let startLane = 0;
    let bestStartDist = Infinity;

    for (let i = 0; i < N; i++) {
      const d =
        Math.abs(
          lanes[i] - player.x
        );

      if (d < bestStartDist) {
        bestStartDist = d;
        startLane = i;
      }
    }

    const startShield =
      shieldVisual ? 1 : 0;

    prev[
      startLane +
      startShield * N
    ] = 0;

    const alpha =
      alphaFor(dt);

    // Because next actual x = (1-a)*x + a*target,
    // derive a lane-index reach radius from the extreme targets.
    function reachableLaneRange(x) {
      const minReach =
        (1 - alpha) * x +
        alpha * minX;

      const maxReach =
        (1 - alpha) * x +
        alpha * maxX;

      let lo = 0;
      let hi = N - 1;

      while (
        lo < N &&
        lanes[lo] <
        minReach - 0.001
      ) {
        lo++;
      }

      while (
        hi >= 0 &&
        lanes[hi] >
        maxReach + 0.001
      ) {
        hi--;
      }

      return {
        lo: clamp(lo, 0, N - 1),
        hi: clamp(hi, 0, N - 1)
      };
    }

    const reachableRanges =
      lanes.map(reachableLaneRange);

    for (let step = 0; step < steps; step++) {
      const t =
        (step + 1) * dt;

      next.fill(Infinity);

      const hazards =
        hazardTracks.map(
          z =>
            predictHazard(
              z,
              t,
              width
            )
        );

      for (let shield = 0; shield <= 1; shield++) {
        const offset = shield * N;

        for (let i = 0; i < N; i++) {
          const prevState =
            offset + i;

          const baseCost =
            prev[prevState];

          if (!Number.isFinite(baseCost)) {
            continue;
          }

          const x0 = lanes[i];
          const range =
            reachableRanges[i];

          for (
            let j = range.lo;
            j <= range.hi;
            j++
          ) {
            const x1 = lanes[j];

            const target =
              reachableTargetForTransition(
                x0,
                x1,
                dt,
                minX,
                maxX
              );

            if (target == null) {
              continue;
            }

            let collision = false;
            let localRisk = 0;

            // We score both the end point and the midpoint
            // to reduce tunneling between time slices.
            const midT =
              t - dt * 0.5;

            const midActualX =
              (
                x0 + x1
              ) * 0.5;

            for (let h = 0; h < hazards.length; h++) {
              const z1 = hazards[h];

              if (
                z1.y < py - 150 ||
                z1.y > py + 90
              ) {
                continue;
              }

              if (
                collisionAt(
                  x1,
                  py,
                  z1,
                  cfg.safetyMargin
                )
              ) {
                collision = true;
                break;
              }

              const c1 =
                clearanceAt(
                  x1,
                  py,
                  z1
                );

              if (c1 < 100) {
                localRisk +=
                  cfg.nearMissCost *
                  Math.exp(
                    -Math.max(0, c1) / 25
                  ) /
                  Math.max(0.18, t);
              }

              const source =
                hazardTracks[h];

              const zm =
                predictHazard(
                  source,
                  Math.max(0, midT),
                  width
                );

              if (
                zm.y >= py - 150 &&
                zm.y <= py + 90
              ) {
                if (
                  collisionAt(
                    midActualX,
                    py,
                    zm,
                    cfg.safetyMargin
                  )
                ) {
                  collision = true;
                  break;
                }

                const cm =
                  clearanceAt(
                    midActualX,
                    py,
                    zm
                  );

                if (cm < 85) {
                  localRisk +=
                    cfg.nearMissCost *
                    0.55 *
                    Math.exp(
                      -Math.max(0, cm) / 22
                    ) /
                    Math.max(0.18, midT);
                }
              }
            }

            let nextShield =
              shield;

            let shieldCost = 0;

            if (collision) {
              if (shield) {
                // Spend the shield intentionally if this route is
                // otherwise the best way through a closed wall.
                nextShield = 0;
                shieldCost =
                  cfg.shieldSpendCost;
              } else {
                continue;
              }
            }

            const power =
              powerRewardFor(
                x1,
                py,
                t,
                nextShield,
                settings
              );

            if (power.restoreShield) {
              nextShield = 1;
            }

            const nextState =
              nextShield * N + j;

            const dx =
              x1 - x0;

            const prevDelta =
              step === 0
                ? previousPlanDelta
                : 0;

            const turn =
              Math.abs(
                dx - prevDelta
              );

            const edge =
              Math.min(
                x1,
                width - x1
              );

            let cost =
              baseCost +
              Math.abs(dx) *
              cfg.movementCost +
              turn *
              cfg.turnCost +
              cfg.edgeCost /
              Math.max(10, edge) +
              localRisk +
              shieldCost -
              power.reward;

            if (previousPlanX != null) {
              cost +=
                Math.abs(
                  x1 - previousPlanX
                ) *
                cfg.targetHysteresis;
            }

            if (cost < next[nextState]) {
              next[nextState] = cost;

              parents[step][nextState] =
                prevState;

              controlTargets[step][nextState] =
                target;
            }
          }
        }
      }

      const tmp = prev;
      prev = next;
      next = tmp;
    }

    let endState = -1;
    let bestCost = Infinity;

    for (let s = 0; s < S; s++) {
      if (prev[s] < bestCost) {
        bestCost = prev[s];
        endState = s;
      }
    }

    if (endState < 0) {
      return emergencyPlan(
        lanes,
        width
      );
    }

    const states =
      new Int32Array(steps);

    const controls =
      new Float32Array(steps);

    let cur = endState;

    for (
      let step = steps - 1;
      step >= 0;
      step--
    ) {
      states[step] = cur;
      controls[step] =
        controlTargets[step][cur];

      cur =
        parents[step][cur];

      if (cur < 0) {
        cur =
          startLane +
          startShield * N;
      }
    }

    const xs =
      Array.from(
        states,
        s => lanes[s % N]
      );

    return {
      xs,
      controls:
        Array.from(controls),
      risk: bestCost,
      emergency: false,
      dense: settings.dense,
      extreme: settings.extreme
    };
  }

  // ---------------------------------------------------------------------------
  // Emergency corridor solver
  // ---------------------------------------------------------------------------

  function emergencyPlan(
    lanes,
    width
  ) {
    let bestX = player.x;
    let bestClearance = -Infinity;

    for (const x of lanes) {
      let minClearance = Infinity;

      for (const z of hazardTracks) {
        const vy =
          Math.max(
            cfg.minVy,
            z.vy || 330
          );

        const arrival =
          clamp(
            (
              player.y - z.y
            ) / vy,
            0,
            0.80
          );

        for (const t of [
          Math.max(0, arrival - 0.10),
          arrival,
          Math.min(0.80, arrival + 0.10)
        ]) {
          const q =
            predictHazard(
              z,
              t,
              width
            );

          const c =
            clearanceAt(
              x,
              player.y,
              q
            );

          minClearance =
            Math.min(
              minClearance,
              c
            );
        }
      }

      // Distance penalty keeps the escape realistic.
      const score =
        minClearance -
        Math.abs(
          x - player.x
        ) * 0.028;

      if (score > bestClearance) {
        bestClearance = score;
        bestX = x;
      }
    }

    const target =
      clamp(
        bestX,
        31,
        width - 31
      );

    return {
      xs: [bestX],
      controls: [target],
      risk: 9999,
      emergency: true,
      dense: true,
      extreme: true
    };
  }

  // ---------------------------------------------------------------------------
  // Steering
  // ---------------------------------------------------------------------------

  function planAndSteer() {
    const plan =
      buildPlan();

    if (!plan || !player) {
      return;
    }

    currentPlanPreview =
      plan.xs.slice(0, 18);

    plannerMode =
      plan.emergency
        ? 'EMERGENCY'
        : plan.extreme
          ? 'EXTREME MPC'
          : plan.dense
            ? 'DENSE MPC'
            : 'MPC';

    lastRisk =
      Number.isFinite(plan.risk)
        ? plan.risk
        : 99999;

    // The first MPC control is the exact mouse target that
    // should produce the first planned actual position.
    let desiredTarget =
      plan.controls[0];

    if (!Number.isFinite(desiredTarget)) {
      desiredTarget =
        plan.xs[0];
    }

    if (!Number.isFinite(desiredTarget)) {
      desiredTarget =
        player.x;
    }

    const rect =
      cv.getBoundingClientRect();

    desiredTarget =
      clamp(
        desiredTarget,
        31,
        rect.width - 31
      );

    if (currentTargetX == null) {
      currentTargetX =
        desiredTarget;
    }

    // In emergency we do not smooth.
    if (plan.emergency) {
      currentTargetX =
        desiredTarget;
    } else {
      const delta =
        clamp(
          desiredTarget -
          currentTargetX,
          -cfg.maxTargetJumpPx,
          cfg.maxTargetJumpPx
        );

      currentTargetX += delta;
    }

    const oldPlanX =
      previousPlanX ??
      player.x;

    previousPlanX =
      plan.xs[0] ??
      player.x;

    previousPlanDelta =
      previousPlanX -
      oldPlanX;

    steerToCurrentTarget();
    renderHud();
  }

  function steerToCurrentTarget() {
    if (
      !player ||
      currentTargetX == null
    ) {
      return;
    }

    const rect =
      cv.getBoundingClientRect();

    const x =
      rect.left +
      clamp(
        currentTargetX,
        31,
        rect.width - 31
      );

    const y =
      rect.top +
      player.y;

    cv.dispatchEvent(
      new PointerEvent(
        'pointermove',
        {
          bubbles: true,
          cancelable: true,
          pointerType: 'mouse',
          clientX: x,
          clientY: y
        }
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  function toggle() {
    enabled = !enabled;
    renderHud();

    console.log(
      '[OrbitBot V4]',
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

    try {
      ctx.fillRect =
        original.fillRect;
    } catch (_) {}

    try {
      ctx.moveTo =
        original.moveTo;
    } catch (_) {}

    try {
      ctx.stroke =
        original.stroke;
    } catch (_) {}

    try {
      ctx.drawImage =
        original.drawImage;
    } catch (_) {}

    window.removeEventListener(
      'keydown',
      keyHandler,
      true
    );

    hud.remove();

    if (
      window.orbitBot?.destroy ===
      destroy
    ) {
      delete window.orbitBot;
    }

    console.log(
      '[OrbitBot V4] destroyed'
    );
  }

  window.addEventListener(
    'keydown',
    keyHandler,
    true
  );

  window.orbitBot = {
    version: 4,

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
        version: 4,
        enabled,
        host,
        plannerMode,
        risk: lastRisk,
        player,
        targetX: currentTargetX,
        shieldVisual,

        hazards:
          hazardTracks.map(
            z => ({
              id: z.id,
              x: Math.round(z.x),
              y: Math.round(z.y),
              vx: Math.round(z.vx),
              vy: Math.round(z.vy),
              size: Math.round(z.size),
              age: z.age
            })
          ),

        powers:
          powerTracks.map(
            p => ({
              id: p.id,
              kind: p.kind,
              x: Math.round(p.x),
              y: Math.round(p.y),
              vy: Math.round(p.vy),
              age: p.age
            })
          ),

        config: {
          ...cfg
        }
      };
    },

    config: cfg
  };

  renderHud();

  console.log(
    '[OrbitBot V4] loaded on private/local host:',
    host || '(file://)',
    '\nV4 exact tracking + shield-aware MPC active. F8 toggles.'
  );
})();