(() => {
  'use strict';

  /*
    Orbit Rush Autoplayer V7 — PRIVATE / LOCAL COPY ONLY
    ====================================================
    PURE AUTOPLAYER. Game rules remain untouched.

    V7 fixes the concrete failure exposed by the V6 death log:
    1) HYPE expiry is forecast inside the planning horizon instead of treating
       the current HYPE state as if it lasted for the whole horizon.
    2) Shield is modeled as one legal hit that removes exactly one hazard.
    3) Planner is rewritten from expensive beam-with-hazard-checks to a
       precomputed hazard grid + dynamic programming, greatly reducing stalls.
    4) Planning runs on every rendered game frame without relying on a guessed
       CSS "isPlaying" state.
    5) Death history now logs HYPE time remaining and planner execution time.

    It ONLY reads game-created hazard/power objects and sends pointermove.
    It does NOT change score, collision logic, hazards, powers, speed, spawn,
    shield/HYPE behavior, API, run_id, token, duration_ms or leaderboard.
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
    console.error('[OrbitBot V7] Refusing to run on public 101-creations.com.');
    return;
  }

  if (!allowed) {
    console.error(
      '[OrbitBot V7] Host is not whitelisted:',
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
    console.error('[OrbitBot V7] #canvas not found.');
    return;
  }

  if (window.orbitBot?.destroy) {
    try { window.orbitBot.destroy(); } catch (_) {}
  }

  const ctx = cv.getContext('2d');

  if (!ctx) {
    console.error('[OrbitBot V7] 2D context unavailable.');
    return;
  }

  const cfg = {
    debug: true,

    // Discretization
    dt: 0.050,
    laneCount: 101,

    // Replan frequently, but now the planner is much cheaper than V6.
    replanEveryMs: 12,

    // Game car model
    followRate: 12.5,
    playerHalfWidth: 24,
    playerHalfHeight: 18,
    playerEdge: 31,

    // Safety model
    safetyMargin: 10,
    nearMissRadius: 125,
    nearMissCost: 92,

    // DP costs
    moveCost: 0.0032,
    priorTargetCost: 0.0011,
    edgeCost: 7.0,

    // Power attraction
    chasePowers: true,
    abyRewardNoShield: 150,
    abyRewardWithShield: 4,
    shehabReward: 115,

    // Use shield only if the no-hit DP cannot find a legal route.
    shieldSpendCost: 190,
    shieldRescueBeam: 520,

    // Horizon: never pretend we can know hazards that have not spawned.
    minHorizonSec: 1.10,
    maxHorizonSec: 2.25,
    unseenArrivalSafety: 0.86,

    // Emergency fallback
    emergencySamples: 181,
    emergencyLookSec: 0.85,

    historyFrames: 180
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
  let lastPlannerMs = 0;
  let lastScore = 0;

  // Exact wall-clock estimate of the game's hypeUntil.
  // We detect Shehab pickup from the actual power object being removed at car.
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

    // Hazard from the supplied game:
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

    // Power:
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

  function looksLikePickup(p) {
    if (!player || !p) return false;

    // Game circleHit(player,power,-5):
    // player fallback radius=16, power radius=28 => ~39px.
    // Add a small one-frame tracking tolerance.
    const dx = p.x - player.x;
    const dy = p.y - player.y;

    return dx * dx + dy * dy <= 47 * 47;
  }

  function observeRemoved(item) {
    const wasPower = powerRefs.has(item);

    if (
      wasPower &&
      item.kind === 'shehab' &&
      looksLikePickup(item)
    ) {
      // The real game sets hypeUntil = ms + 6000.
      hypeEndAt = performance.now() + 6000;
    }

    hazardRefs.delete(item);
    powerRefs.delete(item);
  }

  // ---------------------------------------------------------------------------
  // Passive exact-object observation
  // ---------------------------------------------------------------------------

  Array.prototype.push = function(...items) {
    for (const item of items) {
      try { observeAdded(item); } catch (_) {}
    }

    return original.arrayPush.apply(this, items);
  };

  Array.prototype.splice = function(...args) {
    const removed =
      original.arraySplice.apply(this, args);

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

  // Car is rendered after all hazards/powers have been updated in frame().
  // This therefore gives us a clean exact-state planning point.
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
        onRenderedGameFrame();
      }
    }

    return original.stroke.apply(this, arguments);
  };

  // ---------------------------------------------------------------------------
  // Run / UI helpers
  // ---------------------------------------------------------------------------

  function currentScore() {
    const el =
      document.querySelector('#score');

    if (!el) return 0;

    const n =
      Number(
        String(el.textContent || '')
          .replace(/[^\d]/g, '')
      );

    return Number.isFinite(n) ? n : 0;
  }

  function resetObservedRun() {
    hazardRefs.clear();
    powerRefs.clear();

    targetX = null;
    previousChosenX = null;

    plannerMode = 'RESET';
    lastRisk = 0;
    lastPlannerMs = 0;

    hypeEndAt = 0;
    lastDomHype = null;

    history.length = 0;
  }

  function cleanupRefs() {
    const h =
      cv.getBoundingClientRect().height;

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

    // If V7 itself saw the Shehab pickup, hypeEndAt is exact enough.
    // Fallback only handles a fresh on-transition we somehow missed.
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

    // If bot was pasted mid-HYPE, do NOT assume another 6 seconds.
    // Treat unknown remaining duration conservatively as no future HYPE.
    if (
      lastDomHype === null &&
      dom &&
      hypeEndAt <= now
    ) {
      hypeEndAt = now;
    }

    lastDomHype = dom;
  }

  // ---------------------------------------------------------------------------
  // Physics model
  // ---------------------------------------------------------------------------

  function alphaFor(dt) {
    return 1 -
      Math.exp(
        -cfg.followRate * dt
      );
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
      Math.sqrt(
        dx * dx +
        dy * dy
      ) -
      rr
    );
  }

  function dynamicHorizon() {
    if (!player) {
      return cfg.minHorizonSec;
    }

    // Desktop REDLINE maximum spawn vy from source:
    // 120 + 5*56 + random(75+5*24) = up to ~595 px/s.
    // Use 620 for a conservative unseen-hazard bound.
    const fastestUnseenVy = 620;

    // Spawn y is around -2*size.
    const earliestUnseenArrival =
      (player.y + 45) /
      fastestUnseenVy;

    return clamp(
      earliestUnseenArrival *
        cfg.unseenArrivalSafety,
      cfg.minHorizonSec,
      cfg.maxHorizonSec
    );
  }

  function buildForecast(
    hazards,
    steps,
    dt,
    width,
    wallNow
  ) {
    return hazards.map(z => {
      let x = z.x;
      let y = z.y;
      let vx = z.vx;

      const out =
        new Array(steps);

      for (let s = 0; s < steps; s++) {
        const futureWall =
          wallNow +
          (s + 1) *
          dt *
          1000;

        // Critical V6 fix:
        // HYPE multiplier applies only until the real 6-second expiry.
        const hypeMult =
          futureWall <
          hypeEndAt
            ? 0.74
            : 1;

        x += vx * dt;
        y += z.vy * dt * hypeMult;

        // Mirror the game's actual bounce.
        if (
          x < z.size ||
          x > width - z.size
        ) {
          vx *= -1;
        }

        out[s] = {
          x,
          y,
          size: z.size
        };
      }

      return out;
    });
  }

  // ---------------------------------------------------------------------------
  // Precomputed lane/time safety grid
  // ---------------------------------------------------------------------------

  function buildGrid() {
    if (!player) return null;

    const rect =
      cv.getBoundingClientRect();

    const width = rect.width;
    const py = player.y;

    const minX =
      cfg.playerEdge;

    const maxX =
      width -
      cfg.playerEdge;

    const N =
      cfg.laneCount;

    const lanes =
      Array.from(
        { length: N },
        (_, i) =>
          minX +
          (maxX - minX) *
          i /
          (N - 1)
      );

    const horizon =
      dynamicHorizon();

    const dt =
      cfg.dt;

    const steps =
      Math.max(
        5,
        Math.ceil(
          horizon / dt
        )
      );

    const wallNow =
      performance.now();

    const hazards =
      [...hazardRefs];

    const forecast =
      buildForecast(
        hazards,
        steps,
        dt,
        width,
        wallNow
      );

    const risk =
      Array.from(
        { length: steps },
        () =>
          new Float64Array(N)
      );

    const colliders =
      Array.from(
        { length: steps },
        () =>
          Array(N).fill(null)
      );

    for (let s = 0; s < steps; s++) {
      const t =
        (s + 1) * dt;

      for (let i = 0; i < N; i++) {
        const x =
          lanes[i];

        let r = 0;
        let hits = null;

        for (
          let h = 0;
          h < forecast.length;
          h++
        ) {
          const z =
            forecast[h][s];

          if (
            z.y < py - 175 ||
            z.y > py + 110
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
            if (!hits) hits = [];
            hits.push(h);
            continue;
          }

          const c =
            clearanceAt(
              x,
              py,
              z
            );

          if (
            c <
            cfg.nearMissRadius
          ) {
            r +=
              cfg.nearMissCost *
              Math.exp(
                -Math.max(0, c) /
                26
              ) /
              Math.max(
                0.20,
                t
              );
          }
        }

        // Mild edge penalty so the bot does not camp against a wall
        // unless that wall really is the best corridor.
        const edgeDist =
          Math.min(
            x - minX + 12,
            maxX - x + 12
          );

        r +=
          cfg.edgeCost /
          Math.max(
            12,
            edgeDist
          );

        risk[s][i] = r;
        colliders[s][i] = hits;
      }
    }

    // One-time power reward at the predicted crossing step.
    if (cfg.chasePowers) {
      const shield =
        shieldActive();

      for (const p of powerRefs) {
        const rawStep =
          Math.round(
            (
              player.y -
              p.y
            ) /
            Math.max(
              1,
              p.vy *
              dt
            )
          ) - 1;

        const s =
          clamp(
            rawStep,
            0,
            steps - 1
          );

        const predictedY =
          p.y +
          p.vy *
          (s + 1) *
          dt;

        if (
          Math.abs(
            predictedY -
            player.y
          ) >
          52
        ) {
          continue;
        }

        const reward =
          p.kind === 'aby'
            ? (
                shield
                  ? cfg.abyRewardWithShield
                  : cfg.abyRewardNoShield
              )
            : cfg.shehabReward;

        for (
          let i = 0;
          i < N;
          i++
        ) {
          const dx =
            Math.abs(
              lanes[i] -
              p.x
            );

          if (dx <= 46) {
            risk[s][i] -=
              reward *
              (
                1 -
                dx / 54
              );
          }
        }
      }
    }

    return {
      rect,
      width,
      py,
      minX,
      maxX,
      N,
      lanes,
      horizon,
      dt,
      steps,
      hazards,
      forecast,
      risk,
      colliders
    };
  }

  function nearestLane(grid, x) {
    return clamp(
      Math.round(
        (
          x -
          grid.minX
        ) /
        Math.max(
          1,
          grid.maxX -
          grid.minX
        ) *
        (grid.N - 1)
      ),
      0,
      grid.N - 1
    );
  }

  function pointerForMove(
    fromX,
    toX,
    grid
  ) {
    const a =
      alphaFor(
        grid.dt
      );

    return (
      toX -
      (1 - a) *
      fromX
    ) /
    Math.max(
      0.001,
      a
    );
  }

  function reachableRange(
    grid,
    fromX
  ) {
    const a =
      alphaFor(
        grid.dt
      );

    const loX =
      (1 - a) *
      fromX +
      a *
      grid.minX;

    const hiX =
      (1 - a) *
      fromX +
      a *
      grid.maxX;

    return {
      lo:
        nearestLane(
          grid,
          loX
        ),
      hi:
        nearestLane(
          grid,
          hiX
        )
    };
  }

  // ---------------------------------------------------------------------------
  // Fast no-hit dynamic programming
  // ---------------------------------------------------------------------------

  function normalDP(grid) {
    const N = grid.N;
    const S = grid.steps;

    let prev =
      new Float64Array(N);

    prev.fill(Infinity);

    const parents =
      Array.from(
        { length: S },
        () => {
          const a =
            new Int16Array(N);

          a.fill(-1);
          return a;
        }
      );

    // Step 0 directly from current real car x.
    const firstReach =
      reachableRange(
        grid,
        player.x
      );

    for (
      let j = firstReach.lo;
      j <= firstReach.hi;
      j++
    ) {
      if (
        grid.colliders[0][j]?.length
      ) {
        continue;
      }

      const xj =
        grid.lanes[j];

      const pointer =
        pointerForMove(
          player.x,
          xj,
          grid
        );

      if (
        pointer <
          grid.minX - 0.01 ||
        pointer >
          grid.maxX + 0.01
      ) {
        continue;
      }

      let c =
        grid.risk[0][j] +
        Math.abs(
          xj -
          player.x
        ) *
        cfg.moveCost;

      if (
        previousChosenX != null
      ) {
        c +=
          Math.abs(
            xj -
            previousChosenX
          ) *
          cfg.priorTargetCost;
      }

      prev[j] = c;
      parents[0][j] = -2;
    }

    for (
      let s = 1;
      s < S;
      s++
    ) {
      const next =
        new Float64Array(N);

      next.fill(Infinity);

      for (
        let i = 0;
        i < N;
        i++
      ) {
        const base =
          prev[i];

        if (
          !Number.isFinite(base)
        ) {
          continue;
        }

        const xi =
          grid.lanes[i];

        const range =
          reachableRange(
            grid,
            xi
          );

        for (
          let j = range.lo;
          j <= range.hi;
          j++
        ) {
          if (
            grid.colliders[s][j]?.length
          ) {
            continue;
          }

          const xj =
            grid.lanes[j];

          const pointer =
            pointerForMove(
              xi,
              xj,
              grid
            );

          if (
            pointer <
              grid.minX - 0.01 ||
            pointer >
              grid.maxX + 0.01
          ) {
            continue;
          }

          const c =
            base +
            grid.risk[s][j] +
            Math.abs(
              xj -
              xi
            ) *
            cfg.moveCost;

          if (c < next[j]) {
            next[j] = c;
            parents[s][j] = i;
          }
        }
      }

      prev = next;
    }

    let bestLane = -1;
    let bestCost = Infinity;

    for (
      let i = 0;
      i < N;
      i++
    ) {
      if (prev[i] < bestCost) {
        bestCost = prev[i];
        bestLane = i;
      }
    }

    if (bestLane < 0) {
      return null;
    }

    let firstLane =
      bestLane;

    for (
      let s = S - 1;
      s >= 1;
      s--
    ) {
      const p =
        parents[s][firstLane];

      if (p < 0) {
        break;
      }

      firstLane = p;
    }

    const firstX =
      grid.lanes[firstLane];

    return {
      mode: 'FAST EXACT DP',
      firstX,
      target:
        clamp(
          pointerForMove(
            player.x,
            firstX,
            grid
          ),
          grid.minX,
          grid.maxX
        ),
      risk: bestCost,
      usedShield: false
    };
  }

  // ---------------------------------------------------------------------------
  // Shield rescue
  // ---------------------------------------------------------------------------

  function shieldRescueDP(grid) {
    if (!shieldActive()) {
      return null;
    }

    // State key = lane:consumedHazard
    // consumedHazard=-1 means shield still unused.
    let states = [{
      lane:
        nearestLane(
          grid,
          player.x
        ),
      x: player.x,
      consumed: -1,
      cost: 0,
      firstX: null
    }];

    for (
      let s = 0;
      s < grid.steps;
      s++
    ) {
      const nextMap =
        new Map();

      for (const st of states) {
        const range =
          reachableRange(
            grid,
            st.x
          );

        for (
          let j = range.lo;
          j <= range.hi;
          j++
        ) {
          const xj =
            grid.lanes[j];

          const pointer =
            pointerForMove(
              st.x,
              xj,
              grid
            );

          if (
            pointer <
              grid.minX - 0.01 ||
            pointer >
              grid.maxX + 0.01
          ) {
            continue;
          }

          const rawHits =
            grid.colliders[s][j] ||
            [];

          const hits =
            st.consumed < 0
              ? rawHits
              : rawHits.filter(
                  h =>
                    h !==
                    st.consumed
                );

          let consumed =
            st.consumed;

          let shieldCost = 0;

          if (hits.length) {
            // Only one actual hazard may consume the shield.
            // Any second distinct collision would kill the run.
            if (
              consumed >= 0 ||
              hits.length !== 1
            ) {
              continue;
            }

            consumed = hits[0];
            shieldCost =
              cfg.shieldSpendCost;
          }

          const cost =
            st.cost +
            grid.risk[s][j] +
            Math.abs(
              xj -
              st.x
            ) *
            cfg.moveCost +
            shieldCost;

          const key =
            j + ':' + consumed;

          const candidate = {
            lane: j,
            x: xj,
            consumed,
            cost,
            firstX:
              st.firstX == null
                ? xj
                : st.firstX
          };

          const old =
            nextMap.get(key);

          if (
            !old ||
            cost < old.cost
          ) {
            nextMap.set(
              key,
              candidate
            );
          }
        }
      }

      states =
        [...nextMap.values()]
          .sort(
            (a, b) =>
              a.cost -
              b.cost
          )
          .slice(
            0,
            cfg.shieldRescueBeam
          );

      if (!states.length) {
        return null;
      }
    }

    const best =
      states[0];

    if (!best) return null;

    return {
      mode:
        best.consumed >= 0
          ? 'SHIELD RESCUE'
          : 'SHIELD SAFE',
      firstX:
        best.firstX,
      target:
        clamp(
          pointerForMove(
            player.x,
            best.firstX,
            grid
          ),
          grid.minX,
          grid.maxX
        ),
      risk: best.cost,
      usedShield:
        best.consumed >= 0
    };
  }

  // ---------------------------------------------------------------------------
  // Emergency fallback
  // ---------------------------------------------------------------------------

  function emergencyPlan(grid) {
    let bestX =
      player.x;

    let bestScore =
      -Infinity;

    const lookSteps =
      Math.max(
        1,
        Math.min(
          grid.steps,
          Math.ceil(
            cfg.emergencyLookSec /
            grid.dt
          )
        )
      );

    for (
      let q = 0;
      q < cfg.emergencySamples;
      q++
    ) {
      const x =
        grid.minX +
        (
          grid.maxX -
          grid.minX
        ) *
        q /
        (
          cfg.emergencySamples -
          1
        );

      let worst =
        Infinity;

      for (
        let h = 0;
        h < grid.forecast.length;
        h++
      ) {
        for (
          let s = 0;
          s < lookSteps;
          s++
        ) {
          const z =
            grid.forecast[h][s];

          if (
            z.y <
              grid.py - 180 ||
            z.y >
              grid.py + 110
          ) {
            continue;
          }

          worst =
            Math.min(
              worst,
              clearanceAt(
                x,
                grid.py,
                z
              )
            );
        }
      }

      const score =
        worst -
        Math.abs(
          x -
          player.x
        ) *
        0.010;

      if (score > bestScore) {
        bestScore = score;
        bestX = x;
      }
    }

    return {
      mode: 'EMERGENCY',
      firstX: bestX,
      target: bestX,
      risk: 99999,
      usedShield: false
    };
  }

  // ---------------------------------------------------------------------------
  // Plan / steer
  // ---------------------------------------------------------------------------

  function makePlan() {
    const started =
      performance.now();

    const grid =
      buildGrid();

    if (!grid) {
      return null;
    }

    let plan =
      normalDP(grid);

    if (!plan) {
      plan =
        shieldRescueDP(grid);
    }

    if (!plan) {
      plan =
        emergencyPlan(grid);
    }

    lastPlannerMs =
      performance.now() -
      started;

    plan.horizon =
      grid.horizon;

    return plan;
  }

  function steer() {
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

  function planAndSteer() {
    const plan =
      makePlan();

    if (!plan) return;

    plannerMode =
      plan.mode;

    lastRisk =
      Number.isFinite(
        plan.risk
      )
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

    previousChosenX =
      plan.firstX;

    steer();

    history.push({
      t: performance.now(),
      score: currentScore(),
      carX:
        player
          ? Math.round(player.x)
          : null,
      targetX:
        targetX == null
          ? null
          : Math.round(targetX),
      hazards:
        hazardRefs.size,
      powers:
        powerRefs.size,
      risk:
        Math.round(lastRisk),
      mode:
        plannerMode,
      shield:
        shieldActive(),
      hypeRemainingMs:
        Math.round(
          hypeRemainingMs()
        ),
      plannerMs:
        Math.round(
          lastPlannerMs *
          10
        ) / 10
    });

    while (
      history.length >
      cfg.historyFrames
    ) {
      history.shift();
    }

    renderHud(
      plan.horizon
    );
  }

  function onRenderedGameFrame() {
    const score =
      currentScore();

    // New-run reset; unlike V6 we do not gate planning on guessed CSS state.
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
      renderHud(
        dynamicHorizon()
      );
      return;
    }

    const now =
      performance.now();

    if (
      now -
      (
        history.length
          ? history[
              history.length - 1
            ].t
          : -Infinity
      ) >=
      cfg.replanEveryMs
    ) {
      planAndSteer();
    } else {
      steer();
    }
  }

  function renderHud(
    horizon =
      dynamicHorizon()
  ) {
    if (!cfg.debug) return;

    hud.textContent =
      'ORBIT BOT V7: ' +
      (
        enabled
          ? 'ON'
          : 'OFF'
      ) +
      '\nplanner: ' +
      plannerMode +
      '\nhazards exact: ' +
      hazardRefs.size +
      '\npowers exact: ' +
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
        targetX == null
          ? '-'
          : Math.round(
              targetX
            )
      ) +
      '\nrisk: ' +
      Math.round(
        lastRisk
      ) +
      '\nhorizon: ' +
      Number(
        horizon || 0
      ).toFixed(2) +
      's' +
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
      '\nplanner: ' +
      lastPlannerMs.toFixed(1) +
      'ms' +
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
      '[OrbitBot V7] destroyed.'
    );
  }

  window.addEventListener(
    'keydown',
    keyHandler,
    true
  );

  window.orbitBot = {
    version: 7,

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
        version: 7,
        enabled,
        host,
        score:
          currentScore(),
        plannerMode,
        risk:
          lastRisk,
        plannerMs:
          lastPlannerMs,
        player,
        targetX,
        shield:
          shieldActive(),
        hypeRemainingMs:
          hypeRemainingMs(),
        horizon:
          dynamicHorizon(),

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
              kind: p.kind,
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

    lastFrames(n = 40) {
      return history.slice(
        -Math.max(
          1,
          n
        )
      );
    },

    config: cfg
  };

  renderHud();

  console.log(
    '[OrbitBot V7] loaded.',
    '\nPURE AUTOPLAYER — game rules untouched.',
    '\nV6 log fixes: HYPE-expiry forecast + shield-rescue + fast DP.',
    '\nHost:', host || '(file://)',
    '\nF8 toggles.'
  );
})();