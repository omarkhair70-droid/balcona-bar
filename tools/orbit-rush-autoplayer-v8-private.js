(() => {
  'use strict';

  /*
    Orbit Rush Autoplayer V8 — PRIVATE / LOCAL COPY ONLY
    ====================================================
    Pure autoplayer. The game itself is not modified.

    V8 deliberately returns to the V6 exact-state beam MPC that produced the
    strongest run, then fixes only failure modes proven by V6/V7 logs:

    - exact hazard/power object references;
    - correct run reset when the game replaces hazards=[] / powers=[];
    - forecast of HYPE expiry inside the horizon;
    - legal one-hit shield rescue, including removal of the consumed hazard;
    - 4 sub-frame collision samples to prevent tunnelling;
    - relevant-hazard pruning to keep V6-style beam search responsive;
    - planner execution-time + HYPE countdown diagnostics.

    It only observes state and sends normal pointermove steering.
    It does NOT change score, verifiedScore, collision rules, spawn rules,
    hazard speed, shield/HYPE behavior, API calls, duration_ms, run_id, token,
    leaderboard, or any game-owned object.
  */

  // ---------------------------------------------------------------------------
  // Host guard ONLY
  // ---------------------------------------------------------------------------

  const BLOCKED_HOST_RE = /(^|\.)101-creations\.com$/i;

  const ALLOWED_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    '::1'
    // Add your PRIVATE test hostname here if needed:
    // 'orbit-private.example.com'
  ]);

  const host = location.hostname || '';
  const allowed =
    location.protocol === 'file:' ||
    ALLOWED_HOSTS.has(host) ||
    host.endsWith('.local');

  if (BLOCKED_HOST_RE.test(host)) {
    console.error('[OrbitBot V8] Refusing to run on public 101-creations.com.');
    return;
  }

  if (!allowed) {
    console.error(
      '[OrbitBot V8] Host is not whitelisted:',
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
    console.error('[OrbitBot V8] #canvas not found.');
    return;
  }

  if (window.orbitBot?.destroy) {
    try { window.orbitBot.destroy(); } catch (_) {}
  }

  const ctx = cv.getContext('2d');

  if (!ctx) {
    console.error('[OrbitBot V8] 2D context not found.');
    return;
  }

  const cfg = {
    debug: true,

    // Keep V6's proven search geometry.
    dt: 0.045,
    replanEveryMs: 16,
    laneCount: 151,
    beamWidth: 260,

    // Exact collision model.
    playerHalfWidth: 24,
    playerHalfHeight: 18,
    playerEdge: 31,
    safetyMargin: 10,
    nearMissRadius: 110,
    collisionSubsamples: 4,

    // Actual desktop pointer-follow coefficient from the game.
    followRate: 12.5,

    // V6-style path cost.
    nearMissCost: 76,
    moveCost: 0.004,
    turnCost: 0.016,
    reverseCost: 0.12,
    hysteresisCost: 0.0014,

    // Power preference; rules are unchanged.
    chasePowers: true,
    abyRewardNoShield: 150,
    abyRewardWithShield: 3,
    shehabReward: 110,

    // Shield is used only in the second-pass rescue planner.
    shieldSpendCost: 220,

    // Candidate fan.
    fanSparse: 18,
    fanDense: 22,
    fanExtreme: 26,
    denseHazards: 12,
    extremeHazards: 20,

    // Horizon stays below plausible arrival of an unseen new hazard.
    minHorizonSec: 1.05,
    maxHorizonSec: 2.15,
    unseenArrivalSafety: 0.82,

    emergencySamples: 181,
    historyFrames: 180
  };

  let enabled = true;
  let destroyed = false;

  const hazardRefs = new Set();
  const powerRefs = new Set();

  let player = null;
  let targetX = null;
  let previousChosenX = null;
  let previousDelta = 0;

  let plannerMode = 'INIT';
  let lastRisk = 0;
  let lastPlanAt = -Infinity;
  let lastPlannerMs = 0;
  let lastScore = 0;

  // Exact-enough wall-clock expiry learned from the DOM transition in the
  // same rendered frame in which applyPower() activates Shehab.
  let hypeEndAt = 0;
  let lastDomHype = null;

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
    background: 'rgba(0,0,0,.83)',
    color: '#fff',
    font: '700 12px/1.45 system-ui,sans-serif',
    pointerEvents: 'none',
    whiteSpace: 'pre',
    backdropFilter: 'blur(7px)'
  });

  document.body.appendChild(hud);

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function cssColor(v) {
    return String(v || '')
      .toLowerCase()
      .replace(/\s+/g, '');
  }

  function currentScore() {
    const el = document.querySelector('#score');

    if (!el) return 0;

    const n = Number(
      String(el.textContent || '')
        .replace(/[^\d]/g, '')
    );

    return Number.isFinite(n) ? n : 0;
  }

  function shieldActive() {
    return !!document
      .querySelector('#abyPower')
      ?.classList.contains('on');
  }

  function domHypeActive() {
    return !!document
      .querySelector('#shehabPower')
      ?.classList.contains('on');
  }

  function hypeRemainingMs(now = performance.now()) {
    return Math.max(0, hypeEndAt - now);
  }

  function classify(obj) {
    if (!obj || typeof obj !== 'object') return null;

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

  function resetObservedRun() {
    hazardRefs.clear();
    powerRefs.clear();

    history.length = 0;

    targetX = null;
    previousChosenX = null;
    previousDelta = 0;

    plannerMode = 'RESET';
    lastRisk = 0;
    lastPlannerMs = 0;
    lastPlanAt = -Infinity;

    hypeEndAt = 0;
    lastDomHype = null;
  }

  function observeAdded(item) {
    const type = classify(item);

    if (!type) return;

    // Critical V7/V6 replay fix:
    // reset() replaces hazards/powers with brand-new arrays. The first hazard
    // of a new run is pushed before drawCar. Clear stale previous-run refs
    // BEFORE adding that first fresh object, not afterwards.
    const score = currentScore();

    if (lastScore > 50 && score <= 5) {
      resetObservedRun();
      lastScore = score;
    }

    if (type === 'hazard') {
      hazardRefs.add(item);
    } else {
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
        player = transformedOrigin();
        onGameFrame();
      }
    }

    return original.stroke.apply(this, arguments);
  };

  // ---------------------------------------------------------------------------
  // State synchronization
  // ---------------------------------------------------------------------------

  function syncHypeClock() {
    const now = performance.now();
    const dom = domHypeActive();

    if (
      lastDomHype === false &&
      dom === true
    ) {
      // applyPower() sets hypeUntil to +6000ms in this same game frame.
      hypeEndAt = now + 6000;
    }

    if (
      lastDomHype === true &&
      dom === false
    ) {
      hypeEndAt = 0;
    }

    // If the bot was pasted while HYPE was already active, its remaining
    // duration is unknown. Predict conservatively: no future HYPE benefit.
    if (
      lastDomHype === null &&
      dom === true &&
      hypeEndAt <= now
    ) {
      hypeEndAt = now;
    }

    lastDomHype = dom;
  }

  function cleanupRefs() {
    const h = cv.getBoundingClientRect().height;

    for (const z of [...hazardRefs]) {
      if (
        !z ||
        !Number.isFinite(z.x) ||
        !Number.isFinite(z.y) ||
        z.y > h + 180
      ) {
        hazardRefs.delete(z);
      }
    }

    for (const p of [...powerRefs]) {
      if (
        !p ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.y > h + 180
      ) {
        powerRefs.delete(p);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Physics
  // ---------------------------------------------------------------------------

  function alphaFor(dt) {
    return 1 - Math.exp(-cfg.followRate * dt);
  }

  function carAtFraction(startX, pointerTarget, dt, q) {
    const a = alphaFor(dt * q);

    return (
      (1 - a) * startX +
      a * pointerTarget
    );
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

  function dynamicHorizon() {
    if (!player) return cfg.minHorizonSec;

    // Source desktop REDLINE maximum is ~595px/s.
    // 650 leaves safety for unseen next spawns.
    const fastestPossibleVy = 650;

    const earliestUnseenArrival =
      (player.y + 50) / fastestPossibleVy;

    return clamp(
      earliestUnseenArrival * cfg.unseenArrivalSafety,
      cfg.minHorizonSec,
      cfg.maxHorizonSec
    );
  }

  function buildHazardPath(z, steps, dt, width, wallNow) {
    let x = z.x;
    let y = z.y;
    let vx = z.vx;

    const arr = new Array(steps);

    for (let i = 0; i < steps; i++) {
      const futureWall =
        wallNow + (i + 1) * dt * 1000;

      // HYPE ends inside a forecast instead of being frozen for the horizon.
      const speedMult =
        futureWall < hypeEndAt
          ? 0.74
          : 1;

      x += vx * dt;
      y += z.vy * dt * speedMult;

      if (x < z.size || x > width - z.size) {
        vx *= -1;
      }

      arr[i] = {
        x,
        y,
        size: z.size
      };
    }

    return arr;
  }

  function powerRewardAt(x, t, dt) {
    if (!cfg.chasePowers || !player) return 0;

    let reward = 0;
    const shield = shieldActive();

    for (const p of powerRefs) {
      const py = p.y + p.vy * t;

      // Reward mainly at the crossing slice rather than every future slice.
      const crossingBand = Math.max(24, p.vy * dt * 0.85);

      if (
        Math.abs(py - player.y) > crossingBand ||
        Math.abs(p.x - x) > 42
      ) {
        continue;
      }

      if (p.kind === 'aby') {
        reward += shield
          ? cfg.abyRewardWithShield
          : cfg.abyRewardNoShield;
      } else if (p.kind === 'shehab') {
        reward += cfg.shehabReward;
      }
    }

    return reward;
  }

  // ---------------------------------------------------------------------------
  // V6 beam MPC + precise sub-frame collision checks
  // ---------------------------------------------------------------------------

  function transitionEvaluation(
    st,
    pointerTarget,
    step,
    paths,
    hazards,
    py,
    dt,
    spentHazard,
    allowShield
  ) {
    const uniqueHits = new Set();
    let risk = 0;

    const qCount = cfg.collisionSubsamples;

    for (let qIndex = 1; qIndex <= qCount; qIndex++) {
      const q = qIndex / qCount;

      const carX = carAtFraction(
        st.x,
        pointerTarget,
        dt,
        q
      );

      for (let h = 0; h < paths.length; h++) {
        if (h === spentHazard) continue;

        const end = paths[h][step];

        const start =
          step === 0
            ? hazards[h]
            : paths[h][step - 1];

        const z = {
          x: start.x + (end.x - start.x) * q,
          y: start.y + (end.y - start.y) * q,
          size: end.size
        };

        if (
          z.y < py - 175 ||
          z.y > py + 110
        ) {
          continue;
        }

        if (
          collisionAt(
            carX,
            py,
            z,
            cfg.safetyMargin
          )
        ) {
          uniqueHits.add(h);
          continue;
        }

        const c = clearanceAt(carX, py, z);

        if (c < cfg.nearMissRadius) {
          // Divide by samples so denser temporal sampling does not inflate
          // the total risk merely because we sampled more often.
          risk += (
            cfg.nearMissCost *
            Math.exp(-Math.max(0, c) / 24) /
            Math.max(0.16, (step + q) * dt)
          ) / qCount;
        }
      }
    }

    let nextSpentHazard = spentHazard;
    let shieldCost = 0;

    if (uniqueHits.size) {
      // A previously consumed shield hazard is already ignored above.
      // Therefore any new collision here requires the still-unused shield.
      if (
        allowShield &&
        spentHazard < 0 &&
        uniqueHits.size === 1
      ) {
        nextSpentHazard = [...uniqueHits][0];
        shieldCost = cfg.shieldSpendCost;
      } else {
        return {
          blocked: true
        };
      }
    }

    return {
      blocked: false,
      risk,
      nextSpentHazard,
      shieldCost
    };
  }

  function runBeam({
    paths,
    hazards,
    width,
    py,
    minX,
    maxX,
    horizon,
    dt,
    steps,
    allowShield
  }) {
    const N = cfg.laneCount;

    const laneX = i =>
      minX +
      (maxX - minX) *
      i /
      (N - 1);

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
      delta: previousDelta,
      spentHazard: -1
    }];

    const alpha = alphaFor(dt);

    for (let step = 0; step < steps; step++) {
      const t = (step + 1) * dt;
      const nextByState = new Map();

      for (const st of beam) {
        const centerI = nearestLane(st.x);

        const fan =
          hazards.length >= cfg.extremeHazards
            ? cfg.fanExtreme
            : hazards.length >= cfg.denseHazards
              ? cfg.fanDense
              : cfg.fanSparse;

        const indexes = new Set([
          0,
          N - 1,
          centerI
        ]);

        for (let k = -fan; k <= fan; k++) {
          indexes.add(
            clamp(
              centerI + k,
              0,
              N - 1
            )
          );
        }

        // Keep V6's decisive whole-road escape options.
        for (let i = 0; i < N; i += 10) {
          indexes.add(i);
        }

        for (const ti of indexes) {
          const pointerTarget = laneX(ti);

          const x1 =
            (1 - alpha) * st.x +
            alpha * pointerTarget;

          const ev = transitionEvaluation(
            st,
            pointerTarget,
            step,
            paths,
            hazards,
            py,
            dt,
            st.spentHazard,
            allowShield
          );

          if (ev.blocked) continue;

          const delta = x1 - st.x;

          const reversed =
            st.delta !== 0 &&
            delta !== 0 &&
            Math.sign(st.delta) !== Math.sign(delta);

          let cost =
            st.cost +
            ev.risk +
            ev.shieldCost +
            Math.abs(delta) * cfg.moveCost +
            Math.abs(delta - st.delta) * cfg.turnCost +
            (reversed ? cfg.reverseCost : 0) -
            powerRewardAt(x1, t, dt);

          if (previousChosenX != null) {
            cost +=
              Math.abs(x1 - previousChosenX) *
              cfg.hysteresisCost;
          }

          const laneKey = nearestLane(x1);

          // In shield-rescue pass, the identity of the consumed hazard matters
          // because that exact object disappears from the real game.
          const key =
            laneKey + ':' + ev.nextSpentHazard;

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
            delta,
            spentHazard: ev.nextSpentHazard
          };

          const old = nextByState.get(key);

          if (!old || candidate.cost < old.cost) {
            nextByState.set(key, candidate);
          }
        }
      }

      beam =
        [...nextByState.values()]
          .sort((a, b) => a.cost - b.cost)
          .slice(0, cfg.beamWidth);

      if (!beam.length) {
        return null;
      }
    }

    const best = beam[0];

    if (!best) return null;

    return {
      emergency: false,
      shieldRescue:
        allowShield &&
        best.spentHazard >= 0,
      target: best.firstTarget,
      firstActualX: best.firstActualX,
      risk: best.cost,
      horizon
    };
  }

  function emergencyPlan(width, paths, hazards, steps) {
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
        for (
          let s = 0;
          s < Math.min(steps, paths[h].length);
          s++
        ) {
          const z = paths[h][s];

          if (
            z.y < py - 180 ||
            z.y > py + 110
          ) {
            continue;
          }

          minClearance = Math.min(
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
      shieldRescue: false,
      target: bestX,
      firstActualX: bestX,
      risk: 99999,
      horizon: dynamicHorizon()
    };
  }

  function buildPlan() {
    if (!player) return null;

    const started = performance.now();

    const rect = cv.getBoundingClientRect();
    const width = rect.width;
    const py = player.y;
    const minX = cfg.playerEdge;
    const maxX = width - cfg.playerEdge;

    const horizon = dynamicHorizon();
    const dt = cfg.dt;
    const steps = Math.max(
      4,
      Math.ceil(horizon / dt)
    );

    const wallNow = performance.now();

    // Performance fix without changing V6's planner semantics:
    // skip hazards that cannot enter the player's vertical danger band inside
    // this horizon. Use full speed for the bound, so pruning stays safe.
    const hazards =
      [...hazardRefs]
        .filter(z =>
          z.y <= py + 120 &&
          z.y + Math.max(0, z.vy) * horizon >= py - 190
        );

    const paths = hazards.map(z =>
      buildHazardPath(
        z,
        steps,
        dt,
        width,
        wallNow
      )
    );

    const args = {
      paths,
      hazards,
      width,
      py,
      minX,
      maxX,
      horizon,
      dt,
      steps
    };

    // Pass 1: preserve shield and demand a completely clean route.
    let plan = runBeam({
      ...args,
      allowShield: false
    });

    // Pass 2: only if no clean path survives the whole horizon, model exactly
    // one legal shield collision and ignore that consumed hazard afterwards.
    if (!plan && shieldActive()) {
      plan = runBeam({
        ...args,
        allowShield: true
      });
    }

    if (!plan) {
      plan = emergencyPlan(
        width,
        paths,
        hazards,
        steps
      );
    }

    lastPlannerMs =
      performance.now() - started;

    return plan;
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
        : plan.shieldRescue
          ? 'SHIELD RESCUE'
          : 'EXACT-STATE MPC';

    lastRisk =
      Number.isFinite(plan.risk)
        ? plan.risk
        : 99999;

    const rect = cv.getBoundingClientRect();

    targetX = clamp(
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
      relevantHazards:
        [...hazardRefs].filter(z =>
          z.y <= player.y + 120 &&
          z.y + Math.max(0, z.vy) * dynamicHorizon() >= player.y - 190
        ).length,
      powers: powerRefs.size,
      risk: Math.round(lastRisk),
      mode: plannerMode,
      shield: shieldActive(),
      hypeRemainingMs: Math.round(hypeRemainingMs()),
      plannerMs: Math.round(lastPlannerMs * 10) / 10
    });

    while (history.length > cfg.historyFrames) {
      history.shift();
    }

    renderHud(plan.horizon);
  }

  function onGameFrame() {
    const score = currentScore();

    // Fallback reset if a run somehow starts without a classified object push.
    if (lastScore > 50 && score <= 5) {
      resetObservedRun();
    }

    lastScore = score;

    cleanupRefs();
    syncHypeClock();

    if (!enabled) {
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
      'ORBIT BOT V8: ' +
      (enabled ? 'ON' : 'OFF') + '\n' +
      'planner: ' + plannerMode + '\n' +
      'hazards exact: ' + hazardRefs.size + '\n' +
      'powers exact: ' + powerRefs.size + '\n' +
      'car: ' +
      (player ? Math.round(player.x) : '-') +
      ' → ' +
      (targetX == null ? '-' : Math.round(targetX)) + '\n' +
      'risk: ' + Math.round(lastRisk) + '\n' +
      'horizon: ' +
      Number(horizon || 0).toFixed(2) + 's\n' +
      'shield: ' +
      (shieldActive() ? 'YES' : 'NO') +
      ' · hype left: ' +
      (hypeRemainingMs() / 1000).toFixed(2) + 's\n' +
      'planner: ' +
      lastPlannerMs.toFixed(1) + 'ms\n' +
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

    try {
      Array.prototype.push = original.arrayPush;
    } catch (_) {}

    try {
      Array.prototype.splice = original.arraySplice;
    } catch (_) {}

    try {
      ctx.stroke = original.stroke;
    } catch (_) {}

    window.removeEventListener(
      'keydown',
      keyHandler,
      true
    );

    hud.remove();

    hazardRefs.clear();
    powerRefs.clear();

    if (window.orbitBot?.destroy === destroy) {
      delete window.orbitBot;
    }

    console.log('[OrbitBot V8] destroyed.');
  }

  window.addEventListener(
    'keydown',
    keyHandler,
    true
  );

  window.orbitBot = {
    version: 8,

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
        version: 8,
        enabled,
        host,
        score: currentScore(),
        plannerMode,
        risk: lastRisk,
        plannerMs: lastPlannerMs,
        player,
        targetX,
        shield: shieldActive(),
        hypeRemainingMs: hypeRemainingMs(),
        horizon: dynamicHorizon(),

        hazards:
          [...hazardRefs].map(z => ({
            x: Math.round(z.x),
            y: Math.round(z.y),
            vx: Math.round(z.vx),
            vy: Math.round(z.vy),
            size: Math.round(z.size)
          })),

        powers:
          [...powerRefs].map(p => ({
            kind: p.kind,
            x: Math.round(p.x),
            y: Math.round(p.y),
            vy: Math.round(p.vy)
          })),

        config: { ...cfg }
      };
    },

    lastFrames(n = 60) {
      return history.slice(
        -Math.max(1, n)
      );
    },

    config: cfg
  };

  renderHud();

  console.log(
    '[OrbitBot V8] loaded.',
    '\nPURE AUTOPLAYER — game rules untouched.',
    '\nBack on V6 exact-state beam MPC with targeted log-proven fixes.',
    '\nHost:', host || '(file://)',
    '\nF8 toggles.'
  );
})();