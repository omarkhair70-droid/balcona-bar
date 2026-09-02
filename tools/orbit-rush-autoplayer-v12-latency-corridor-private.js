(() => {
  'use strict';

  /*
    Orbit Rush Autoplayer V12 — LATENCY-CORRIDOR PRIVATE / LOCAL ONLY
    =====================================================
    Pure autoplayer. The game itself is NOT modified.

    Built from V9's successful performance architecture, with fixes derived
    from the V9 death log:

    - heavy planning stays in a Web Worker;
    - worker returns a short future target trajectory, not one stale target;
    - main thread applies the trajectory point matching the plan's age;
    - safety reflex has priority and LATCHES, so worker/reflex cannot fight;
    - reflex triggers earlier and releases only after repeated safe frames;
    - strategic planner adds mobility/edge reserve to avoid needless wall traps;
    - exact game hazard/power object references are still used;
    - HYPE expiry and one legal shield hit are modeled.

    It only READS game state and dispatches normal pointermove events.
    It does NOT alter score, verifiedScore, collision logic, spawns, speeds,
    shield/HYPE, API calls, run_id, token, duration_ms or leaderboard.
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
    console.error('[OrbitBot V12] Refusing to run on public 101-creations.com.');
    return;
  }

  if (!allowed) {
    console.error(
      '[OrbitBot V12] Host is not whitelisted:',
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
    console.error('[OrbitBot V12] #canvas not found.');
    return;
  }

  if (window.orbitBot?.destroy) {
    try { window.orbitBot.destroy(); } catch (_) {}
  }

  const ctx = cv.getContext('2d');

  if (!ctx) {
    console.error('[OrbitBot V12] 2D context unavailable.');
    return;
  }

  const cfg = {
    debug: true,

    // Worker planner: deliberately lighter than V9's ~68ms average.
    planDt: 0.050,
    laneCount: 101,
    beamWidth: 145,
    sparseFan: 14,
    denseFan: 18,
    extremeFan: 21,
    denseHazards: 12,
    extremeHazards: 20,
    workerPlanEveryMs: 22,
    workerMaxAcceptedAgeMs: 150,
    returnedTrajectorySteps: 9,

    // Horizon remains below plausible unseen-hazard arrival.
    minHorizonSec: 0.95,
    maxHorizonSec: 1.65,
    unseenArrivalSafety: 0.82,

    // Actual game movement/geometry.
    followRate: 12.5,
    playerHalfWidth: 24,
    playerHalfHeight: 18,
    playerEdge: 31,

    // Strategic risk.
    safetyMargin: 8,
    nearMissRadius: 116,
    nearMissCost: 82,
    moveCost: 0.0037,
    turnCost: 0.014,
    reverseCost: 0.11,
    hysteresisCost: 0.0012,

    // Avoid camping against a wall unless it is truly necessary.
    edgeReservePx: 72,
    edgeReserveCost: 52,
    mobilityCenterCost: 0.0012,

    // Powers.
    chasePowers: true,
    abyRewardNoShield: 155,
    abyRewardWithShield: 2,
    shehabReward: 115,
    shieldSpendCost: 250,

    // Fast main-thread guard.
    guardHorizonSec: 0.52,
    guardCandidates: 35,
    guardCollisionMargin: 3,
    guardTriggerClearance: 28,
    guardReleaseClearance: 44,
    guardLatchMs: 300,
    guardReleaseSafeFrames: 5,
    guardReplanEveryMs: 66,
    guardEmergencyClearance: 8,
    guardDirectionFlipPenalty: 150,
    guardMovePenalty: 0.008,
    guardCorridorWidthWeight: 0.42,
    guardCorridorClearanceWeight: 1.0,
    guardCorridorEdgePenalty: 46,
    guardCorridorCenterBias: 0.018,

    historyFrames: 300
  };

  let enabled = true;
  let destroyed = false;

  const hazardRefs = new Set();
  const powerRefs = new Set();

  let player = null;
  let targetX = null;
  let previousChosenX = null;

  let plannerMode = 'INIT';
  let lastRisk = 0;
  let lastScore = 0;

  let seq = 0;
  let workerBusy = false;
  let lastWorkerSentAt = -Infinity;
  let latestPlan = null;
  let lastWorkerMs = 0;
  let workerMsEMA = 0;
  let lastWorkerAgeMs = Infinity;

  let frameMsEMA = 16.67;
  let lastCarFrameAt = null;

  let hypeEndAt = 0;
  let lastDomHype = null;

  // Guard arbitration state.
  let guardLatched = false;
  let guardLatchUntil = 0;
  let guardTargetX = null;
  let guardSafeFrames = 0;
  let guardDirection = 0;
  let lastGuardPlanAt = -Infinity;

  // HUD is diagnostic only; updating DOM every frame is unnecessary load.
  let lastHudAt = -Infinity;

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
    background: 'rgba(0,0,0,.84)',
    color: '#fff',
    font: '700 12px/1.46 system-ui,sans-serif',
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

  // ---------------------------------------------------------------------------
  // Exact object observation
  // ---------------------------------------------------------------------------

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

    targetX = null;
    previousChosenX = null;
    latestPlan = null;

    plannerMode = 'RESET';
    lastRisk = 0;
    lastWorkerAgeMs = Infinity;

    hypeEndAt = 0;
    lastDomHype = null;

    guardLatched = false;
    guardLatchUntil = 0;
    guardTargetX = null;
    guardSafeFrames = 0;
    guardDirection = 0;
    lastGuardPlanAt = -Infinity;

    history.length = 0;
  }

  function observeAdded(item) {
    const type = classify(item);

    if (!type) return;

    const score = currentScore();

    // reset() replaces the game arrays. The first new hazard is pushed after
    // score has wrapped near zero, so clear stale refs before adding it.
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

  function powerLooksCollected(p) {
    if (!player || !p) return false;

    const dx = p.x - player.x;
    const dy = p.y - player.y;

    return dx * dx + dy * dy <= 48 * 48;
  }

  function observeRemoved(item) {
    if (
      powerRefs.has(item) &&
      item?.kind === 'shehab' &&
      powerLooksCollected(item)
    ) {
      hypeEndAt = performance.now() + 6000;
    }

    hazardRefs.delete(item);
    powerRefs.delete(item);
  }

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
        onCarFrame();
      }
    }

    return original.stroke.apply(this, arguments);
  };

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

  function syncHypeClock() {
    const now = performance.now();
    const dom = domHypeActive();

    if (
      lastDomHype === false &&
      dom === true &&
      hypeEndAt <= now
    ) {
      hypeEndAt = now + 6000;
    }

    if (
      lastDomHype === true &&
      dom === false
    ) {
      hypeEndAt = 0;
    }

    if (
      lastDomHype === null &&
      dom === true &&
      hypeEndAt <= now
    ) {
      // Pasted mid-HYPE: do not invent extra future slowdown.
      hypeEndAt = now;
    }

    lastDomHype = dom;
  }

  // ---------------------------------------------------------------------------
  // Worker planner
  // ---------------------------------------------------------------------------

  function workerMain() {
    'use strict';

    function clamp(v, lo, hi) {
      return Math.max(lo, Math.min(hi, v));
    }

    function collisionAt(px, py, z, c, margin) {
      const rr = z.size * 0.76 + margin;

      const cx = Math.max(
        px - c.playerHalfWidth,
        Math.min(z.x, px + c.playerHalfWidth)
      );

      const cy = Math.max(
        py - c.playerHalfHeight,
        Math.min(z.y, py + c.playerHalfHeight)
      );

      const dx = z.x - cx;
      const dy = z.y - cy;

      return dx * dx + dy * dy <= rr * rr;
    }

    function clearanceAt(px, py, z, c) {
      const rr = z.size * 0.76 + c.safetyMargin;

      const dx = Math.max(
        0,
        Math.abs(z.x - px) - c.playerHalfWidth
      );

      const dy = Math.max(
        0,
        Math.abs(z.y - py) - c.playerHalfHeight
      );

      return Math.sqrt(dx * dx + dy * dy) - rr;
    }

    function frameModel(frameMs, c) {
      const wallSec = clamp(frameMs / 1000, 0.008, 0.080);
      const physicsSec = Math.min(0.035, wallSec);

      return {
        wallSec,
        physicsRate: physicsSec / wallSec,
        perFrameAlpha: Math.min(1, physicsSec * c.followRate)
      };
    }

    function alphaAcross(dt, fm) {
      const frames = dt / fm.wallSec;

      return 1 - Math.pow(
        1 - fm.perFrameAlpha,
        frames
      );
    }

    function advanceSnapshotForLatency(s, c, fm) {
      const leadSec = clamp(
        (Number(s.expectedWorkerLeadMs) || 0) / 1000,
        0,
        0.095
      );

      if (leadSec <= 0) {
        return {
          state: s,
          leadMs: 0
        };
      }

      const out = {
        ...s,
        hazards: s.hazards.map(z => ({ ...z })),
        powers: s.powers.map(p => ({ ...p }))
      };

      const frames = leadSec / fm.wallSec;

      const carAlpha =
        1 - Math.pow(
          1 - fm.perFrameAlpha,
          frames
        );

      const applied =
        Number.isFinite(s.appliedTargetX)
          ? s.appliedTargetX
          : s.playerX;

      out.playerX =
        (1 - carAlpha) * s.playerX +
        carAlpha * applied;

      const physicsLead =
        leadSec * fm.physicsRate;

      const hypeWallSec = Math.min(
        leadSec,
        Math.max(0, s.hypeRemainingMs / 1000)
      );

      const normalWallSec =
        leadSec - hypeWallSec;

      for (const z of out.hazards) {
        let nx = z.x + z.vx * physicsLead;

        // At this short lead there can normally be at most one wall bounce,
        // but reflect robustly if a large vx happens to cross farther.
        const lo = z.size;
        const hi = out.width - z.size;

        for (let guard = 0; guard < 3; guard++) {
          if (nx < lo) {
            nx = lo + (lo - nx);
            z.vx *= -1;
          } else if (nx > hi) {
            nx = hi - (nx - hi);
            z.vx *= -1;
          } else {
            break;
          }
        }

        z.x = nx;

        z.y +=
          z.vy *
          fm.physicsRate *
          (
            hypeWallSec * 0.74 +
            normalWallSec
          );
      }

      for (const p of out.powers) {
        p.y +=
          p.vy *
          physicsLead;
      }

      out.hypeRemainingMs =
        Math.max(
          0,
          s.hypeRemainingMs -
          leadSec * 1000
        );

      out.previousChosenX =
        out.playerX;

      return {
        state: out,
        leadMs: leadSec * 1000
      };
    }

    function horizonFor(s, fm, c) {
      const fastestWallVy = 620 * fm.physicsRate;

      const earliestUnseen =
        (s.playerY + 50) /
        Math.max(120, fastestWallVy);

      return clamp(
        earliestUnseen * c.unseenArrivalSafety,
        c.minHorizonSec,
        c.maxHorizonSec
      );
    }

    function buildPaths(s, c, fm, horizon, steps) {
      const dt = c.planDt;

      const hazards = s.hazards.filter(z => {
        const wallVy = Math.max(0, z.vy) * fm.physicsRate;

        return (
          z.y <= s.playerY + 125 &&
          z.y + wallVy * horizon >= s.playerY - 200
        );
      });

      const paths = hazards.map(z => {
        let x = z.x;
        let y = z.y;
        let vx = z.vx;

        const out = new Array(steps);

        for (let k = 0; k < steps; k++) {
          const t0 = k * dt;
          const t1 = (k + 1) * dt;

          const hypeSec = Math.max(
            0,
            Math.min(t1, s.hypeRemainingMs / 1000) - t0
          );

          const normalSec = dt - hypeSec;
          const physicsDt = dt * fm.physicsRate;

          x += vx * physicsDt;

          y += z.vy * fm.physicsRate * (
            hypeSec * 0.74 +
            normalSec
          );

          if (x < z.size || x > s.width - z.size) {
            vx *= -1;
          }

          out[k] = { x, y, size: z.size };
        }

        return out;
      });

      return { hazards, paths };
    }

    function powerRewardAt(s, c, fm, x, t) {
      if (!c.chasePowers) return 0;

      let reward = 0;

      for (const p of s.powers) {
        const py = p.y + p.vy * fm.physicsRate * t;

        if (
          Math.abs(py - s.playerY) > 34 ||
          Math.abs(p.x - x) > 42
        ) {
          continue;
        }

        if (p.kind === 'aby') {
          reward += s.shield
            ? c.abyRewardWithShield
            : c.abyRewardNoShield;
        } else if (p.kind === 'shehab') {
          reward += c.shehabReward;
        }
      }

      return reward;
    }

    function transition(
      st,
      pointerTarget,
      step,
      paths,
      hazards,
      s,
      c,
      alpha,
      allowShield
    ) {
      const x1 =
        (1 - alpha) * st.x +
        alpha * pointerTarget;

      let risk = 0;
      const hits = new Set();

      // Immediate half-slice + endpoint.
      for (const q of [0.5, 1]) {
        const carX =
          q === 1
            ? x1
            : st.x + (x1 - st.x) * 0.5;

        for (let h = 0; h < paths.length; h++) {
          if (h === st.spentHazard) continue;

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
            z.y < s.playerY - 180 ||
            z.y > s.playerY + 110
          ) {
            continue;
          }

          if (
            collisionAt(
              carX,
              s.playerY,
              z,
              c,
              c.safetyMargin
            )
          ) {
            hits.add(h);
            continue;
          }

          const clearance = clearanceAt(
            carX,
            s.playerY,
            z,
            c
          );

          if (clearance < c.nearMissRadius) {
            risk += (
              c.nearMissCost *
              Math.exp(-Math.max(0, clearance) / 25) /
              Math.max(0.18, (step + q) * c.planDt)
            ) / 2;
          }
        }
      }

      let spentHazard = st.spentHazard;
      let shieldCost = 0;

      if (hits.size) {
        if (
          allowShield &&
          spentHazard < 0 &&
          hits.size === 1
        ) {
          spentHazard = [...hits][0];
          shieldCost = c.shieldSpendCost;
        } else {
          return null;
        }
      }

      return {
        x1,
        risk,
        spentHazard,
        shieldCost
      };
    }

    function reconstructPlan(best, maxSteps, fallbackX) {
      const reversedTargets = [];
      const reversedXs = [];
      let cur = best;

      while (cur && cur.parent) {
        reversedTargets.push(cur.pointerTarget);
        reversedXs.push(cur.x);
        cur = cur.parent;
      }

      reversedTargets.reverse();
      reversedXs.reverse();

      return {
        trajectory: reversedTargets.slice(0, maxSteps),
        firstActualX:
          reversedXs.length
            ? reversedXs[0]
            : fallbackX
      };
    }

    function beamPass(
      s,
      c,
      fm,
      hazards,
      paths,
      horizon,
      allowShield
    ) {
      const N = c.laneCount;
      const minX = c.playerEdge;
      const maxX = s.width - c.playerEdge;
      const centerX = s.width / 2;

      const steps = Math.max(
        4,
        Math.ceil(horizon / c.planDt)
      );

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

      const alpha = alphaAcross(c.planDt, fm);

      let beam = [{
        x: s.playerX,
        cost: 0,
        delta: 0,
        spentHazard: -1,
        parent: null,
        pointerTarget: null
      }];

      for (let step = 0; step < steps; step++) {
        const t = (step + 1) * c.planDt;
        const nextMap = new Map();

        for (const st of beam) {
          const center = nearestLane(st.x);

          const fan =
            hazards.length >= c.extremeHazards
              ? c.extremeFan
              : hazards.length >= c.denseHazards
                ? c.denseFan
                : c.sparseFan;

          const indexes = new Set([0, N - 1, center]);

          for (let k = -fan; k <= fan; k++) {
            indexes.add(
              clamp(center + k, 0, N - 1)
            );
          }

          for (let i = 0; i < N; i += 10) {
            indexes.add(i);
          }

          for (const ti of indexes) {
            const pointerTarget = laneX(ti);

            const ev = transition(
              st,
              pointerTarget,
              step,
              paths,
              hazards,
              s,
              c,
              alpha,
              allowShield
            );

            if (!ev) continue;

            const delta = ev.x1 - st.x;

            const reversed =
              st.delta !== 0 &&
              delta !== 0 &&
              Math.sign(st.delta) !== Math.sign(delta);

            const edgeDist = Math.min(
              ev.x1 - minX,
              maxX - ev.x1
            );

            const edgeReservePenalty =
              edgeDist >= c.edgeReservePx
                ? 0
                : c.edgeReserveCost *
                  Math.pow(
                    1 - edgeDist / c.edgeReservePx,
                    2
                  );

            let cost =
              st.cost +
              ev.risk +
              ev.shieldCost +
              Math.abs(delta) * c.moveCost +
              Math.abs(delta - st.delta) * c.turnCost +
              (reversed ? c.reverseCost : 0) +
              edgeReservePenalty +
              Math.abs(ev.x1 - centerX) * c.mobilityCenterCost -
              powerRewardAt(s, c, fm, ev.x1, t);

            if (Number.isFinite(s.previousChosenX)) {
              cost +=
                Math.abs(ev.x1 - s.previousChosenX) *
                c.hysteresisCost;
            }

            const lane = nearestLane(ev.x1);
            const key = lane + ':' + ev.spentHazard;

            const candidate = {
              x: ev.x1,
              cost,
              delta,
              spentHazard: ev.spentHazard,
              parent: st,
              pointerTarget
            };

            const old = nextMap.get(key);

            if (!old || candidate.cost < old.cost) {
              nextMap.set(key, candidate);
            }
          }
        }

        beam =
          [...nextMap.values()]
            .sort((a, b) => a.cost - b.cost)
            .slice(0, c.beamWidth);

        if (!beam.length) return null;
      }

      const best = beam[0];

      if (!best) return null;

      const reconstructed = reconstructPlan(
        best,
        c.returnedTrajectorySteps,
        s.playerX
      );

      return {
        trajectory: reconstructed.trajectory,
        firstActualX: reconstructed.firstActualX,
        risk: best.cost,
        mode:
          allowShield && best.spentHazard >= 0
            ? 'WORKER SHIELD'
            : 'WORKER EXACT'
      };
    }

    function emergency(s, c, hazards, paths) {
      const minX = c.playerEdge;
      const maxX = s.width - c.playerEdge;
      const samples = 101;

      let bestX = s.playerX;
      let bestScore = -Infinity;

      const lookSteps = Math.min(
        paths[0]?.length || 1,
        Math.ceil(0.62 / c.planDt)
      );

      for (let i = 0; i < samples; i++) {
        const x =
          minX +
          (maxX - minX) *
          i /
          (samples - 1);

        let minimum = Infinity;

        for (let h = 0; h < paths.length; h++) {
          for (let k = 0; k < lookSteps; k++) {
            const z = paths[h][k];

            if (
              z.y < s.playerY - 180 ||
              z.y > s.playerY + 110
            ) {
              continue;
            }

            minimum = Math.min(
              minimum,
              clearanceAt(x, s.playerY, z, c)
            );
          }
        }

        const edgeDist = Math.min(
          x - minX,
          maxX - x
        );

        const edgePenalty =
          edgeDist >= c.edgeReservePx
            ? 0
            : c.edgeReserveCost *
              Math.pow(
                1 - edgeDist / c.edgeReservePx,
                2
              );

        const score =
          minimum -
          Math.abs(x - s.playerX) * 0.01 -
          edgePenalty;

        if (score > bestScore) {
          bestScore = score;
          bestX = x;
        }
      }

      return {
        trajectory: [bestX],
        firstActualX: bestX,
        risk: 99999,
        mode: 'WORKER EMERGENCY'
      };
    }

    self.onmessage = e => {
      const msg = e.data;

      if (!msg || msg.type !== 'plan') return;

      const started = performance.now();
      const raw = msg.snapshot;
      const c = msg.config;

      const baseFm = frameModel(raw.frameMs, c);

      const advanced = advanceSnapshotForLatency(
        raw,
        c,
        baseFm
      );

      const s = advanced.state;
      const fm = frameModel(s.frameMs, c);
      const horizon = horizonFor(s, fm, c);

      const steps = Math.max(
        4,
        Math.ceil(horizon / c.planDt)
      );

      const built = buildPaths(
        s,
        c,
        fm,
        horizon,
        steps
      );

      let plan = beamPass(
        s,
        c,
        fm,
        built.hazards,
        built.paths,
        horizon,
        false
      );

      if (!plan && s.shield) {
        plan = beamPass(
          s,
          c,
          fm,
          built.hazards,
          built.paths,
          horizon,
          true
        );
      }

      if (!plan) {
        plan = emergency(
          s,
          c,
          built.hazards,
          built.paths
        );
      }

      self.postMessage({
        type: 'plan',
        seq: msg.seq,
        snapshotAt: msg.snapshotAt,
        trajectory: plan.trajectory,
        firstActualX: plan.firstActualX,
        risk: plan.risk,
        mode: plan.mode,
        horizon,
        relevantHazards: built.hazards.length,
        predictedLeadMs: advanced.leadMs,
        workerMs: performance.now() - started
      });
    };
  }

  const workerSource = '(' + workerMain.toString() + ')();';

  const workerBlob = new Blob(
    [workerSource],
    { type: 'text/javascript' }
  );

  const workerUrl = URL.createObjectURL(workerBlob);
  const plannerWorker = new Worker(workerUrl);

  setTimeout(
    () => URL.revokeObjectURL(workerUrl),
    1000
  );

  plannerWorker.onmessage = e => {
    const msg = e.data;

    if (!msg || msg.type !== 'plan') return;

    workerBusy = false;

    const now = performance.now();
    const age = now - msg.snapshotAt;

    lastWorkerMs = Number(msg.workerMs) || 0;

    workerMsEMA =
      workerMsEMA === 0
        ? lastWorkerMs
        : workerMsEMA * 0.82 + lastWorkerMs * 0.18;

    lastWorkerAgeMs = age;

    if (
      destroyed ||
      !enabled ||
      age > cfg.workerMaxAcceptedAgeMs
    ) {
      return;
    }

    latestPlan = {
      receivedAt: now,
      snapshotAt: msg.snapshotAt,
      planBaseAt:
        msg.snapshotAt +
        (Number(msg.predictedLeadMs) || 0),
      trajectory: Array.isArray(msg.trajectory)
        ? msg.trajectory
        : [],
      firstActualX: msg.firstActualX,
      risk: Number.isFinite(msg.risk)
        ? msg.risk
        : 99999,
      mode: msg.mode || 'WORKER',
      horizon: msg.horizon
    };

    lastRisk = latestPlan.risk;

    if (!guardLatched) {
      plannerMode = latestPlan.mode;
    }

    renderHud(latestPlan.horizon);
  };

  plannerWorker.onerror = err => {
    workerBusy = false;
    plannerMode = 'WORKER ERROR';

    console.error('[OrbitBot V12 worker]', err);
  };

  function snapshot() {
    if (!player) return null;

    const rect = cv.getBoundingClientRect();

    return {
      playerX: player.x,
      playerY: player.y,
      width: rect.width,
      height: rect.height,
      frameMs: clamp(frameMsEMA, 8, 80),
      appliedTargetX:
        Number.isFinite(targetX)
          ? targetX
          : player.x,
      expectedWorkerLeadMs:
        clamp(
          workerMsEMA ||
          lastWorkerMs ||
          55,
          20,
          95
        ),
      shield: shieldActive(),
      hypeRemainingMs: hypeRemainingMs(),
      previousChosenX:
        Number.isFinite(previousChosenX)
          ? previousChosenX
          : null,
      hazards: [...hazardRefs].map(z => ({
        x: z.x,
        y: z.y,
        vx: z.vx,
        vy: z.vy,
        size: z.size
      })),
      powers: [...powerRefs].map(p => ({
        kind: p.kind,
        x: p.x,
        y: p.y,
        vy: p.vy,
        r: p.r
      }))
    };
  }

  function maybeRequestWorkerPlan() {
    if (
      !enabled ||
      !player ||
      workerBusy
    ) {
      return;
    }

    const now = performance.now();

    if (
      now - lastWorkerSentAt <
      cfg.workerPlanEveryMs
    ) {
      return;
    }

    const s = snapshot();

    if (!s) return;

    const id = ++seq;

    workerBusy = true;
    lastWorkerSentAt = now;

    plannerWorker.postMessage({
      type: 'plan',
      seq: id,
      snapshotAt: now,
      snapshot: s,
      config: cfg
    });
  }

  function ageCompensatedWorkerTarget(now) {
    if (
      !latestPlan ||
      !latestPlan.trajectory.length
    ) {
      return null;
    }

    const rawAgeMs =
      now - latestPlan.snapshotAt;

    if (
      rawAgeMs >
      cfg.workerMaxAcceptedAgeMs
    ) {
      return null;
    }

    const executionAgeMs =
      Math.max(
        0,
        now -
        (
          Number.isFinite(latestPlan.planBaseAt)
            ? latestPlan.planBaseAt
            : latestPlan.receivedAt
        )
      );

    const stepMs = cfg.planDt * 1000;

    const index = clamp(
      Math.floor(executionAgeMs / stepMs),
      0,
      latestPlan.trajectory.length - 1
    );

    const x = latestPlan.trajectory[index];

    return Number.isFinite(x) ? x : null;
  }

  // ---------------------------------------------------------------------------
  // Main-thread safety guard
  // ---------------------------------------------------------------------------

  function frameModelMain() {
    const wallSec = clamp(
      frameMsEMA / 1000,
      0.008,
      0.080
    );

    const physicsSec = Math.min(
      0.035,
      wallSec
    );

    return {
      wallSec,
      physicsSec,
      physicsRate: physicsSec / wallSec,
      perFrameAlpha: Math.min(
        1,
        physicsSec * cfg.followRate
      )
    };
  }

  function guardAlpha(dt, fm) {
    const frames = dt / fm.wallSec;

    return 1 - Math.pow(
      1 - fm.perFrameAlpha,
      frames
    );
  }

  function guardCollision(px, py, z) {
    const rr =
      z.size * 0.76 +
      cfg.guardCollisionMargin;

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

  function guardClearance(px, py, z) {
    const rr =
      z.size * 0.76 +
      cfg.guardCollisionMargin;

    const dx = Math.max(
      0,
      Math.abs(z.x - px) -
      cfg.playerHalfWidth
    );

    const dy = Math.max(
      0,
      Math.abs(z.y - py) -
      cfg.playerHalfHeight
    );

    return Math.sqrt(dx * dx + dy * dy) - rr;
  }

  function buildGuardPaths() {
    const fm = frameModelMain();

    // Match the game's real frame cadence instead of sampling every 40ms.
    const dt = fm.wallSec;

    const steps = Math.ceil(
      cfg.guardHorizonSec / dt
    );

    const width = cv.getBoundingClientRect().width;
    const now = performance.now();
    const hypeSecRemaining = hypeRemainingMs(now) / 1000;

    const hazards = [];

    for (const z of hazardRefs) {
      if (
        z.y <= player.y + 105 &&
        z.y +
          z.vy *
          fm.physicsRate *
          cfg.guardHorizonSec >=
          player.y - 170
      ) {
        hazards.push(z);
      }
    }

    const paths = new Array(hazards.length);

    for (let h = 0; h < hazards.length; h++) {
      const z = hazards[h];

      let x = z.x;
      let y = z.y;
      let vx = z.vx;

      const xs = new Float32Array(steps);
      const ys = new Float32Array(steps);

      for (let s = 0; s < steps; s++) {
        const t0 = s * dt;
        const t1 = (s + 1) * dt;

        const hypeSec = Math.max(
          0,
          Math.min(t1, hypeSecRemaining) - t0
        );

        const normalSec = dt - hypeSec;
        const physicsDt = fm.physicsSec;

        x += vx * physicsDt;

        y += z.vy * fm.physicsRate * (
          hypeSec * 0.74 +
          normalSec
        );

        if (x < z.size || x > width - z.size) {
          vx *= -1;
        }

        xs[s] = x;
        ys[s] = y;
      }

      paths[h] = {
        size: z.size,
        xs,
        ys
      };
    }

    return {
      fm,
      dt,
      steps,
      width,
      hazards,
      paths
    };
  }

  function evaluateGuardTarget(pointerTarget, gp) {
    const alpha = guardAlpha(gp.dt, gp.fm);

    let carX = player.x;
    let minClearance = Infinity;
    let firstHit = -1;
    let hitCount = 0;

    for (let s = 0; s < gp.steps; s++) {
      carX =
        (1 - alpha) * carX +
        alpha * pointerTarget;

      for (let h = 0; h < gp.paths.length; h++) {
        const path = gp.paths[h];

        const zx = path.xs[s];
        const zy = path.ys[s];

        if (
          zy < player.y - 170 ||
          zy > player.y + 100
        ) {
          continue;
        }

        const z = {
          x: zx,
          y: zy,
          size: path.size
        };

        if (guardCollision(carX, player.y, z)) {
          if (firstHit < 0) {
            firstHit = h;
            hitCount = 1;
          } else if (firstHit !== h) {
            hitCount = 2;
            return {
              hitCount,
              minClearance,
              finalX: carX
            };
          }

          continue;
        }

        minClearance = Math.min(
          minClearance,
          guardClearance(carX, player.y, z)
        );
      }
    }

    return {
      hitCount,
      minClearance,
      finalX: carX
    };
  }

  function candidateGuardTarget(
    gp,
    referenceTarget,
    lockedDirection = 0
  ) {
    const minX = cfg.playerEdge;
    const maxX = gp.width - cfg.playerEdge;

    const rows = [];

    for (let i = 0; i < cfg.guardCandidates; i++) {
      const x =
        minX +
        (maxX - minX) *
        i /
        (cfg.guardCandidates - 1);

      const ev = evaluateGuardTarget(x, gp);

      const legal =
        ev.hitCount === 0 ||
        (
          shieldActive() &&
          ev.hitCount === 1
        );

      rows.push({
        x,
        ev,
        legal,
        shieldHit:
          ev.hitCount === 1
      });
    }

    // Prefer clean corridors. Only consider a shield corridor if literally no
    // zero-hit corridor exists across the sampled road.
    const hasClean = rows.some(
      r =>
        r.legal &&
        !r.shieldHit
    );

    const acceptable = r =>
      r.legal &&
      (
        !hasClean ||
        !r.shieldHit
      );

    const corridors = [];
    let current = [];

    for (const row of rows) {
      if (acceptable(row)) {
        current.push(row);
      } else if (current.length) {
        corridors.push(current);
        current = [];
      }
    }

    if (current.length) {
      corridors.push(current);
    }

    if (!corridors.length) {
      return null;
    }

    let bestCorridor = null;

    for (const corridor of corridors) {
      const left = corridor[0].x;
      const right = corridor[corridor.length - 1].x;
      const width = Math.max(0, right - left);

      let bestClearance = -Infinity;

      for (const r of corridor) {
        bestClearance = Math.max(
          bestClearance,
          r.ev.minClearance
        );
      }

      const center = (left + right) / 2;

      const edgeDist = Math.min(
        center - minX,
        maxX - center
      );

      const edgePenalty =
        edgeDist >= cfg.edgeReservePx
          ? 0
          : cfg.guardCorridorEdgePenalty *
            Math.pow(
              1 - edgeDist / cfg.edgeReservePx,
              2
            );

      const direction =
        Math.abs(center - player.x) < 8
          ? 0
          : Math.sign(center - player.x);

      const flipPenalty =
        lockedDirection !== 0 &&
        direction !== 0 &&
        direction !== lockedDirection
          ? cfg.guardDirectionFlipPenalty
          : 0;

      const movePenalty =
        Math.abs(center - player.x) *
        cfg.guardMovePenalty;

      const referencePenalty =
        Number.isFinite(referenceTarget)
          ? Math.abs(center - referenceTarget) *
            cfg.guardCorridorCenterBias
          : 0;

      const score =
        width *
          cfg.guardCorridorWidthWeight +
        bestClearance *
          cfg.guardCorridorClearanceWeight -
        edgePenalty -
        flipPenalty -
        movePenalty -
        referencePenalty;

      if (
        !bestCorridor ||
        score > bestCorridor.score
      ) {
        bestCorridor = {
          corridor,
          center,
          direction,
          score
        };
      }
    }

    if (!bestCorridor) return null;

    // Use the sampled point nearest the safe-corridor center. This preserves
    // clearance on BOTH sides instead of greedily hugging one wall.
    let chosen = bestCorridor.corridor[0];

    for (const row of bestCorridor.corridor) {
      if (
        Math.abs(row.x - bestCorridor.center) <
        Math.abs(chosen.x - bestCorridor.center)
      ) {
        chosen = row;
      }
    }

    return {
      target: chosen.x,
      score: bestCorridor.score,
      hitCount: chosen.ev.hitCount,
      clearance: chosen.ev.minClearance,
      direction:
        bestCorridor.direction
    };
  }

  function arbitrateTarget(workerTarget, now) {
    const rect = cv.getBoundingClientRect();
    const minX = cfg.playerEdge;
    const maxX = rect.width - cfg.playerEdge;

    const safeWorkerTarget = clamp(
      Number.isFinite(workerTarget)
        ? workerTarget
        : (
            Number.isFinite(targetX)
              ? targetX
              : player.x
          ),
      minX,
      maxX
    );

    const gp = buildGuardPaths();

    const workerEval = evaluateGuardTarget(
      safeWorkerTarget,
      gp
    );

    const workerSafe =
      workerEval.hitCount === 0 &&
      workerEval.minClearance >=
        cfg.guardTriggerClearance;

    if (!guardLatched && !workerSafe) {
      const best = candidateGuardTarget(
        gp,
        safeWorkerTarget,
        0
      );

      guardLatched = true;
      guardLatchUntil = now + cfg.guardLatchMs;
      guardSafeFrames = 0;
      lastGuardPlanAt = now;

      if (best) {
        guardTargetX = best.target;
        guardDirection =
          best.direction ||
          Math.sign(best.target - player.x);
      } else {
        guardTargetX = safeWorkerTarget;
        guardDirection =
          Math.sign(guardTargetX - player.x);
      }

      plannerMode = 'COMMITTED SAFETY';
    }

    if (guardLatched) {
      const currentGuardTarget = clamp(
        Number.isFinite(guardTargetX)
          ? guardTargetX
          : safeWorkerTarget,
        minX,
        maxX
      );

      const guardEval = evaluateGuardTarget(
        currentGuardTarget,
        gp
      );

      const guardImmediatelyUnsafe =
        guardEval.hitCount > 0 ||
        guardEval.minClearance <
          cfg.guardEmergencyClearance;

      const periodicReplanDue =
        now - lastGuardPlanAt >=
        cfg.guardReplanEveryMs;

      // Critical V10 fix:
      // Do NOT rescan and change escape direction every frame.
      // Hold the committed escape unless it is actually becoming unsafe.
      if (
        guardImmediatelyUnsafe ||
        (
          periodicReplanDue &&
          guardEval.minClearance <
            cfg.guardTriggerClearance
        )
      ) {
        const best = candidateGuardTarget(
          gp,
          currentGuardTarget,
          guardDirection
        );

        lastGuardPlanAt = now;

        if (best) {
          guardTargetX = best.target;

          if (
            best.direction !== 0 &&
            (
              guardDirection === 0 ||
              best.direction === guardDirection ||
              guardImmediatelyUnsafe
            )
          ) {
            guardDirection = best.direction;
          }
        }
      }

      const releaseSafe =
        workerEval.hitCount === 0 &&
        workerEval.minClearance >=
          cfg.guardReleaseClearance;

      if (
        now >= guardLatchUntil &&
        releaseSafe
      ) {
        guardSafeFrames++;
      } else {
        guardSafeFrames = 0;
      }

      if (
        guardSafeFrames >=
        cfg.guardReleaseSafeFrames
      ) {
        guardLatched = false;
        guardSafeFrames = 0;
        guardTargetX = null;
        guardDirection = 0;
        plannerMode =
          latestPlan?.mode ||
          'WORKER';

        return {
          target: safeWorkerTarget,
          guard: false
        };
      }

      return {
        target: clamp(
          guardTargetX,
          minX,
          maxX
        ),
        guard: true
      };
    }

    return {
      target: safeWorkerTarget,
      guard: false
    };
  }

  function dispatchTarget(x) {
    if (!player || !Number.isFinite(x)) return;

    const rect = cv.getBoundingClientRect();

    cv.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerType: 'mouse',
        clientX:
          rect.left +
          clamp(
            x,
            cfg.playerEdge,
            rect.width - cfg.playerEdge
          ),
        clientY:
          rect.top +
          player.y
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Main frame
  // ---------------------------------------------------------------------------

  function onCarFrame() {
    const now = performance.now();

    if (lastCarFrameAt != null) {
      const frameMs = now - lastCarFrameAt;

      if (frameMs > 3 && frameMs < 200) {
        frameMsEMA =
          frameMsEMA * 0.88 +
          frameMs * 0.12;
      }
    }

    lastCarFrameAt = now;

    const score = currentScore();

    if (lastScore > 50 && score <= 5) {
      resetObservedRun();
    }

    lastScore = score;

    cleanupRefs();
    syncHypeClock();

    if (!enabled) {
      renderHud();
      return;
    }

    maybeRequestWorkerPlan();

    const workerTarget =
      ageCompensatedWorkerTarget(now);

    if (
      latestPlan &&
      Number.isFinite(latestPlan.firstActualX)
    ) {
      previousChosenX =
        latestPlan.firstActualX;
    }

    if (
      !guardLatched &&
      latestPlan
    ) {
      plannerMode =
        latestPlan.mode;
      lastRisk =
        latestPlan.risk;
    }

    const arbitration =
      arbitrateTarget(
        workerTarget,
        now
      );

    targetX =
      arbitration.target;

    dispatchTarget(targetX);

    history.push({
      t: now,
      score,
      carX: Math.round(player.x),
      targetX:
        Number.isFinite(targetX)
          ? Math.round(targetX)
          : null,
      workerTargetX:
        Number.isFinite(workerTarget)
          ? Math.round(workerTarget)
          : null,
      hazards: hazardRefs.size,
      powers: powerRefs.size,
      mode: plannerMode,
      guardLatched,
      risk: Math.round(lastRisk),
      shield: shieldActive(),
      hypeRemainingMs: Math.round(
        hypeRemainingMs()
      ),
      frameMs:
        Math.round(frameMsEMA * 10) / 10,
      fps:
        Math.round(
          1000 / Math.max(1, frameMsEMA)
        ),
      workerMs:
        Math.round(lastWorkerMs * 10) / 10,
      workerMsEMA:
        Math.round(workerMsEMA * 10) / 10,
      workerAgeMs:
        Math.round(lastWorkerAgeMs * 10) / 10,
      trajectoryAgeStep:
        latestPlan
          ? clamp(
              Math.floor(
                Math.max(
                  0,
                  now -
                  (
                    Number.isFinite(latestPlan.planBaseAt)
                      ? latestPlan.planBaseAt
                      : latestPlan.receivedAt
                  )
                ) /
                (cfg.planDt * 1000)
              ),
              0,
              Math.max(
                0,
                latestPlan.trajectory.length - 1
              )
            )
          : null
    });

    while (
      history.length >
      cfg.historyFrames
    ) {
      history.shift();
    }

    renderHud();
  }

  function renderHud(force = false) {
    if (!cfg.debug) return;

    const now = performance.now();

    if (
      !force &&
      now - lastHudAt < 180
    ) {
      return;
    }

    lastHudAt = now;

    const fps =
      1000 /
      Math.max(1, frameMsEMA);

    hud.textContent =
      'ORBIT BOT V12 · LONG-RUN CANDIDATE\n' +
      'mode: ' + plannerMode +
      '\nguard latch: ' +
      (guardLatched ? 'YES' : 'NO') +
      '\nhazards: ' +
      hazardRefs.size +
      ' · powers: ' +
      powerRefs.size +
      '\ncar: ' +
      (player ? Math.round(player.x) : '-') +
      ' → ' +
      (
        Number.isFinite(targetX)
          ? Math.round(targetX)
          : '-'
      ) +
      '\nfps: ' +
      fps.toFixed(1) +
      ' · frame: ' +
      frameMsEMA.toFixed(1) +
      'ms' +
      '\nworker: ' +
      lastWorkerMs.toFixed(1) +
      'ms · ema: ' +
      workerMsEMA.toFixed(1) +
      'ms' +
      '\nage: ' +
      (
        Number.isFinite(lastWorkerAgeMs)
          ? lastWorkerAgeMs.toFixed(1)
          : '-'
      ) +
      'ms' +
      '\nrisk: ' +
      Math.round(lastRisk) +
      '\nshield: ' +
      (shieldActive() ? 'YES' : 'NO') +
      ' · hype left: ' +
      (hypeRemainingMs() / 1000).toFixed(2) +
      's' +
      '\nF8 = toggle';
  }

  // ---------------------------------------------------------------------------
  // Lifecycle / diagnostics
  // ---------------------------------------------------------------------------

  function toggle() {
    enabled = !enabled;
    renderHud(true);
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
      Array.prototype.push =
        original.arrayPush;
    } catch (_) {}

    try {
      Array.prototype.splice =
        original.arraySplice;
    } catch (_) {}

    try {
      ctx.stroke =
        original.stroke;
    } catch (_) {}

    try {
      plannerWorker.terminate();
    } catch (_) {}

    window.removeEventListener(
      'keydown',
      keyHandler,
      true
    );

    hud.remove();

    hazardRefs.clear();
    powerRefs.clear();

    if (
      window.orbitBot?.destroy ===
      destroy
    ) {
      delete window.orbitBot;
    }

    console.log('[OrbitBot V12] destroyed.');
  }

  window.addEventListener(
    'keydown',
    keyHandler,
    true
  );

  window.orbitBot = {
    version: 12,

    start() {
      enabled = true;
      renderHud(true);
    },

    stop() {
      enabled = false;
      renderHud(true);
    },

    toggle,
    destroy,

    resetRefs() {
      resetObservedRun();
      renderHud(true);
    },

    status() {
      return {
        version: 12,
        enabled,
        host,
        score: currentScore(),
        plannerMode,
        guardLatched,
        risk: lastRisk,
        frameMs: frameMsEMA,
        fps:
          1000 /
          Math.max(1, frameMsEMA),
        workerMs: lastWorkerMs,
        workerMsEMA,
        workerAgeMs: lastWorkerAgeMs,
        player,
        targetX,
        workerTargetX:
          ageCompensatedWorkerTarget(
            performance.now()
          ),
        shield: shieldActive(),
        hypeRemainingMs:
          hypeRemainingMs(),
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

    lastFrames(n = 100) {
      return history.slice(
        -Math.max(1, n)
      );
    },

    performanceSummary() {
      const rows = history.slice(-180);

      if (!rows.length) return null;

      const avg = key =>
        rows.reduce(
          (sum, r) =>
            sum +
            (Number(r[key]) || 0),
          0
        ) / rows.length;

      return {
        score: currentScore(),
        avgFps: avg('fps'),
        avgFrameMs: avg('frameMs'),
        avgWorkerMs: avg('workerMs'),
        avgWorkerMsEMA: avg('workerMsEMA'),
        maxWorkerMs: Math.max(
          ...rows.map(
            r => Number(r.workerMs) || 0
          )
        ),
        avgWorkerAgeMs: avg('workerAgeMs'),
        guardLatchFrames:
          rows.filter(r => r.guardLatched).length,
        minFps: Math.min(
          ...rows.map(
            r => Number(r.fps) || 999
          )
        ),
        maxFrameMs: Math.max(
          ...rows.map(
            r => Number(r.frameMs) || 0
          )
        ),
        maxHazards: Math.max(
          ...rows.map(
            r => Number(r.hazards) || 0
          )
        )
      };
    },

    config: cfg
  };

  renderHud(true);

  console.log(
    '[OrbitBot V12] loaded.',
    '\nPURE AUTOPLAYER — game rules untouched.',
    '\nV11 performance retained; worker latency and edge-corridor traps fixed.',
    '\nHost:', host || '(file://)',
    '\nF8 toggles.'
  );
})();