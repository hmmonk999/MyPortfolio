/* ==========================================================================
   The reports demo's data
   --------------------------------------------------------------------------
   Everything the rebuilt report shows is computed here, from the matches
   the coach has selected and the filters over them. Nothing in the markup
   is a number that stays put: the tables, the two court cards and the
   trends chart are all views of one aggregation, so picking a different
   set of matches changes every one of them at once.

   Why generate rather than hard-code seventeen matches of data: the real
   export is a season of one school's scouting and isn't mine to publish.
   So the season is generated from per-set rates taken off the match the
   case study screenshots — each athlete's attempts per set and the rates
   she converts them at — modulated by the one real number each match
   carries in the markup: its side-out percentage (data-sideout on the
   tile, which is also what the trends chart plots). A match the team
   sided out 55% of the time comes out of here hitting better and passing
   cleaner than one they sided out 40% of, because that is what those two
   numbers mean.

   Two properties are worth the code they cost:

   1. It is seeded. Match 3 generates the same numbers on every load, so
      the demo is stable to look at and to screenshot.
   2. It totals. Every count is dealt out to (set, rotation) cells by
      largest-remainder apportionment, so the parts sum to the whole no
      matter how the report is sliced: the athlete table's FHS row and the
      team table's FHS row are the same number because they are the same
      sum, and side-out per rotation adds back up to the match's own
      side-out to the last rally.

   That second property is the whole reason the filters can be real. A
   "set 2 only" filter isn't a scale factor over a season total — it drops
   every cell that isn't set 2 and adds up what is left.
   ========================================================================== */

