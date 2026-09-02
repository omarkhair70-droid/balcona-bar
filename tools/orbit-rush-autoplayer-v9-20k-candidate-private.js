(() => {
  'use strict';

  /*
    Orbit Rush Autoplayer V9 — 20K CANDIDATE — PRIVATE / LOCAL ONLY
    =================================================================
    Pure autoplayer. The game itself is NOT modified.

    Design goal:
    - preserve V6's exact-state intelligence;
    - remove heavy planning from the game's main thread;
    - keep a tiny frame-by-frame safety reflex on the main thread;
    - model real game frame timing, HYPE expiry, and one legal shield hit.

    It does NOT change:
    score / verifiedScore / hazardHitsCar / spawn rates / speeds /
    shield / HYPE / start / heartbeat / finish / duration_ms /
    run_id / token / leaderboard / any game-owned object.

    Heavy search runs inside a Web Worker created from this file.
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
  const allowed =
    location.protocol === 'file:' ||
    ALLOWED_HOSTS.has(host) ||
    host.endsWith('.local');

  if (BLOCKED_HOST_RE.test(host)) {
    console.error('[OrbitBot V9] Refusing to run on public 101-creations.com.');
    return;
  }

  if (!allowed) {
    console.error(
      '[OrbitBot V9] Host is not whitelisted:',
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
    console.error('[OrbitBot V9] #canvas not found.');
    return;
  }

  if (window.orbitBot?.destroy) {
    try { window.orbitBot.destroy(); } catch (_) {}
  }

  const ctx = cv.getContext('2d');

  if (!ctx) {
    console.error('[OrbitBot V9] 2D context unavailable.');
    return;
  }

  const cfg = {
    debug: true,

    // Worker planner
    workerPlanEveryMs: 28,
    workerMaxAcceptedAgeMs: 120,
    planDt: 0.050,
    laneCount: 121,
    beamWidth: 190,
    sparseFan: 16,
    denseFan: 20,
    extremeFan: 24,
    denseHazards: 12,
    extremeHazards: 20,

    // Horizon must stay below plausible arrival of an unseen new hazard.
    minHorizonSec: 1.00,
    maxHorizonSec: 1.72,
    unseenArrivalSafety: 0.83,

    // Game geometry / movement
    followRate: 12.5,
    playerHalfWidth: 24,
    playerHalfHeight: 18,
    playerEdge: 31,

    // Worker safety cost
    safetyMargin: 8,
    nearMissRadius: 112,
    nearMissCost: 78,
    moveCost: 0.0038,
    turnCost: 0.014,
    reverseCost: 0.11,
    hysteresisCost: 0.0013,

    // Powers
    chasePowers: true,
    abyRewardNoShield: 165,
    abyRewardWithShield: 2,
    shehabReward: 125,
    shieldSpendCost: 235,

    // Main-thread reflex.
    // It is intentionally tiny compared with the worker.
    guardHorizonSec: 0.34,
    guardStepSec: 0.0425,
    guardCandidates: 57,
    guardCollisionMargin: 2,
    guardTriggerClearance: 10,

    historyFrames: 240
  };

  let enabled = true;
  let destroyed = false;

  // Exact references to the objects created by the game.
  const hazardRefs = new Set();
  const powerRefs = new Set();

  let player = null;
  let targetX = null;
  let workerTargetX = null;
  let previousChosenX = null;

  let plannerMode = 'INIT';
  let lastRisk = 0;
  let lastWorkerMs = 0;
  let lastWorkerAgeMs = Infinity;
  let lastScore = 0;

  let seq = 0;
  let workerBusy = false;
  let lastWorkerSentAt = -Infinity;
  const sentAt = new Map();

  let frameMsEMA = 16.67;
  let lastCarFrameAt = null;

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
  // Exact game-object observation
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
    workerTargetX = null;
    previousChosenX = null;

    plannerMode = 'RESET';
    lastRisk = 0;
    lastWorkerMs = 0;
    lastWorkerAgeMs = Infinity;

    hypeEndAt = 0;
    lastDomHype = null;

    history.length = 0;
  }

  function observeAdded(item) {
    const type = classify(item);

    if (!type) return;

    // The game's reset() replaces the arrays outright. The first fresh hazard
    // is pushed after score has wrapped back near zero.
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

  function powerLooksCollected(p) {
    if (!player || !p) return false;

    const dx = p.x - player.x;
    const dy = p.y - player.y;

    // Real power collision radius is ~39px; tolerate one frame of movement.
    return dx * dx + dy * dy <= 48 * 48;
  }

  function observeRemoved(item) {
    if (
      powerRefs.has(item) &&
      item?.kind === 'shehab' &&
      powerLooksCollected(item)
    ) {
      // Source: applyPower() sets hypeUntil = ms + 6000.
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

  // Car body is drawn after hazards/powers have already been updated in frame().
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

    // If pasted in the middle of HYPE, remaining time is unknown.
    // Conservatively do not forecast extra future slowdown.
    if (
      lastDomHype === null &&
      dom === true &&
      hypeEndAt <= now
    ) {
      hypeEndAt = now;
    }

    lastDomHype = dom;
  }

  // ---------------------------------------------------------------------------
  // Web Worker planner
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
      const physicsRate = physicsSec / wallSec;

      const perFrameAlpha = Math.min(
        1,
        physicsSec * c.followRate
      );

      return {
        wallSec,
        physicsSec,
        physicsRate,
        perFrameAlpha
      };
    }

    function alphaAcross(dt, fm) {
      const frames = dt / fm.wallSec;

      return 1 - Math.pow(
        1 - fm.perFrameAlpha,
        frames
      );
    }

    function horizonFor(s, fm, c) {
      // Source desktop REDLINE max spawn vy is ~595px/s.
      // Convert it to actual wall-time progress using current physics rate.
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
      const relevant = s.hazards.filter(z => {
        const wallVy = Math.max(0, z.vy) * fm.physicsRate;

        return (
          z.y <= s.playerY + 125 &&
          z.y + wallVy * horizon >= s.playerY - 195
        );
      });

      const paths = relevant.map(z => {
        let x = z.x;
        let y = z.y;
        let vx = z.vx;

        const arr = new Array(steps);

        for (let k = 0; k < steps; k++) {
          const t0 = k * dt;
          const t1 = (k + 1) * dt;

          const hypeSec =
            Math.max(
              0,
              Math.min(
                t1,
                s.hypeRemainingMs / 1000
              ) - t0
            );

          const normalSec =
            dt - hypeSec;

          const physicsDt =
            dt * fm.physicsRate;

          x += vx * physicsDt;

          y += z.vy * fm.physicsRate * (
            hypeSec * 0.74 +
            normalSec
          );

          if (
            x < z.size ||
            x > s.width - z.size
          ) {
            vx *= -1;
          }

          arr[k] = {
            x,
            y,
            size: z.size
          };
        }

        return arr;
      });

      return {
        hazards: relevant,
        paths
      };
    }

    function powerRewardAt(s, c, fm, x, t) {
      if (!c.chasePowers) return 0;

      let reward = 0;

      for (const p of s.powers) {
        const py =
          p.y +
          p.vy *
          fm.physicsRate *
          t;

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
      fm,
      alpha,
      allowShield
    ) {
      const x1 =
        (1 - alpha) * st.x +
        alpha * pointerTarget;

      let risk = 0;
      const hits = new Set();

      // Two sub-samples are enough here because the main thread has a
      // higher-frequency emergency reflex for the immediate future.
      for (const q of [0.5, 1]) {
        const carX =
          q === 1
            ? x1
            : (
                st.x +
                (x1 - st.x) * 0.5
              );

        for (let h = 0; h < paths.length; h++) {
          if (h === st.spentHazard) continue;

          const end = paths[h][step];

          const start =
            step === 0
              ? hazards[h]
              : paths[h][step - 1];

          const z = {
            x:
              start.x +
              (end.x - start.x) * q,
            y:
              start.y +
              (end.y - start.y) * q,
            size: end.size
          };

          if (
            z.y < s.playerY - 175 ||
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

          const clearance =
            clearanceAt(
              carX,
              s.playerY,
              z,
              c
            );

          if (
            clearance <
            c.nearMissRadius
          ) {
            risk += (
              c.nearMissCost *
              Math.exp(
                -Math.max(0, clearance) /
                25
              ) /
              Math.max(
                0.18,
                (step + q) *
                c.planDt
              )
            ) / 2;
          }
        }
      }

      let spentHazard =
        st.spentHazard;

      let shieldCost = 0;

      if (hits.size) {
        if (
          allowShield &&
          spentHazard < 0 &&
          hits.size === 1
        ) {
          spentHazard =
            [...hits][0];

          shieldCost =
            c.shieldSpendCost;
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

      const steps = paths[0]
        ? paths[0].length
        : Math.max(
            4,
            Math.ceil(
              horizon /
              c.planDt
            )
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
            Math.max(
              1,
              maxX - minX
            ) *
            (N - 1)
          ),
          0,
          N - 1
        );

      const alpha =
        alphaAcross(
          c.planDt,
          fm
        );

      let beam = [{
        x: s.playerX,
        cost: 0,
        firstTarget: null,
        firstActualX: null,
        delta: 0,
        spentHazard: -1
      }];

      for (let step = 0; step < steps; step++) {
        const t =
          (step + 1) *
          c.planDt;

        const nextMap =
          new Map();

        for (const st of beam) {
          const center =
            nearestLane(st.x);

          const fan =
            hazards.length >= c.extremeHazards
              ? c.extremeFan
              : hazards.length >= c.denseHazards
                ? c.denseFan
                : c.sparseFan;

          const indexes =
            new Set([
              0,
              N - 1,
              center
            ]);

          for (let k = -fan; k <= fan; k++) {
            indexes.add(
              clamp(
                center + k,
                0,
                N - 1
              )
            );
          }

          // Coarse whole-road escape candidates.
          for (let i = 0; i < N; i += 12) {
            indexes.add(i);
          }

          for (const ti of indexes) {
            const pointerTarget =
              laneX(ti);

            const ev =
              transition(
                st,
                pointerTarget,
                step,
                paths,
                hazards,
                s,
                c,
                fm,
                alpha,
                allowShield
              );

            if (!ev) continue;

            const delta =
              ev.x1 - st.x;

            const reversed =
              st.delta !== 0 &&
              delta !== 0 &&
              Math.sign(st.delta) !==
              Math.sign(delta);

            let cost =
              st.cost +
              ev.risk +
              ev.shieldCost +
              Math.abs(delta) *
              c.moveCost +
              Math.abs(
                delta - st.delta
              ) *
              c.turnCost +
              (
                reversed
                  ? c.reverseCost
                  : 0
              ) -
              powerRewardAt(
                s,
                c,
                fm,
                ev.x1,
                t
              );

            if (
              Number.isFinite(
                s.previousChosenX
              )
            ) {
              cost +=
                Math.abs(
                  ev.x1 -
                  s.previousChosenX
                ) *
                c.hysteresisCost;
            }

            const lane =
              nearestLane(
                ev.x1
              );

            const key =
              lane +
              ':' +
              ev.spentHazard;

            const candidate = {
              x: ev.x1,
              cost,
              firstTarget:
                st.firstTarget == null
                  ? pointerTarget
                  : st.firstTarget,
              firstActualX:
                st.firstActualX == null
                  ? ev.x1
                  : st.firstActualX,
              delta,
              spentHazard:
                ev.spentHazard
            };

            const old =
              nextMap.get(key);

            if (
              !old ||
              candidate.cost <
              old.cost
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
              c.beamWidth
            );

        if (!beam.length) {
          return null;
        }
      }

      const best = beam[0];

      if (!best) return null;

      return {
        target:
          best.firstTarget,
        firstActualX:
          best.firstActualX,
        risk:
          best.cost,
        mode:
          allowShield &&
          best.spentHazard >= 0
            ? 'WORKER SHIELD'
            : 'WORKER EXACT'
      };
    }

    function emergency(s, c, fm, hazards, paths) {
      const minX = c.playerEdge;
      const maxX = s.width - c.playerEdge;

      let bestX = s.playerX;
      let bestScore = -Infinity;

      const samples = 121;
      const lookSteps =
        Math.min(
          paths[0]?.length || 1,
          Math.ceil(
            0.65 /
            c.planDt
          )
        );

      for (let i = 0; i < samples; i++) {
        const x =
          minX +
          (maxX - minX) *
          i /
          (samples - 1);

        let minClearance = Infinity;

        for (let h = 0; h < paths.length; h++) {
          for (let k = 0; k < lookSteps; k++) {
            const z = paths[h][k];

            if (
              z.y < s.playerY - 175 ||
              z.y > s.playerY + 110
            ) {
              continue;
            }

            minClearance = Math.min(
              minClearance,
              clearanceAt(
                x,
                s.playerY,
                z,
                c
              )
            );
          }
        }

        const score =
          minClearance -
          Math.abs(
            x - s.playerX
          ) *
          0.010;

        if (score > bestScore) {
          bestScore = score;
          bestX = x;
        }
      }

      return {
        target: bestX,
        firstActualX: bestX,
        risk: 99999,
        mode: 'WORKER EMERGENCY'
      };
    }

    self.onmessage = e => {
      const msg = e.data;

      if (
        !msg ||
        msg.type !== 'plan'
      ) {
        return;
      }

      const started =
        performance.now();

      const s = msg.snapshot;
      const c = msg.config;

      const fm =
        frameModel(
          s.frameMs,
          c
        );

      const horizon =
        horizonFor(
          s,
          fm,
          c
        );

      const steps =
        Math.max(
          4,
          Math.ceil(
            horizon /
            c.planDt
          )
        );

      const built =
        buildPaths(
          s,
          c,
          fm,
          horizon,
          steps
        );

      let plan =
        beamPass(
          s,
          c,
          fm,
          built.hazards,
          built.paths,
          horizon,
          false
        );

      if (
        !plan &&
        s.shield
      ) {
        plan =
          beamPass(
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
        plan =
          emergency(
            s,
            c,
            fm,
            built.hazards,
            built.paths
          );
      }

      self.postMessage({
        type: 'plan',
        seq: msg.seq,
        target:
          plan.target,
        firstActualX:
          plan.firstActualX,
        risk:
          plan.risk,
        mode:
          plan.mode,
        horizon,
        relevantHazards:
          built.hazards.length,
        workerMs:
          performance.now() -
          started
      });
    };
  }

  const workerSource =
    '(' +
    workerMain.toString() +
    ')();';

  const workerBlob =
    new Blob(
      [workerSource],
      {
        type:
          'text/javascript'
      }
    );

  const workerUrl =
    URL.createObjectURL(
      workerBlob
    );

  const plannerWorker =
    new Worker(
      workerUrl
    );

  setTimeout(
    () =>
      URL.revokeObjectURL(
        workerUrl
      ),
    1000
  );

  plannerWorker.onmessage = e => {
    const msg = e.data;

    if (
      !msg ||
      msg.type !== 'plan'
    ) {
      return;
    }

    workerBusy = false;

    const tSent =
      sentAt.get(
        msg.seq
      );

    sentAt.delete(
      msg.seq
    );

    const age =
      Number.isFinite(tSent)
        ? performance.now() -
          tSent
        : Infinity;

    lastWorkerMs =
      Number(
        msg.workerMs
      ) || 0;

    lastWorkerAgeMs =
      age;

    if (
      destroyed ||
      !enabled ||
      age >
        cfg.workerMaxAcceptedAgeMs
    ) {
      return;
    }

    workerTargetX =
      Number.isFinite(
        msg.target
      )
        ? msg.target
        : workerTargetX;

    previousChosenX =
      Number.isFinite(
        msg.firstActualX
      )
        ? msg.firstActualX
        : previousChosenX;

    lastRisk =
      Number.isFinite(
        msg.risk
      )
        ? msg.risk
        : 99999;

    plannerMode =
      msg.mode ||
      'WORKER';

    renderHud(
      msg.horizon
    );
  };

  plannerWorker.onerror = err => {
    workerBusy = false;
    plannerMode =
      'WORKER ERROR';

    console.error(
      '[OrbitBot V9 worker]',
      err
    );
  };

  function snapshot() {
    if (!player) return null;

    const rect =
      cv.getBoundingClientRect();

    return {
      playerX: player.x,
      playerY: player.y,
      width: rect.width,
      height: rect.height,

      frameMs:
        clamp(
          frameMsEMA,
          8,
          80
        ),

      shield:
        shieldActive(),

      hypeRemainingMs:
        hypeRemainingMs(),

      previousChosenX:
        Number.isFinite(
          previousChosenX
        )
          ? previousChosenX
          : null,

      hazards:
        [...hazardRefs]
          .map(z => ({
            x: z.x,
            y: z.y,
            vx: z.vx,
            vy: z.vy,
            size: z.size
          })),

      powers:
        [...powerRefs]
          .map(p => ({
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

    const now =
      performance.now();

    if (
      now -
      lastWorkerSentAt <
      cfg.workerPlanEveryMs
    ) {
      return;
    }

    const s =
      snapshot();

    if (!s) return;

    const id =
      ++seq;

    workerBusy = true;
    lastWorkerSentAt = now;

    sentAt.set(
      id,
      now
    );

    plannerWorker.postMessage({
      type: 'plan',
      seq: id,
      snapshot: s,
      config: cfg
    });
  }

  // ---------------------------------------------------------------------------
  // Main-thread emergency reflex
  // ---------------------------------------------------------------------------

  function frameModelMain() {
    const wallSec =
      clamp(
        frameMsEMA / 1000,
        0.008,
        0.080
      );

    const physicsSec =
      Math.min(
        0.035,
        wallSec
      );

    return {
      wallSec,
      physicsSec,
      physicsRate:
        physicsSec /
        wallSec,
      perFrameAlpha:
        Math.min(
          1,
          physicsSec *
          cfg.followRate
        )
    };
  }

  function guardAlpha(dt, fm) {
    const frames =
      dt / fm.wallSec;

    return 1 -
      Math.pow(
        1 -
        fm.perFrameAlpha,
        frames
      );
  }

  function guardCollision(px, py, z, margin) {
    const rr =
      z.size * 0.76 +
      margin;

    const cx =
      Math.max(
        px -
        cfg.playerHalfWidth,
        Math.min(
          z.x,
          px +
          cfg.playerHalfWidth
        )
      );

    const cy =
      Math.max(
        py -
        cfg.playerHalfHeight,
        Math.min(
          z.y,
          py +
          cfg.playerHalfHeight
        )
      );

    const dx =
      z.x - cx;

    const dy =
      z.y - cy;

    return (
      dx * dx +
      dy * dy <=
      rr * rr
    );
  }

  function guardClearance(px, py, z) {
    const rr =
      z.size * 0.76 +
      cfg.guardCollisionMargin;

    const dx =
      Math.max(
        0,
        Math.abs(
          z.x - px
        ) -
        cfg.playerHalfWidth
      );

    const dy =
      Math.max(
        0,
        Math.abs(
          z.y - py
        ) -
        cfg.playerHalfHeight
      );

    return (
      Math.sqrt(
        dx * dx +
        dy * dy
      ) -
      rr
    );
  }

  function guardPaths() {
    const fm =
      frameModelMain();

    const dt =
      cfg.guardStepSec;

    const steps =
      Math.ceil(
        cfg.guardHorizonSec /
        dt
      );

    const width =
      cv.getBoundingClientRect().width;

    const now =
      performance.now();

    const hazards =
      [...hazardRefs]
        .filter(z =>
          z.y <= player.y + 100 &&
          z.y +
          z.vy *
          fm.physicsRate *
          cfg.guardHorizonSec >=
          player.y - 150
        );

    const paths =
      hazards.map(z => {
        let x = z.x;
        let y = z.y;
        let vx = z.vx;

        const arr =
          new Array(
            steps
          );

        for (
          let s = 0;
          s < steps;
          s++
        ) {
          const t0 =
            s * dt;

          const t1 =
            (s + 1) *
            dt;

          const hypeSec =
            Math.max(
              0,
              Math.min(
                t1,
                hypeRemainingMs(
                  now
                ) /
                1000
              ) -
              t0
            );

          const normalSec =
            dt -
            hypeSec;

          const physicsDt =
            dt *
            fm.physicsRate;

          x +=
            vx *
            physicsDt;

          y +=
            z.vy *
            fm.physicsRate *
            (
              hypeSec *
              0.74 +
              normalSec
            );

          if (
            x < z.size ||
            x >
            width -
            z.size
          ) {
            vx *= -1;
          }

          arr[s] = {
            x,
            y,
            size: z.size
          };
        }

        return arr;
      });

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
    const alpha =
      guardAlpha(
        gp.dt,
        gp.fm
      );

    let carX =
      player.x;

    let minClearance =
      Infinity;

    const collided =
      new Set();

    for (
      let s = 0;
      s < gp.steps;
      s++
    ) {
      carX =
        (1 - alpha) *
        carX +
        alpha *
        pointerTarget;

      for (
        let h = 0;
        h < gp.paths.length;
        h++
      ) {
        const z =
          gp.paths[h][s];

        if (
          z.y <
            player.y - 150 ||
          z.y >
            player.y + 90
        ) {
          continue;
        }

        if (
          guardCollision(
            carX,
            player.y,
            z,
            cfg.guardCollisionMargin
          )
        ) {
          collided.add(h);
          continue;
        }

        minClearance =
          Math.min(
            minClearance,
            guardClearance(
              carX,
              player.y,
              z
            )
          );
      }
    }

    return {
      collided,
      minClearance,
      finalX: carX
    };
  }

  function guardTarget(baseTarget) {
    if (!player) {
      return {
        target: baseTarget,
        overridden: false
      };
    }

    const rect =
      cv.getBoundingClientRect();

    const minX =
      cfg.playerEdge;

    const maxX =
      rect.width -
      cfg.playerEdge;

    const safeBase =
      clamp(
        Number.isFinite(
          baseTarget
        )
          ? baseTarget
          : player.x,
        minX,
        maxX
      );

    const gp =
      guardPaths();

    const baseEval =
      evaluateGuardTarget(
        safeBase,
        gp
      );

    if (
      baseEval.collided.size === 0 &&
      baseEval.minClearance >
        cfg.guardTriggerClearance
    ) {
      return {
        target: safeBase,
        overridden: false
      };
    }

    let best = null;

    for (
      let i = 0;
      i <
      cfg.guardCandidates;
      i++
    ) {
      const x =
        minX +
        (maxX - minX) *
        i /
        (
          cfg.guardCandidates -
          1
        );

      const ev =
        evaluateGuardTarget(
          x,
          gp
        );

      // Prefer zero-hit paths.
      const hitCount =
        ev.collided.size;

      const legalByShield =
        shieldActive() &&
        hitCount === 1;

      if (
        hitCount > 0 &&
        !legalByShield
      ) {
        continue;
      }

      const shieldPenalty =
        hitCount === 1
          ? 1000
          : 0;

      const score =
        ev.minClearance -
        Math.abs(
          x -
          player.x
        ) *
        0.012 -
        shieldPenalty;

      if (
        !best ||
        score >
        best.score
      ) {
        best = {
          target: x,
          score,
          hitCount
        };
      }
    }

    if (!best) {
      return {
        target: safeBase,
        overridden: false
      };
    }

    return {
      target:
        best.target,
      overridden: true,
      shieldPath:
        best.hitCount === 1
    };
  }

  // ---------------------------------------------------------------------------
  // Steering
  // ---------------------------------------------------------------------------

  function dispatchTarget(x) {
    if (
      !player ||
      !Number.isFinite(x)
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
              x,
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

  function onCarFrame() {
    const now =
      performance.now();

    if (
      lastCarFrameAt != null
    ) {
      const dt =
        now -
        lastCarFrameAt;

      if (
        dt > 3 &&
        dt < 200
      ) {
        frameMsEMA =
          frameMsEMA *
          0.88 +
          dt *
          0.12;
      }
    }

    lastCarFrameAt = now;

    const score =
      currentScore();

    if (
      lastScore > 50 &&
      score <= 5
    ) {
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

    const guarded =
      guardTarget(
        workerTargetX
      );

    targetX =
      guarded.target;

    if (
      guarded.overridden
    ) {
      plannerMode =
        guarded.shieldPath
          ? 'FRAME SHIELD REFLEX'
          : 'FRAME SAFETY REFLEX';
    }

    dispatchTarget(
      targetX
    );

    history.push({
      t: now,
      score,
      carX:
        Math.round(
          player.x
        ),
      targetX:
        Number.isFinite(
          targetX
        )
          ? Math.round(
              targetX
            )
          : null,
      workerTargetX:
        Number.isFinite(
          workerTargetX
        )
          ? Math.round(
              workerTargetX
            )
          : null,
      hazards:
        hazardRefs.size,
      powers:
        powerRefs.size,
      mode:
        plannerMode,
      risk:
        Math.round(
          lastRisk
        ),
      shield:
        shieldActive(),
      hypeRemainingMs:
        Math.round(
          hypeRemainingMs()
        ),
      frameMs:
        Math.round(
          frameMsEMA *
          10
        ) / 10,
      fps:
        Math.round(
          1000 /
          Math.max(
            1,
            frameMsEMA
          )
        ),
      workerMs:
        Math.round(
          lastWorkerMs *
          10
        ) / 10,
      workerAgeMs:
        Math.round(
          lastWorkerAgeMs *
          10
        ) / 10
    });

    while (
      history.length >
      cfg.historyFrames
    ) {
      history.shift();
    }

    renderHud();
  }

  function renderHud(horizon = null) {
    if (!cfg.debug) return;

    const fps =
      1000 /
      Math.max(
        1,
        frameMsEMA
      );

    hud.textContent =
      'ORBIT BOT V9 · 20K CANDIDATE\n' +
      'state: ' +
      (enabled ? 'ON' : 'OFF') +
      '\nmode: ' +
      plannerMode +
      '\nhazards: ' +
      hazardRefs.size +
      ' · powers: ' +
      powerRefs.size +
      '\ncar: ' +
      (
        player
          ? Math.round(
              player.x
            )
          : '-'
      ) +
      ' → ' +
      (
        Number.isFinite(
          targetX
        )
          ? Math.round(
              targetX
            )
          : '-'
      ) +
      '\nfps: ' +
      fps.toFixed(1) +
      ' · frame: ' +
      frameMsEMA.toFixed(1) +
      'ms' +
      '\nworker: ' +
      lastWorkerMs.toFixed(1) +
      'ms · age: ' +
      (
        Number.isFinite(
          lastWorkerAgeMs
        )
          ? lastWorkerAgeMs.toFixed(1)
          : '-'
      ) +
      'ms' +
      '\nrisk: ' +
      Math.round(
        lastRisk
      ) +
      (
        Number.isFinite(
          horizon
        )
          ? '\nlook: ' +
            horizon.toFixed(2) +
            's'
          : ''
      ) +
      '\nshield: ' +
      (
        shieldActive()
          ? 'YES'
          : 'NO'
      ) +
      ' · hype left: ' +
      (
        hypeRemainingMs() /
        1000
      ).toFixed(2) +
      's' +
      '\nF8 = toggle';
  }

  // ---------------------------------------------------------------------------
  // Lifecycle / diagnostics
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

    console.log(
      '[OrbitBot V9] destroyed.'
    );
  }

  window.addEventListener(
    'keydown',
    keyHandler,
    true
  );

  window.orbitBot = {
    version: 9,

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
        version: 9,
        enabled,
        host,
        score:
          currentScore(),
        plannerMode,
        frameMs:
          frameMsEMA,
        fps:
          1000 /
          Math.max(
            1,
            frameMsEMA
          ),
        workerMs:
          lastWorkerMs,
        workerAgeMs:
          lastWorkerAgeMs,
        risk:
          lastRisk,
        player,
        targetX,
        workerTargetX,
        shield:
          shieldActive(),
        hypeRemainingMs:
          hypeRemainingMs(),
        hazards:
          [...hazardRefs]
            .map(z => ({
              x:
                Math.round(z.x),
              y:
                Math.round(z.y),
              vx:
                Math.round(z.vx),
              vy:
                Math.round(z.vy),
              size:
                Math.round(z.size)
            })),
        powers:
          [...powerRefs]
            .map(p => ({
              kind:
                p.kind,
              x:
                Math.round(p.x),
              y:
                Math.round(p.y),
              vy:
                Math.round(p.vy)
            })),
        config: {
          ...cfg
        }
      };
    },

    lastFrames(n = 80) {
      return history.slice(
        -Math.max(
          1,
          n
        )
      );
    },

    performanceSummary() {
      const rows =
        history.slice(-120);

      if (!rows.length) {
        return null;
      }

      const avg = key =>
        rows.reduce(
          (sum, r) =>
            sum +
            (
              Number(r[key]) ||
              0
            ),
          0
        ) /
        rows.length;

      return {
        score:
          currentScore(),
        avgFps:
          avg('fps'),
        avgFrameMs:
          avg('frameMs'),
        avgWorkerMs:
          avg('workerMs'),
        maxWorkerMs:
          Math.max(
            ...rows.map(
              r =>
                Number(
                  r.workerMs
                ) || 0
            )
          ),
        maxHazards:
          Math.max(
            ...rows.map(
              r =>
                Number(
                  r.hazards
                ) || 0
            )
          )
      };
    },

    config: cfg
  };

  renderHud();

  console.log(
    '[OrbitBot V9] loaded.',
    '\n20K CANDIDATE — pure autoplayer, game rules untouched.',
    '\nHeavy exact-state search is off the game main thread.',
    '\nFrame safety reflex is active.',
    '\nHost:', host || '(file://)',
    '\nF8 toggles.'
  );
})();