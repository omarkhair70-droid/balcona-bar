(() => {
  'use strict';

  /*
    Orbit Rush Autoplayer V5 — PRIVATE / LOCAL COPY ONLY
    ====================================================
    Pure bot. The game itself is NOT modified.

    The script only:
    - observes what the existing canvas renderer draws;
    - estimates hazard/power positions and velocities;
    - predicts future collisions;
    - dispatches normal pointermove events to steer the car.

    It does NOT modify:
    - score / verifiedScore
    - hazard collision logic
    - spawn rates / speeds
    - shield / HYPE behavior
    - start / heartbeat / finish
    - duration_ms / run_id / token / leaderboard

    Host guard:
    - blocked on 101-creations.com and subdomains;
    - allowed on file://, localhost, 127.0.0.1, ::1, *.local,
      or a hostname explicitly added to ALLOWED_HOSTS.
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
    console.error('[OrbitBot V5] Refusing to run on public 101-creations.com.');
    return;
  }

  if (!allowed) {
    console.error(
      '[OrbitBot V5] Host is not whitelisted:',
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
    console.error('[OrbitBot V5] #canvas not found.');
    return;
  }

  if (window.orbitBot?.destroy) {
    try { window.orbitBot.destroy(); } catch (_) {}
  }

  const ctx = cv.getContext('2d');

  if (!ctx) {
    console.error('[OrbitBot V5] 2D context not found.');
    return;
  }

  const cfg = {
    debug: true,

    // Tracking
    velocitySmoothing: 0.65,
    maxTrackDistance: 125,
    maxTrackAgeMs: 260,
    defaultHazardVy: 340,
    defaultPowerVy: 155,

    // Planner
    normalLaneCount: 91,
    denseLaneCount: 121,
    beamWidth: 180,
    normalHorizonSec: 3.2,
    denseHorizonSec: 4.4,
    extremeHorizonSec: 5.0,
    dt: 0.060,
    replanEveryMs: 24,

    // Game steering model
    followRate: 12.5,
    playerHalfWidth: 24,
    playerHalfHeight: 18,
    playerEdge: 31,

    // Safety
    safetyMargin: 11,
    emergencyMargin: 20,
    nearMissRadius: 105,

    // Objective
    moveCost: 0.006,
    turnCost: 0.020,
    reverseDirectionCost: 0.18,
    edgeCost: 0.09,
    nearMissCost: 52,
    hysteresisCost: 0.0024,

    // Powers
    chasePowers: true,
    abyRewardWithoutShield: 86,
    abyRewardWithShield: 4,
    shehabReward: 60,

    // Density modes
    denseHazardCount: 16,
    extremeHazardCount: 27
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

  let targetX = null;
  let priorChosenX = null;
  let priorDelta = 0;

  let plannerMode = 'INIT';
  let lastRisk = 0;
  let lastPlanAt = -Infinity;

  const original = {
    fillRect: ctx.fillRect,
    moveTo: ctx.moveTo,
    stroke: ctx.stroke,
    drawImage: ctx.drawImage
  };

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
    font: '700 12px/1.42 system-ui,sans-serif',
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

  // ---------------------------------------------------------------------------
  // Passive renderer observation
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
        Math.max(Math.abs(Number(x)), Math.abs(Number(y))) / 0.58;

      if (Number.isFinite(s) && s > 10 && s < 95) {
        hazardSizeScratch = s;
      }
    }

    return original.moveTo.apply(this, arguments);
  };

  ctx.drawImage = function(img) {
    if (this === ctx && img) {
      const src =
        String(img.currentSrc || img.src || '').toLowerCase();

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

  ctx.stroke = function() {
    if (this === ctx) {
      const lw = Number(this.lineWidth);
      const style = cssColor(this.strokeStyle);

      // Hazard draw
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

      // Car body draw = reliable end-of-frame hook
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
            steerCurrentTarget();
          }
        }
      }
    }

    return original.stroke.apply(this, arguments);
  };

  // ---------------------------------------------------------------------------
  // Track assignment
  // ---------------------------------------------------------------------------

  function predictLinear(tr, now) {
    const dt = Math.max(0, (now - tr.t) / 1000);

    return {
      x: tr.x + tr.vx * dt,
      y: tr.y + tr.vy * dt
    };
  }

  function globalAssign(
    detections,
    tracks,
    maxDistance,
    typeAware
  ) {
    const now = performance.now();
    const pairs = [];

    for (let di = 0; di < detections.length; di++) {
      const d = detections[di];

      for (let ti = 0; ti < tracks.length; ti++) {
        const tr = tracks[ti];

        if (now - tr.t > cfg.maxTrackAgeMs) continue;

        if (
          typeAware &&
          d.kind !== tr.kind
        ) {
          continue;
        }

        const p = predictLinear(tr, now);

        const dx = d.x - p.x;
        const dy = d.y - p.y;

        const cost =
          dx * dx +
          1.22 * dy * dy;

        if (Math.sqrt(cost) <= maxDistance) {
          pairs.push({ di, ti, cost });
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

  function updateHazardTracks() {
    const assignment =
      globalAssign(
        frameHazards,
        hazardTracks,
        cfg.maxTrackDistance,
        false
      );

    const next = [];

    for (const m of assignment.matches) {
      const d = frameHazards[m.di];
      const tr = hazardTracks[m.ti];

      const dt =
        Math.max(
          0.003,
          (assignment.now - tr.t) / 1000
        );

      const rawVx =
        (d.x - tr.x) / dt;

      const rawVy =
        (d.y - tr.y) / dt;

      const a =
        cfg.velocitySmoothing;

      next.push({
        id: tr.id,
        x: d.x,
        y: d.y,
        size: d.size,
        vx: clamp(
          tr.vx * (1 - a) + rawVx * a,
          -180,
          180
        ),
        vy: clamp(
          tr.vy * (1 - a) + rawVy * a,
          25,
          780
        ),
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
        vy: cfg.defaultHazardVy,
        t: assignment.now,
        age: 1
      });
    }

    hazardTracks = next;
  }

  function updatePowerTracks() {
    const assignment =
      globalAssign(
        framePowers,
        powerTracks,
        95,
        true
      );

    const next = [];

    for (const m of assignment.matches) {
      const d = framePowers[m.di];
      const tr = powerTracks[m.ti];

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
          clamp(rawVy, 90, 240) * 0.55,
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
  // Physics prediction
  // ---------------------------------------------------------------------------

  function reflectPosition(x, vx, t, lo, hi) {
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

  function predictHazard(z, t, width) {
    const margin =
      Math.max(z.size, 18);

    const lo = margin;
    const hi =
      Math.max(
        lo + 1,
        width - margin
      );

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
        Math.max(25, z.vy || cfg.defaultHazardVy) *
        t,
      size: z.size
    };
  }

  function collisionAt(px, py, z, margin) {
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

  function alphaFor(dt) {
    return 1 - Math.exp(-cfg.followRate * dt);
  }

  function actualNextX(
    currentX,
    mouseTargetX,
    dt
  ) {
    const a = alphaFor(dt);

    return (
      (1 - a) * currentX +
      a * mouseTargetX
    );
  }

  // ---------------------------------------------------------------------------
  // Beam-search MPC
  // ---------------------------------------------------------------------------

  function plannerSettings() {
    const count =
      hazardTracks.length;

    const extreme =
      count >= cfg.extremeHazardCount;

    const dense =
      count >= cfg.denseHazardCount;

    return {
      dense,
      extreme,
      laneCount:
        dense
          ? cfg.denseLaneCount
          : cfg.normalLaneCount,
      horizon:
        extreme
          ? cfg.extremeHorizonSec
          : dense
            ? cfg.denseHorizonSec
            : cfg.normalHorizonSec
    };
  }

  function powerRewardAt(x, py, t) {
    if (!cfg.chasePowers) return 0;

    let reward = 0;

    for (const p of powerTracks) {
      const y =
        p.y +
        Math.max(
          90,
          p.vy || cfg.defaultPowerVy
        ) *
        t;

      if (
        Math.abs(y - py) > 38 ||
        Math.abs(p.x - x) > 42
      ) {
        continue;
      }

      if (p.kind === 'aby') {
        reward +=
          shieldVisual
            ? cfg.abyRewardWithShield
            : cfg.abyRewardWithoutShield;
      } else if (p.kind === 'shehab') {
        reward += cfg.shehabReward;
      }
    }

    return reward;
  }

  function stateRisk(
    x,
    py,
    t,
    width
  ) {
    let risk = 0;

    for (const tr of hazardTracks) {
      const z =
        predictHazard(
          tr,
          t,
          width
        );

      if (
        z.y < py - 160 ||
        z.y > py + 95
      ) {
        continue;
      }

      if (
        collisionAt(
          x,
          py,
          z,
          cfg.safetyMargin
        )
      ) {
        return Infinity;
      }

      const c =
        clearanceAt(
          x,
          py,
          z
        );

      if (c < cfg.nearMissRadius) {
        risk +=
          cfg.nearMissCost *
          Math.exp(
            -Math.max(0, c) / 25
          ) /
          Math.max(0.18, t);
      }
    }

    return risk;
  }

  function buildPlan() {
    if (!player) return null;

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

    const minX =
      cfg.playerEdge;

    const maxX =
      width - cfg.playerEdge;

    const lanes =
      Array.from(
        { length: N },
        (_, i) =>
          minX +
          (maxX - minX) *
          i /
          (N - 1)
      );

    const alpha =
      alphaFor(dt);

    function nearestLane(x) {
      const q =
        (x - minX) /
        Math.max(1, maxX - minX);

      return clamp(
        Math.round(
          q * (N - 1)
        ),
        0,
        N - 1
      );
    }

    let beam = [{
      x: player.x,
      lane: nearestLane(player.x),
      cost: 0,
      firstTarget: null,
      firstActualX: null,
      delta: priorDelta,
      path0: null
    }];

    for (let step = 0; step < steps; step++) {
      const t =
        (step + 1) * dt;

      const nextMap =
        new Map();

      for (const st of beam) {
        // Candidate mouse targets: not just adjacent lanes.
        // Choose a useful local fan around current position.
        const center =
          nearestLane(st.x);

        const fan =
          settings.extreme
            ? 18
            : settings.dense
              ? 15
              : 12;

        const candidateIndexes = new Set([
          0,
          N - 1,
          center
        ]);

        for (
          let k = -fan;
          k <= fan;
          k++
        ) {
          candidateIndexes.add(
            clamp(
              center + k,
              0,
              N - 1
            )
          );
        }

        for (const ti of candidateIndexes) {
          const mouseTarget =
            lanes[ti];

          const x1 =
            actualNextX(
              st.x,
              mouseTarget,
              dt
            );

          const risk =
            stateRisk(
              x1,
              py,
              t,
              width
            );

          if (!Number.isFinite(risk)) {
            continue;
          }

          // Midpoint collision check reduces tunneling.
          const midT =
            Math.max(
              0,
              t - dt * 0.5
            );

          const midX =
            (st.x + x1) * 0.5;

          const midRisk =
            stateRisk(
              midX,
              py,
              midT,
              width
            );

          if (!Number.isFinite(midRisk)) {
            continue;
          }

          const delta =
            x1 - st.x;

          const reversed =
            st.delta !== 0 &&
            delta !== 0 &&
            Math.sign(st.delta) !==
            Math.sign(delta);

          const edge =
            Math.min(
              x1,
              width - x1
            );

          const powerReward =
            powerRewardAt(
              x1,
              py,
              t
            );

          let cost =
            st.cost +
            risk +
            midRisk * 0.45 +
            Math.abs(delta) *
            cfg.moveCost +
            Math.abs(
              delta - st.delta
            ) *
            cfg.turnCost +
            (
              reversed
                ? cfg.reverseDirectionCost
                : 0
            ) +
            cfg.edgeCost /
            Math.max(10, edge) -
            powerReward;

          if (priorChosenX != null) {
            cost +=
              Math.abs(
                x1 - priorChosenX
              ) *
              cfg.hysteresisCost;
          }

          const key =
            nearestLane(x1);

          const firstTarget =
            st.firstTarget == null
              ? mouseTarget
              : st.firstTarget;

          const firstActualX =
            st.firstActualX == null
              ? x1
              : st.firstActualX;

          const candidate = {
            x: x1,
            lane: key,
            cost,
            firstTarget,
            firstActualX,
            delta,
            path0:
              st.path0 == null
                ? x1
                : st.path0
          };

          const old =
            nextMap.get(key);

          if (
            !old ||
            candidate.cost < old.cost
          ) {
            nextMap.set(
              key,
              candidate
            );
          }
        }
      }

      beam =
        [...nextMap.values()]
          .sort(
            (a, b) =>
              a.cost - b.cost
          )
          .slice(
            0,
            cfg.beamWidth
          );

      if (!beam.length) {
        return emergencyPlan(width);
      }
    }

    const best =
      beam[0];

    return {
      emergency: false,
      dense: settings.dense,
      extreme: settings.extreme,
      target:
        best.firstTarget,
      firstActualX:
        best.firstActualX,
      risk:
        best.cost
    };
  }

  function emergencyPlan(width) {
    const py = player.y;
    const minX = cfg.playerEdge;
    const maxX = width - cfg.playerEdge;

    const N = 141;

    let bestX = player.x;
    let bestScore = -Infinity;

    for (let i = 0; i < N; i++) {
      const x =
        minX +
        (maxX - minX) *
        i /
        (N - 1);

      let minimum =
        Infinity;

      for (const tr of hazardTracks) {
        const vy =
          Math.max(
            60,
            tr.vy || cfg.defaultHazardVy
          );

        const arrival =
          clamp(
            (py - tr.y) / vy,
            0,
            0.95
          );

        for (const t of [
          Math.max(0, arrival - 0.14),
          arrival,
          Math.min(0.95, arrival + 0.14)
        ]) {
          const z =
            predictHazard(
              tr,
              t,
              width
            );

          const c =
            clearanceAt(
              x,
              py,
              z
            );

          minimum =
            Math.min(
              minimum,
              c
            );
        }
      }

      const score =
        minimum -
        Math.abs(
          x - player.x
        ) * 0.018;

      if (score > bestScore) {
        bestScore = score;
        bestX = x;
      }
    }

    return {
      emergency: true,
      dense: true,
      extreme: true,
      target: bestX,
      firstActualX: bestX,
      risk: 99999
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

    plannerMode =
      plan.emergency
        ? 'EMERGENCY'
        : plan.extreme
          ? 'EXTREME BEAM'
          : plan.dense
            ? 'DENSE BEAM'
            : 'BEAM MPC';

    lastRisk =
      Number.isFinite(plan.risk)
        ? plan.risk
        : 99999;

    const rect =
      cv.getBoundingClientRect();

    targetX =
      clamp(
        plan.target,
        cfg.playerEdge,
        rect.width -
        cfg.playerEdge
      );

    const newChosen =
      plan.firstActualX ??
      player.x;

    const oldChosen =
      priorChosenX ??
      player.x;

    priorDelta =
      newChosen -
      oldChosen;

    priorChosenX =
      newChosen;

    steerCurrentTarget();
    renderHud();
  }

  function steerCurrentTarget() {
    if (
      !player ||
      targetX == null
    ) {
      return;
    }

    const rect =
      cv.getBoundingClientRect();

    cv.dispatchEvent(
      new PointerEvent(
        'pointermove',
        {
          bubbles: true,
          cancelable: true,
          pointerType: 'mouse',
          clientX:
            rect.left +
            clamp(
              targetX,
              cfg.playerEdge,
              rect.width -
              cfg.playerEdge
            ),
          clientY:
            rect.top +
            player.y
        }
      )
    );
  }

  function renderHud() {
    if (!cfg.debug) return;

    hud.textContent =
      'ORBIT BOT V5: ' +
      (enabled ? 'ON' : 'OFF') + '\n' +
      'planner: ' +
      plannerMode + '\n' +
      'hazards: ' +
      hazardTracks.length + '\n' +
      'powers: ' +
      powerTracks.length + '\n' +
      'car: ' +
      (
        player
          ? Math.round(player.x)
          : '-'
      ) +
      ' → ' +
      (
        targetX == null
          ? '-'
          : Math.round(targetX)
      ) + '\n' +
      'risk: ' +
      Math.round(lastRisk) + '\n' +
      'shield: ' +
      (shieldVisual ? 'YES' : 'NO') + '\n' +
      'F8 = toggle';
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

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

    try { ctx.fillRect = original.fillRect; } catch (_) {}
    try { ctx.moveTo = original.moveTo; } catch (_) {}
    try { ctx.stroke = original.stroke; } catch (_) {}
    try { ctx.drawImage = original.drawImage; } catch (_) {}

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

    console.log('[OrbitBot V5] destroyed.');
  }

  window.addEventListener(
    'keydown',
    keyHandler,
    true
  );

  window.orbitBot = {
    version: 5,

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
        version: 5,
        enabled,
        host,
        plannerMode,
        risk: lastRisk,
        player,
        targetX,
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
    '[OrbitBot V5] loaded.',
    '\nPURE AUTOPLAYER: game logic untouched.',
    '\nHost:', host || '(file://)',
    '\nF8 toggles.'
  );
})();