(() => {
  "use strict";

  const demo = document.querySelector("[data-report-demo]");
  if (!demo) return;

  /* ---------- Small numeric helpers ---------- */

  /* mulberry32, seeded — so a match always reads the same. */
  function rng(seed) {
    let t = seed >>> 0;
    return () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Deal `total` whole events out over weighted slots, optionally with a
     ceiling on each — the piece that makes the parts sum to the whole.

     Floors first, then the remainder one at a time by largest fractional
     part: ordinary largest-remainder apportionment. The caps are what
     keep a cell honest — a rally can't be a kill in a cell that recorded
     no attack, and a rotation can't win more side-outs than it received
     serves in. When a cap blocks a slot the event moves to the next one
     rather than being dropped, so the total still lands. */
  function spread(total, weights, caps) {
    const out = weights.map(() => 0);
    const whole = Math.max(0, Math.round(total));
    if (!whole) return out;

    const cap = (i) => (caps ? caps[i] : Infinity);
    const open = weights
      .map((weight, i) => i)
      .filter((i) => weights[i] > 0 && cap(i) > 0);
    if (!open.length) return out;

    // Every slot's share is measured against the same total. Measuring it
    // against what is left as you go — which is the shape this wants to
    // be written in — quietly pays the first slots and starves the last:
    // a distribution of 8/26/22/34/6/4 came out 13/30/20/24/7/7, front
    // loaded, and every percentage on the setter card was wrong by it.
    const sum = open.reduce((acc, i) => acc + weights[i], 0);
    const ideal = {};
    let placed = 0;
    open.forEach((i) => {
      ideal[i] = (whole * weights[i]) / sum;
      out[i] = Math.min(Math.floor(ideal[i]), cap(i));
      placed += out[i];
    });
    let left = whole - placed;

    const byRemainder = open
      .slice()
      .sort((a, b) => (ideal[b] % 1) - (ideal[a] % 1) || weights[b] - weights[a] || a - b);

    while (left > 0) {
      let moved = false;
      for (const i of byRemainder) {
        if (left <= 0) break;
        if (out[i] < cap(i)) {
          out[i] += 1;
          left -= 1;
          moved = true;
        }
      }
      if (!moved) break; // every slot is full; the rest has nowhere to go
    }

    return out;
  }

  /* Cut a breakdown out of counts the cells already hold.

     A setter's zone map is a breakdown of something that has already
     been dealt out — her assists — and it has to agree with them cell by
     cell, or a filter would slice the table and the court card apart.

     Splitting inside each cell is the obvious way and it is wrong: a
     cell holds one or two assists, and one assist dealt over six
     weighted zones lands in the heaviest one every time, so a season
     comes out with every ball set to zone 4 and three zones reading 0%.
     Small numbers don't carry a distribution. So the breakdown is taken
     at match level, where there are enough events for the weights to
     mean anything, and each bucket is then poured back into the cells
     against whatever room they have left. */
  function carve(perCell, buckets, rand) {
    const room = perCell.slice();
    return buckets.map((total) => {
      const weights = room.map((left) => (left > 0 ? left * (0.7 + rand() * 0.6) : 0));
      const share = spread(total, weights, room);
      share.forEach((count, i) => {
        room[i] -= count;
      });
      return share;
    });
  }

  /* Two outcomes of the same attempt can't outnumber the attempts. */
  function fit(att, a, b) {
    if (a + b <= att) return [a, b];
    if (att <= 0) return [0, 0];
    const kept = Math.min(a, att);
    return [kept, Math.max(0, Math.min(b, att - kept))];
  }

  /* ---------- The roster ----------
     Rates per set, not totals: a five-set match is a five-set match's
     worth of volleyball, which is the other half of why the numbers move
     when the selection does.

     `serveRot` is the rotation this athlete serves in. Six servers, six
     rotations — so filtering to Rotation 3 really does leave only
     L. Vigil's serves in the serving table, the way it would in the
     product. (B. Mason is a front-row substitute and never serves, which
     is why she has no rotation of her own.)

     `rec.mix` is the shape of a passer's ratings: the share of her
     receptions that came back a 3, a 2, a 1, and an error, in that order.
     `zones` is where a setter puts the ball, zone 1 through zone 6. */
  const ROSTER = [
    {
      id: "4",
      label: "#4 V. Will",
      serveRot: 6,
      atk: { att: 2.0, kill: 0.333, err: 0.07 },
      srv: { att: 3.33, ace: 0.04, err: 0.1, rtg: 1.8 },
      rec: { att: 0, mix: [0.2, 0.4, 0.3, 0.1] },
      set: { att: 0.1, ast: 0.55, err: 0.1, bhe: 0.05 },
      blk: { solo: 0.33, assist: 0.67, err: 0.1 },
      zones: [0.1, 0.24, 0.22, 0.28, 0.08, 0.08],
    },
    {
      id: "13",
      label: "#13 M. Herbert",
      serveRot: 2,
      atk: { att: 5.67, kill: 0.412, err: 0.215 },
      srv: { att: 2.67, ace: 0.1, err: 0.25, rtg: 1.7 },
      rec: { att: 1.67, mix: [0.2, 0.2, 0.4, 0.2] },
      set: { att: 0.67, ast: 0.5, err: 0.12, bhe: 0.05 },
      blk: { solo: 0.67, assist: 1.33, err: 0.33 },
      zones: [0.1, 0.24, 0.22, 0.28, 0.08, 0.08],
    },
    {
      id: "8",
      label: "#8 L. Vigil",
      serveRot: 3,
      atk: { att: 4.67, kill: 0.429, err: 0.143 },
      srv: { att: 4.33, ace: 0.04, err: 0.23, rtg: 1.69 },
      rec: { att: 5.33, mix: [0.3125, 0.375, 0.25, 0.0625] },
      set: { att: 0.33, ast: 0.35, err: 0.1, bhe: 0.05 },
      blk: { solo: 0.33, assist: 1.0, err: 0.33 },
      zones: [0.1, 0.24, 0.22, 0.28, 0.08, 0.08],
    },
    {
      id: "31",
      label: "#31 L. Lee",
      serveRot: 1,
      atk: { att: 0.2, kill: 0.35, err: 0.1 },
      srv: { att: 3.67, ace: 0.18, err: 0.09, rtg: 2.5 },
      rec: { att: 4.67, mix: [0.1, 0.48, 0.22, 0.2] },
      set: { att: 8.67, ast: 0.846, err: 0.06, bhe: 0.2 },
      blk: { solo: 0, assist: 0.33, err: 0.05 },
      zones: [0.08, 0.26, 0.22, 0.34, 0.06, 0.04],
    },
    {
      id: "2",
      label: "#2 J. Eny",
      serveRot: 4,
      atk: { att: 5.33, kill: 0.28, err: 0.22 },
      srv: { att: 3.33, ace: 0.1, err: 0.2, rtg: 2.1 },
      rec: { att: 5.0, mix: [0.333, 0.267, 0.333, 0.067] },
      set: { att: 2.0, ast: 0.667, err: 0.08, bhe: 0.06 },
      blk: { solo: 0, assist: 0.67, err: 0.05 },
      zones: [0.12, 0.22, 0.26, 0.26, 0.08, 0.06],
    },
    {
      id: "10",
      label: "#10 J. Roth",
      serveRot: 5,
      atk: { att: 4.33, kill: 0.48, err: 0.12 },
      srv: { att: 4.67, ace: 0.143, err: 0.214, rtg: 2.07 },
      rec: { att: 0.33, mix: [0.25, 0.45, 0.2, 0.1] },
      set: { att: 1.0, ast: 0.333, err: 0.1, bhe: 0.2 },
      blk: { solo: 0.67, assist: 1.0, err: 0.33 },
      zones: [0.1, 0.2, 0.28, 0.26, 0.08, 0.08],
    },
    {
      id: "22",
      label: "#22 B. Mason",
      serveRot: 0,
      atk: { att: 2.33, kill: 0.429, err: 0.143 },
      srv: { att: 0, ace: 0, err: 0, rtg: 0 },
      rec: { att: 0, mix: [0.2, 0.4, 0.3, 0.1] },
      set: { att: 0.05, ast: 0.5, err: 0.1, bhe: 0.05 },
      blk: { solo: 0.33, assist: 0.33, err: 0.1 },
      zones: [0.1, 0.24, 0.22, 0.28, 0.08, 0.08],
    },
  ];

  const ROTATIONS = [1, 2, 3, 4, 5, 6];

  /* A line-up's weak rotation is weak all season: it is the same six
     players in the same order every match. So the tilt over a rotation
     is this fixed bias times a per-match roll, rather than noise alone —
     noise alone averages out over seventeen matches and the season
     report comes back saying every rotation is the same, which is the
     one thing a coach knows isn't true. Rotation 4 is the hole here. */
  const ROT_BIAS = [1.06, 1.0, 0.96, 0.88, 1.02, 1.06];
  const PTS_PER_SET = 22;
  const COUNT_KEYS = [
    "aatt", "kill", "aerr",
    "satt", "ace", "serr", "srtg",
    "ratt", "r3", "r2", "r1", "rerr",
    "setatt", "ast", "seterr", "bhe",
    "solo", "bassist", "berr",
    "pts", "soAtt", "soWon",
  ];

  function blankCounts() {
    const counts = {};
    COUNT_KEYS.forEach((key) => {
      counts[key] = 0;
    });
    counts.mp = 0;
    counts.sp = 0;
    return counts;
  }

  function addCounts(into, from) {
    COUNT_KEYS.forEach((key) => {
      into[key] += from[key];
    });
  }

  /* ---------- The attack card's shots ----------
     Every attack in the report, one line each, from where it was hit to
     where it finished.

     This began as an aggregation — three origins against ten target
     zones, each route drawn once as thick as its share — because a
     season is sixteen hundred swings and sixteen hundred lines is a
     block of ink. It was the wrong trade. Fixed endpoints make every
     match look like the same match: the picture stops being a record of
     what happened and becomes a diagram of the weights behind it, and
     the thing a coach reads a shot map for is precisely that this match
     was different from the last one. So the geometry is per swing and
     rolled off the match's own seed, and the density problem is solved
     where it belongs — by drawing a sample and saying how big it is.

     Three outcomes, because an attack has three: it lands for a kill, it
     goes out or into the net for an error, or the other team digs it and
     the rally goes on. In play is the commonest of the three and leaving
     it out was quietly claiming every swing ended the rally. Clean and
     deflected (touched by the block on the way through) are the line
     styles over the top of that. */

  // The court's own units, which the SVG in the markup is drawn in: 900
  // wide, the net across y = 900, their baseline at y = 0.
  const COURT_W = 900;
  // Front row left to right, then back row left to right. Attacks come
  // mostly from the front, and mostly from the pins.
  const ATTACK_SPOTS = [
    { x: 150, front: true, weight: 0.34 },
    { x: 450, front: true, weight: 0.18 },
    { x: 750, front: true, weight: 0.3 },
    { x: 150, front: false, weight: 0.08 },
    { x: 450, front: false, weight: 0.04 },
    { x: 750, front: false, weight: 0.06 },
  ];
  const SPOT_TOTAL = ATTACK_SPOTS.reduce((sum, spot) => sum + spot.weight, 0);

  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  /* One swing. `rand` is the match's own generator, so a match always
     draws the same shots and no two matches draw the same ones. */
  function makeShot(rand, outcome) {
    const roll = rand() * SPOT_TOTAL;
    let spot = ATTACK_SPOTS[0];
    let seen = 0;
    for (const candidate of ATTACK_SPOTS) {
      seen += candidate.weight;
      if (roll <= seen) {
        spot = candidate;
        break;
      }
    }

    // Where she took off from. A front-row attack is hit at the net; a
    // back-row one from behind the attack line, which is what makes some
    // of these lines twice the length of the others.
    const x1 = clamp(spot.x + (rand() - 0.5) * 230, 30, COURT_W - 30);
    const y1 = spot.front ? 930 + rand() * 90 : 1225 + rand() * 115;

    // Angle. A ball hit from the left pin mostly goes right; how far
    // right is the difference between a line shot and a sharp cross.
    const swing = 0.15 + rand() * rand() * 1.05;
    const aim = x1 + (COURT_W - x1 - x1) * swing;
    const deflected = rand() < 0.22;

    if (outcome === "err") {
      const how = rand();
      if (how < 0.3) {
        // Into the net: it never crosses, so it ends on this side of it.
        return {
          o: "err",
          d: deflected,
          x1,
          y1,
          x2: clamp(x1 + (rand() - 0.5) * 180, 20, COURT_W - 20),
          y2: 910 + rand() * 40,
        };
      }
      if (how < 0.62) {
        // Long, over their baseline. How far over is bounded by the
        // margin the court is drawn in rather than by how long the ball
        // went: the frame in the markup is the design's, so a ball that
        // sails has to land inside it instead of the frame growing to
        // catch it.
        return {
          o: "err",
          d: deflected,
          x1,
          y1,
          x2: clamp(aim + (rand() - 0.5) * 320, -20, COURT_W + 20),
          y2: -40 - rand() * 50,
        };
      }
      // Wide, over a sideline — and which sideline follows the swing:
      // the ball that misses wide is the one that was already going
      // there.
      const right = aim > COURT_W / 2 ? rand() < 0.78 : rand() < 0.22;
      return {
        o: "err",
        d: deflected,
        x1,
        y1,
        x2: right ? COURT_W + 30 + rand() * 40 : -30 - rand() * 40,
        y2: 100 + rand() * 640,
      };
    }

    // Kills and dug balls both land in, and land differently: a kill is
    // deep or sharp and short, a dug ball tends to be the one that came
    // up somewhere reachable in the middle.
    const deep = outcome === "kill" ? rand() < 0.62 : rand() < 0.45;
    let y2 = deep ? 40 + rand() * 440 : 520 + rand() * 330;
    // A deflected ball has had the pace taken off it, so it drops
    // shorter than the same swing would have.
    if (deflected) y2 = Math.min(860, y2 + rand() * 260);

    return {
      o: outcome,
      d: deflected,
      x1,
      y1,
      x2: clamp(aim + (rand() - 0.5) * 300, 30, COURT_W - 30),
      y2,
    };
  }

  /* ---------- The season ----------
     Read off the tiles rather than kept as a second list in here, for the
     same reason the trends chart reads them: the tiles are the timeline
     the coach is clicking, so the tiles are the season. Each one carries
     how many sets it went, where it was played, how it ended, and the
     side-out it produced. */
  const SEASON = [...demo.querySelectorAll("[data-rdemo-match]")].map((tile, index) => ({
    tile,
    index,
    date: tile.querySelector(".rdemo__tiledate")?.textContent.trim() || "",
    opponent: tile.querySelector(".rdemo__tileopp")?.textContent.trim() || "",
    sets: Number(tile.getAttribute("data-sets")) || 3,
    sideout: Number(tile.getAttribute("data-sideout")) || 50,
    seed: 1013 + index * 7919,
  }));

  const SEASON_MEAN =
    SEASON.reduce((sum, match) => sum + match.sideout, 0) / (SEASON.length || 1);

  /* ---------- Generating a match ----------
     Cheap enough to do on demand, and cached anyway, because the same
     match is re-aggregated on every click. */
  const cache = new Map();

  function matchData(match) {
    if (cache.has(match.index)) return cache.get(match.index);

    const rand = rng(match.seed);
    // How well this match went, as one factor over every rate: the
    // side-out on the tile, against the season's own average.
    const form = 1 + ((match.sideout - SEASON_MEAN) / SEASON_MEAN) * 0.7;
    const sets = match.sets;

    // A set has its own swing and a rotation its own tilt, both rolled
    // once per match — so a bad second set stays a bad second set however
    // the report is sliced.
    const setSwing = [];
    for (let s = 0; s < sets; s += 1) setSwing.push(0.85 + rand() * 0.3);
    const rotTilt = ROT_BIAS.map((bias) => bias * (0.9 + rand() * 0.2));

    const slices = [];
    for (let s = 1; s <= sets; s += 1) {
      ROTATIONS.forEach((rot) => {
        const slice = {
          set: s,
          rot,
          ath: {},
          zones: {},
          shots: [],
          pts: 0,
          soAtt: 0,
          soWon: 0,
        };
        ROSTER.forEach((athlete) => {
          slice.ath[athlete.id] = blankCounts();
        });
        slices.push(slice);
      });
    }

    const jit = () => 0.92 + rand() * 0.16;

    /* Deal one column of one athlete down to the cells: over the sets
       first, then over the rotations inside each set. `room` is an
       optional ceiling per cell — how many attacks a cell recorded, say,
       when what is being dealt out is kills.

       One pass over all thirty cells is the shorter code and it
       distorts. Every column but attacks has a total smaller than the
       number of cells, so every cell's share rounds down to nothing and
       the column is settled entirely by which cells sort highest — and
       sorting is far more sensitive to a weight than sharing is. A set
       swinging 15% above the one below it was taking three times its
       receptions: one match came out with an eight-reception set and a
       twenty-seven, which is not a volleyball match. Splitting the pass
       keeps the set totals proportional, where there are five slots and
       numbers big enough to divide between them, and leaves the scatter
       to the rotations inside each set — which is where a report is
       meant to find it. */
    const deal = (total, room) => {
      const out = slices.map(() => 0);
      const roomOf = (i) => (room ? room[i] : Infinity);
      const setRoom = setSwing.map((weight, s) =>
        slices.reduce((sum, slice, i) => (slice.set === s + 1 ? sum + roomOf(i) : sum), 0)
      );
      // The roll over the sets has to be wide enough to reorder them,
      // not just to shade them. A column of nine receptions over five
      // sets leaves four to hand out after the floors, and those four go
      // in weight order — so with a narrow roll the same set is last in
      // every column of every athlete and loses the remainder every
      // time. It ended the match with ten receptions against another
      // set's twenty-three. A roll this wide still averages out to the
      // set's own swing; it just stops one set being last all evening.
      const perSet = spread(
        total,
        setSwing.map((weight, s) => (setRoom[s] > 0 ? weight * (0.82 + rand() * 0.36) : 0)),
        setRoom
      );
      perSet.forEach((count, s) => {
        const weights = slices.map((slice, i) =>
          slice.set === s + 1 && roomOf(i) > 0
            ? rotTilt[slice.rot - 1] * (0.55 + rand() * 0.9)
            : 0
        );
        spread(count, weights, room).forEach((given, i) => {
          out[i] += given;
        });
      });
      return out;
    };

    ROSTER.forEach((athlete) => {
      const cells = slices.map((slice) => slice.ath[athlete.id]);

      /* Attacks. Attempts first, then the outcomes inside them — the cap
         is what stops a cell recording a kill it never swung at. */
      const attTotal = Math.round(athlete.atk.att * sets * jit());
      const aatt = deal(attTotal);
      let killTotal = Math.round(attTotal * athlete.atk.kill * form * jit());
      let aerrTotal = Math.round((attTotal * athlete.atk.err * jit()) / form);
      [killTotal, aerrTotal] = fit(attTotal, killTotal, aerrTotal);
      const kill = deal(killTotal, aatt);
      const aerr = deal(aerrTotal, aatt.map((att, i) => att - kill[i]));

      /* Serves, which all come out of this athlete's own rotation. */
      const serveRoom = slices.map((slice) =>
        slice.rot === athlete.serveRot ? Infinity : 0
      );
      const sattTotal = Math.round(athlete.srv.att * sets * jit());
      const satt = deal(sattTotal, serveRoom);
      let aceTotal = Math.round(sattTotal * athlete.srv.ace * form);
      let serrTotal = Math.round((sattTotal * athlete.srv.err) / form);
      [aceTotal, serrTotal] = fit(sattTotal, aceTotal, serrTotal);
      const ace = deal(aceTotal, satt);
      const serr = deal(serrTotal, satt.map((att, i) => att - ace[i]));
      // The rating is carried as a sum, not an average: an average can't
      // be added up across matches, and this one has to be.
      const srtg = deal(
        Math.round(sattTotal * athlete.srv.rtg * (1 + (form - 1) * 0.5)),
        satt.map((att) => (att ? Infinity : 0))
      );

      /* Receptions. The four ratings are the primitive and the attempt
         column is their sum, which is how the report's own SR Att column
         behaves. A better match passes a better mix. */
      const mix = athlete.rec.mix.map((share, i) => {
        if (i === 0) return share * form * form;
        if (i === 3) return share / (form * form);
        return share;
      });
      const ratings = spread(Math.round(athlete.rec.att * sets * jit()), mix).map(
        (count) => deal(count)
      );

      /* Sets. Assists are dealt out before the zone map is cut from them,
         so the two can never disagree. */
      const setattTotal = Math.round(athlete.set.att * sets * jit());
      const setatt = deal(setattTotal);
      // Assists take the same form factor the kill rates did, because
      // nearly every kill is somebody's assist: let the two drift apart
      // and the report starts claiming more kills than balls set.
      let astTotal = Math.round(setattTotal * athlete.set.ast * form);
      let seterrTotal = Math.round(setattTotal * athlete.set.err);
      [astTotal, seterrTotal] = fit(setattTotal, astTotal, seterrTotal);
      const ast = deal(astTotal, setatt);
      const seterr = deal(seterrTotal, setatt.map((att, i) => att - ast[i]));
      const bhe = deal(Math.round(athlete.set.bhe * sets * jit()));

      /* Blocks. */
      const solo = deal(Math.round(athlete.blk.solo * sets * jit()));
      const bassist = deal(Math.round(athlete.blk.assist * sets * jit()));
      const berr = deal(Math.round(athlete.blk.err * sets * jit()));

      cells.forEach((counts, i) => {
        counts.aatt = aatt[i];
        counts.kill = kill[i];
        counts.aerr = aerr[i];
        counts.satt = satt[i];
        counts.ace = ace[i];
        counts.serr = serr[i];
        counts.srtg = srtg[i];
        counts.r3 = ratings[0][i];
        counts.r2 = ratings[1][i];
        counts.r1 = ratings[2][i];
        counts.rerr = ratings[3][i];
        counts.ratt = counts.r3 + counts.r2 + counts.r1 + counts.rerr;
        counts.setatt = setatt[i];
        counts.ast = ast[i];
        counts.seterr = seterr[i];
        counts.bhe = bhe[i];
        counts.solo = solo[i];
        counts.bassist = bassist[i];
        counts.berr = berr[i];

      });

      // Where those assists went.
      if (astTotal) {
        const zoneTotals = spread(
          astTotal,
          athlete.zones.map((w) => w * (0.85 + rand() * 0.3))
        );
        const zoneCells = carve(ast, zoneTotals, rand);
        slices.forEach((slice, i) => {
          if (!ast[i]) return;
          slice.zones[athlete.id] = zoneCells.map((cells) => cells[i]);
        });
      }
    });

    /* Points, and the side-out the tile promised.

       Side-out attempts are not invented: a side-out attempt IS a
       reception, so the column is the sum of what the passers just did.
       The wins are then dealt out to hit the tile's percentage exactly —
       weighted by each rotation's tilt, capped by its receptions — so
       rotation 4 can be the hole in the line-up without the match total
       drifting off the number the chart plots. */
    const pts = deal(Math.round(sets * (PTS_PER_SET + rand() * 4)));
    slices.forEach((slice, i) => {
      slice.pts = pts[i];
      slice.soAtt = ROSTER.reduce((sum, athlete) => sum + slice.ath[athlete.id].ratt, 0);
    });
    const soAttTotal = slices.reduce((sum, slice) => sum + slice.soAtt, 0);
    // The ceiling is 85% of a cell's receptions rather than all of them.
    // Capping at every ball received is arithmetically fine and reads as
    // nonsense: the remainders pile into whichever rotation is tilted
    // highest and the table reports a rotation that sided out 100% of a
    // match. No rotation does that.
    const soWon = spread(
      (soAttTotal * match.sideout) / 100,
      slices.map(
        (slice) => slice.soAtt * rotTilt[slice.rot - 1] * (0.7 + rand() * 0.6)
      ),
      slices.map((slice) => Math.round(slice.soAtt * 0.85))
    );
    slices.forEach((slice, i) => {
      slice.soWon = soWon[i];
    });

    /* And the shot map, one line per attack, generated inside the cell
       that recorded it — so the card is not an illustration beside the
       table, it is the table's A Att column with the geometry still
       attached, and a filter cuts both at once.

       The three outcomes are exactly the cell's own numbers: its kills,
       its errors, and everything else it swung at, which the other team
       dug. Shuffled, because when the selection is too big to draw the
       sample takes every nth shot, and an unshuffled list would hand it
       all the kills first. */
    slices.forEach((slice) => {
      const kills = ROSTER.reduce((sum, a) => sum + slice.ath[a.id].kill, 0);
      const errs = ROSTER.reduce((sum, a) => sum + slice.ath[a.id].aerr, 0);
      const atts = ROSTER.reduce((sum, a) => sum + slice.ath[a.id].aatt, 0);

      const outcomes = [];
      for (let i = 0; i < kills; i += 1) outcomes.push("kill");
      for (let i = 0; i < errs; i += 1) outcomes.push("err");
      for (let i = kills + errs; i < atts; i += 1) outcomes.push("play");
      for (let i = outcomes.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        const held = outcomes[i];
        outcomes[i] = outcomes[j];
        outcomes[j] = held;
      }

      slice.shots = outcomes.map((outcome) => makeShot(rand, outcome));
    });

    const data = { sets, slices };
    cache.set(match.index, data);
    return data;
  }

  /* ---------- State ----------
     The match selection lives on the tiles (aria-pressed, written by
     setupMatchSelects in main.js) and is read back off them rather than
     mirrored here. The filters are the only state this file owns. An
     empty filter set means "everything", which is why the funnel starts
     at zero rather than at eleven. */
  const filters = { set: new Set(), rot: new Set() };

  const selectedMatches = () =>
    SEASON.filter((match) => match.tile.getAttribute("aria-pressed") === "true");

  const setAllowed = (set) => !filters.set.size || filters.set.has(set);
  const rotAllowed = (rot) => !filters.rot.size || filters.rot.has(rot);

  /* ---------- Aggregation ----------
     One pass over the season's cells, into per-athlete, per-rotation and
     team totals at once. */
  function aggregate() {
    const agg = {
      matches: 0,
      sets: 0,
      ath: {},
      rot: {},
      team: blankCounts(),
      zones: {},
      shots: [],
      perMatch: [],
    };
    ROSTER.forEach((athlete) => {
      agg.ath[athlete.id] = blankCounts();
    });
    ROTATIONS.forEach((rot) => {
      agg.rot[rot] = blankCounts();
    });

    SEASON.forEach((match) => {
      const data = matchData(match);
      const picked = match.tile.getAttribute("aria-pressed") === "true";
      let counted = 0;
      for (let s = 1; s <= data.sets; s += 1) if (setAllowed(s)) counted += 1;

      let matchSoAtt = 0;
      let matchSoWon = 0;

      data.slices.forEach((slice) => {
        if (!setAllowed(slice.set) || !rotAllowed(slice.rot)) return;
        matchSoAtt += slice.soAtt;
        matchSoWon += slice.soWon;
        if (!picked) return;

        const rot = agg.rot[slice.rot];
        rot.pts += slice.pts;
        rot.soAtt += slice.soAtt;
        rot.soWon += slice.soWon;
        agg.team.pts += slice.pts;
        agg.team.soAtt += slice.soAtt;
        agg.team.soWon += slice.soWon;

        ROSTER.forEach((athlete) => {
          const counts = slice.ath[athlete.id];
          addCounts(agg.ath[athlete.id], counts);
          addCounts(rot, counts);
          addCounts(agg.team, counts);
        });

        Object.keys(slice.zones).forEach((id) => {
          const zones = (agg.zones[id] = agg.zones[id] || [0, 0, 0, 0, 0, 0]);
          slice.zones[id].forEach((count, z) => {
            zones[z] += count;
          });
        });

        agg.shots.push(...slice.shots);
      });

      // The trends chart's series. Every match keeps a point whether or
      // not it is selected — the season is the backdrop the selection is
      // read against — but a filter that leaves a match with nothing in
      // it takes the point out, because there is no side-out left to plot.
      if (matchSoAtt > 0) {
        const sideout = Math.round((matchSoWon / matchSoAtt) * 1000) / 10;
        agg.perMatch.push({
          match: match.opponent,
          date: match.date,
          sideout,
          picked: picked ? sideout : null,
        });
      }

      if (picked && counted) {
        agg.matches += 1;
        agg.sets += counted;
      }
    });

    // Matches played and sets played: the same for everyone in this
    // line-up, and the number the footer reports for the team.
    ROSTER.forEach((athlete) => {
      agg.ath[athlete.id].mp = agg.matches;
      agg.ath[athlete.id].sp = agg.sets;
    });
    agg.team.mp = agg.matches;
    agg.team.sp = agg.sets;

    agg.perMatch.reverse(); // the tiles run newest first; a trend reads forwards
    return agg;
  }

  /* ---------- The columns ----------
     Bound by the labels already in the markup rather than by an attribute
     added to every cell: a report column's heading is unique inside its
     stat group, so "A Err" under a group headed Attacks is all the
     identification a cell needs, and the tables stay readable as tables.
     The one collision is S Err — a serving error under Serves, a setting
     error under Setting — and the group's own heading breaks that tie.

     Raw counts are the ones that open a clip in the product, so they keep
     the underline. Computed columns don't, because there is no clip
     behind an average. */
  const int = (v) => String(v);
  const fixed = (places) => (v) => v.toFixed(places);
  const pct1 = (v) => v.toFixed(1) + "%";

  const raw = (key) => ({ raw: true, value: (c) => c[key] || null, format: int });

  const STAT_SPECS = {
    mp: { value: (c) => c.mp || null, format: int },
    sp: { value: (c) => c.sp || null, format: int },
    pts: { value: (c) => c.pts || null, format: int },
    soPct: { value: (c) => (c.soAtt ? (c.soWon / c.soAtt) * 100 : null), format: pct1 },

    kill: raw("kill"),
    aerr: raw("aerr"),
    aatt: raw("aatt"),
    aPct: { value: (c) => (c.aatt ? (c.kill - c.aerr) / c.aatt : null), format: fixed(3) },

    ace: raw("ace"),
    serr: raw("serr"),
    satt: raw("satt"),
    sRtg: { value: (c) => (c.satt ? c.srtg / c.satt : null), format: fixed(2) },
    sPct: { value: (c) => (c.satt ? ((c.satt - c.serr) / c.satt) * 100 : null), format: pct1 },

    r3: raw("r3"),
    r2: raw("r2"),
    r1: raw("r1"),
    rerr: raw("rerr"),
    ratt: raw("ratt"),
    avgRtg: {
      value: (c) => (c.ratt ? (3 * c.r3 + 2 * c.r2 + c.r1) / c.ratt : null),
      format: fixed(2),
    },

    ast: raw("ast"),
    seterr: raw("seterr"),
    bhe: raw("bhe"),
    setatt: raw("setatt"),
    astPct: { value: (c) => (c.setatt ? c.ast / c.setatt : null), format: fixed(3) },
    // Guarded on assists, not on sets played: everyone in the line-up
    // has played the sets, so dividing by them puts six rows of 0.00
    // under the one setter who actually set. A dash says "didn't set",
    // which is the thing that happened.
    astPerSet: { value: (c) => (c.ast && c.sp ? c.ast / c.sp : null), format: fixed(2) },

    solo: raw("solo"),
    bassist: raw("bassist"),
    berr: raw("berr"),
    blkTotal: {
      value: (c) => (c.solo + c.bassist + c.berr ? c.solo + c.bassist / 2 : null),
      format: fixed(1),
    },
  };

  const STAT_BY_LABEL = {
    "MP": "mp", "SP": "sp",
    "Pts": "pts", "SO%": "soPct",
    "Kill": "kill", "A Err": "aerr", "A Att": "aatt", "A%": "aPct",
    "Ace": "ace", "S Err": "serr", "S Att": "satt", "S Rtg": "sRtg", "S%": "sPct",
    "Rtg 3": "r3", "Rtg 2": "r2", "Rtg 1": "r1",
    "SR Err": "rerr", "SR Att": "ratt", "Avg Rtg": "avgRtg",
    "Ast": "ast", "BHE": "bhe", "Set Att": "setatt", "Ast%": "astPct",
    "Ast/Set": "astPerSet",
    "Solo": "solo", "Assist": "bassist", "B Err": "berr", "Total": "blkTotal",
  };

  const STAT_BY_FAMILY = {
    Setting: { "S Err": "seterr" },
  };

  const text = (node) => (node ? node.textContent.replace(/\s+/g, " ").trim() : "");

  const TABLES = [...demo.querySelectorAll("table.rdemo__table")]
    .map((table) => {
      const headRows = table.tHead ? [...table.tHead.rows] : [];
      if (headRows.length < 2) return null;

      const family = text(headRows[0].cells[headRows[0].cells.length - 1]);
      const overrides = STAT_BY_FAMILY[family] || {};
      const keys = [...headRows[1].cells]
        .slice(1)
        .map((cell) => overrides[text(cell)] || STAT_BY_LABEL[text(cell)] || null);

      const bodyRows = table.tBodies.length ? [...table.tBodies[0].rows] : [];
      const footRows = table.tFoot ? [...table.tFoot.rows] : [];
      const rows = [...bodyRows, ...footRows]
        .map((row) => {
          const label = text(row.cells[0]);
          const athlete = label.match(/^#(\d+)/);
          if (athlete) return { row, kind: "ath", id: athlete[1] };
          const rotation = label.match(/^Rotation\s+(\d)/);
          if (rotation) return { row, kind: "rot", id: Number(rotation[1]) };
          if (/FHS/.test(label)) return { row, kind: "total" };
          return null;
        })
        .filter(Boolean);

      const caption = table.querySelector("caption");
      return { keys, rows, caption, captionPrefix: text(caption).split(", ")[0] };
    })
    .filter(Boolean);

  function writeCell(cell, key, counts) {
    const spec = key && STAT_SPECS[key];
    if (!spec) return;
    const value = counts ? spec.value(counts) : null;
    if (value === null || !Number.isFinite(value)) {
      cell.innerHTML = '<span class="rdemo__nil">&ndash;</span>';
      return;
    }
    const formatted = spec.format(value);
    cell.innerHTML = spec.raw
      ? '<span class="rdemo__cell">' + formatted + "</span>"
      : formatted;
  }

  function renderTables(agg, scope) {
    TABLES.forEach((table) => {
      if (table.caption && table.captionPrefix) {
        table.caption.textContent = table.captionPrefix + ", " + scope;
      }
      table.rows.forEach((entry) => {
        // A rotation the filter has excluded leaves the table rather than
        // sitting in it as a row of dashes: the filter says it isn't in
        // the report, so it isn't in the report.
        if (entry.kind === "rot") {
          entry.row.hidden = !rotAllowed(entry.id);
          if (entry.row.hidden) return;
        }
        const counts =
          entry.kind === "ath"
            ? agg.ath[entry.id]
            : entry.kind === "rot"
            ? agg.rot[entry.id]
            : agg.team;
        [...entry.row.cells].slice(1).forEach((cell, i) => {
          writeCell(cell, table.keys[i], counts);
        });
      });
    });
  }

  /* ---------- The attack card ----------
     How many swings will fit before the court stops being readable.
     Forty-odd is about it: past that the lines start describing each
     other rather than the court. Over the ceiling the card draws every
     nth shot and the key says how many it drew, which is the honest
     version of a picture that can't hold its own data — and the filters
     are the way to a whole one, since a single set is about forty
     attacks. */
  const SHOT_CEILING = 46;

  const shotHost = demo.querySelector("[data-rdemo-shots]");
  const shotSvg = shotHost ? shotHost.closest("svg") : null;

  const round = (value) => Math.round(value * 10) / 10;

  /* Each outcome gets the mark it has in the key: a kill stops dead, an
     error is struck out, a ball still in play carries on. The arrowhead
     is built from the shot's own angle rather than an SVG marker, which
     would need the stroke colour passed to it twice. */
  function shotMark(shot) {
    const x = round(shot.x2);
    const y = round(shot.y2);

    if (shot.o === "kill") {
      return '<circle class="rdemo__shotend--kill" cx="' + x + '" cy="' + y + '" r="20" />';
    }

    if (shot.o === "err") {
      // Smaller than the kill's dot looks on the court: the cross is two
      // strokes reaching into all four corners of its box, so matching
      // the dot's radius makes every error twice the mark of every kill.
      const r = 17;
      return (
        '<path class="rdemo__shotend--err" d="M' + round(x - r) + ' ' + round(y - r) +
        'L' + round(x + r) + ' ' + round(y + r) +
        'M' + round(x - r) + ' ' + round(y + r) +
        'L' + round(x + r) + ' ' + round(y - r) + '" />'
      );
    }

    const angle = Math.atan2(shot.y2 - shot.y1, shot.x2 - shot.x1);
    const back = 46;
    const half = 19;
    const bx = x - back * Math.cos(angle);
    const by = y - back * Math.sin(angle);
    return (
      '<path class="rdemo__shotend--play" d="M' + x + ' ' + y +
      'L' + round(bx + half * Math.sin(angle)) + ' ' + round(by - half * Math.cos(angle)) +
      'L' + round(bx - half * Math.sin(angle)) + ' ' + round(by + half * Math.cos(angle)) +
      'Z" />'
    );
  }

  function renderShots(agg) {
    if (!shotHost) return;

    // Sampled per outcome rather than across the lot, so the mix on the
    // court is the mix in the report. One stride over everything is
    // simpler and it drifts: the season came out 28% kills on a card
    // whose own key said 40%, which is the sort of quiet wrongness a
    // coach would take at face value.
    const total = agg.shots.length;
    const groups = ["kill", "err", "play"].map((outcome) =>
      agg.shots.filter((shot) => shot.o === outcome)
    );
    const quota = spread(
      Math.min(total, SHOT_CEILING),
      groups.map((group) => group.length),
      groups.map((group) => group.length)
    );
    const drawn = groups.flatMap((group, i) => {
      if (!quota[i]) return [];
      const stride = group.length / quota[i];
      return Array.from({ length: quota[i] }, (unused, n) => group[Math.floor(n * stride)]);
    });

    // Kills last, so the outcome the card is read for is the one on top
    // of the pile where they cross.
    const order = { play: 0, err: 1, kill: 2 };
    drawn.sort((a, b) => order[a.o] - order[b.o]);

    shotHost.innerHTML = drawn
      .map((shot) => {
        const kind = "rdemo__shot--" + shot.o + (shot.d ? " rdemo__shot--deflected" : "");
        return (
          '<line class="rdemo__shot ' + kind + '" x1="' + round(shot.x1) + '" y1="' +
          round(shot.y1) + '" x2="' + round(shot.x2) + '" y2="' + round(shot.y2) + '" />' +
          shotMark(shot)
        );
      })
      .join("");

    // Said here and only here. The key under the court is the design's
    // two rows, and the attack table beside the card already reports the
    // totals in its own A Att column — a third line of numbers under the
    // court was me explaining the card to itself.
    const counts =
      agg.team.aatt + " attacks · " + agg.team.kill + " kills · " + agg.team.aerr + " errors";

    if (shotSvg) {
      shotSvg.setAttribute(
        "aria-label",
        total
          ? "Shot map: " + counts + ", plotted from where each attack was hit to where it " +
            "finished" + (drawn.length < total ? ", drawn from a sample of " + drawn.length : "")
          : "Shot map: no attacks in the current report"
      );
    }
  }

  /* ---------- The setter card ----------
     One setter's distribution, not the team's: a map that mixed two
     setters' habits together would describe nobody. So it follows
     whoever is setting most in whatever the coach has selected, and says
     whose it is under the court. */
  const ZONE_GROUPS = [...demo.querySelectorAll("[data-rdemo-zone]")];
  const zoneSvg = ZONE_GROUPS.length ? ZONE_GROUPS[0].closest("svg") : null;
  const setterNote = demo.querySelector("[data-rdemo-setternote]");

  const ZONE_BANDS = [
    { min: 0.28, fill: "hot", ink: "light" },
    { min: 0.15, fill: "mid", ink: "dark" },
    { min: 0.05, fill: "cool", ink: "light" },
    { min: -1, fill: "none", ink: "dim" },
  ];

  function renderZones(agg) {
    if (!ZONE_GROUPS.length) return;

    let setter = null;
    Object.keys(agg.zones).forEach((id) => {
      const total = agg.zones[id].reduce((a, b) => a + b, 0);
      if (!setter || total > setter.total) setter = { id, total };
    });

    const counts = setter ? agg.zones[setter.id] : [0, 0, 0, 0, 0, 0];
    const total = setter ? setter.total : 0;
    // Shares are apportioned rather than rounded one by one, so they
    // still add to 100: a distribution that reads 34/22/26/6/4/9 is a
    // distribution nobody trusts.
    const shown = total ? spread(100, counts) : counts.map(() => 0);

    ZONE_GROUPS.forEach((group) => {
      const zone = Number(group.getAttribute("data-rdemo-zone"));
      const share = total ? counts[zone - 1] / total : 0;
      const band = ZONE_BANDS.find((b) => share >= b.min);
      const fill = group.querySelector("rect");
      const value = group.querySelector(".rdemo__zonevalue");
      const label = group.querySelector(".rdemo__zonelabel");

      if (fill) fill.setAttribute("class", "rdemo__zone--" + band.fill);
      if (value) {
        value.setAttribute("class", "rdemo__zonevalue rdemo__zonetext--" + band.ink);
        // A zone with nothing in it gets the dash the tables use for the
        // same thing, rather than a 0% that reads as a measurement.
        value.textContent = counts[zone - 1] ? shown[zone - 1] + "%" : "–";
      }
      if (label) {
        label.setAttribute("class", "rdemo__zonelabel rdemo__zonetext--" + band.ink);
      }
    });

    const name = setter ? ROSTER.find((a) => a.id === setter.id).label : null;
    if (setterNote) {
      setterNote.textContent = total
        ? name + " · " + total + (total === 1 ? " set" : " sets")
        : "Nothing in this report";
    }
    if (zoneSvg) {
      zoneSvg.setAttribute(
        "aria-label",
        total
          ? "Half court: where " + name + " set the ball — " +
            ZONE_GROUPS.map((group) => {
              const zone = Number(group.getAttribute("data-rdemo-zone"));
              return "zone " + zone + " " + shown[zone - 1] + " percent";
            }).join(", ")
          : "Half court: no sets in the current report"
      );
    }
  }

  /* ---------- The filters ----------
     Two dimensions the report can be cut down to, and both are exact:
     nothing is scaled or estimated, the cells that don't match are simply
     not counted. Which is the whole reason the data above is generated
     per set and per rotation rather than per match.

     An empty group means all of it. That is how every filter panel a
     coach has used behaves, and it keeps the funnel's count honest: it is
     the number of things they have narrowed, not the number of
     checkboxes on the screen. */
  const filterGroups = [...demo.querySelectorAll("[data-rdemo-filter]")];
  const filterCount = demo.querySelector("[data-rdemo-filter-count]");
  const filterNote = demo.querySelector("[data-rdemo-filter-note]");
  const filterClear = demo.querySelector("[data-rdemo-filter-clear]");

  const activeFilters = () => filters.set.size + filters.rot.size;

  function filterLabel() {
    const parts = [];
    const list = (noun, set) =>
      noun + (set.size === 1 ? " " : "s ") + [...set].sort((a, b) => a - b).join(", ");
    if (filters.set.size) parts.push(list("set", filters.set));
    if (filters.rot.size) parts.push(list("rotation", filters.rot));
    return parts.join(" and ");
  }

  function renderFilterChrome() {
    const active = activeFilters();
    if (filterCount) {
      filterCount.textContent = active + (active === 1 ? " Filter" : " Filters");
    }
    if (filterNote) {
      filterNote.textContent = active
        ? "Counting " + filterLabel() + ", nothing else."
        : "Every set and every rotation is in the report.";
    }
    if (filterClear) filterClear.hidden = !active;
  }

  filterGroups.forEach((group) => {
    const dimension = group.getAttribute("data-rdemo-filter");
    group.addEventListener("click", (event) => {
      const chip = event.target.closest("[data-value]");
      if (!chip || !group.contains(chip)) return;

      const value = Number(chip.getAttribute("data-value"));
      const on = chip.getAttribute("aria-pressed") === "true";
      if (on) filters[dimension].delete(value);
      else filters[dimension].add(value);
      chip.setAttribute("aria-pressed", String(!on));

      // One event out, and everything drawn from the report redraws off
      // it — these tables, both courts, the trends chart over in main.js.
      // The same event the match picker fires, because narrowing the
      // report and changing which matches are in it are the same kind of
      // change to everything downstream.
      demo.dispatchEvent(new CustomEvent("rdemo:selection"));
    });
  });

  if (filterClear) {
    filterClear.addEventListener("click", () => {
      filters.set.clear();
      filters.rot.clear();
      filterGroups.forEach((group) => {
        group.querySelectorAll("[data-value]").forEach((chip) => {
          chip.setAttribute("aria-pressed", "false");
        });
      });
      demo.dispatchEvent(new CustomEvent("rdemo:selection"));
    });
  }

  /* ---------- Drawing the lot ---------- */
  function scopeLabel(agg) {
    const chosen = selectedMatches();
    const base = !chosen.length
      ? "FHS, no matches selected"
      : chosen.length === 1
      ? "FHS, " + chosen[0].date
      : "FHS, " + agg.matches + " matches";
    const narrowed = filterLabel();
    return narrowed ? base + " · " + narrowed : base;
  }

  let current = null;

  function render() {
    current = aggregate();
    renderTables(current, scopeLabel(current));
    renderShots(current);
    renderZones(current);
    renderFilterChrome();
  }

  demo.addEventListener("rdemo:selection", render);
  render();

  /* What the trends chart plots. It asks for this rather than reading the
     tiles itself, so a set or rotation filter moves the line too:
     side-out per match, off the same cells the tables just counted. */
  window.ReportDemo = {
    seasonPoints: () => (current || aggregate()).perMatch,
  };
})();
