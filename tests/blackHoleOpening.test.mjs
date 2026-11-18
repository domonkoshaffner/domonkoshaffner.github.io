import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENE_START, OPENING_DURATION, OPENING_OVER, OPENING_BODIES, PLANET, STAR, FRAGMENT, TURN,
  openingAge, openingStreakGain, openingPoint, bodyRadius, bodyReach, bodyGirth, createOpeningState,
} from '../src/lib/blackHoleOpening.ts';
import { FIRST_DISRUPTION } from '../src/lib/blackHoleDisruption.ts';

const at = (index, wide, since) => openingPoint(index, wide, since, { radius: 0, angle: 0, presence: 0 });
const place = (point) => [Math.cos(point.angle) * point.radius, Math.sin(point.angle) * point.radius];
/** The state at a moment of the opening, from a fresh start. */
const stateAt = (age, wide = true) => {
  const state = createOpeningState();
  state.update(SCENE_START + age, wide);
  return state;
};

test('the opening starts with the scene and is over for good after its duration', () => {
  assert.equal(openingAge(SCENE_START), 0);
  assert.ok(Math.abs(openingAge(SCENE_START + 1.5) - 1.5) < 1e-9);
  assert.ok(openingAge(SCENE_START + OPENING_DURATION - 0.001) < OPENING_DURATION);
  for (const later of [OPENING_DURATION + 0.001, 60, 3600]) {
    assert.equal(openingAge(SCENE_START + later), OPENING_OVER);
  }
  assert.ok(OPENING_OVER > OPENING_DURATION);
});

test('the opening is about ten seconds and finishes before the first star is pulled apart', () => {
  assert.ok(OPENING_DURATION <= 10.5);
  assert.ok(SCENE_START + OPENING_DURATION <= FIRST_DISRUPTION);
});

test('nothing falls into the hole: every body closes in on its own orbit and never goes inside it', () => {
  for (let k = 0; k < OPENING_BODIES; k++) {
    for (const wide of [true, false]) {
      let previous = at(k, wide, 0);
      const orbit = at(k, wide, 60).radius;
      assert.ok(orbit > 1.4, `orbit ${orbit.toFixed(2)} is well outside the shadow`);
      for (let since = 0.01; since < 20; since += 0.01) {
        const here = at(k, wide, since);
        assert.ok(here.radius <= previous.radius + 1e-9, 'always closing in');
        assert.ok(here.radius >= orbit - 1e-6, 'never inside its orbit');
        assert.ok(here.angle >= previous.angle, 'always circling the same way');
        previous = { ...here };
      }
      assert.ok(previous.radius - orbit < 1e-3, 'it ends on its orbit');
    }
  }
});

test('each path is smooth: no jump in place or in pace, from rest to the orbit', () => {
  for (let k = 0; k < OPENING_BODIES; k++) {
    for (const wide of [true, false]) {
      let b = { ...at(k, wide, 0) }, turn = 0, step = 0;
      for (let since = 0.005; since < 9; since += 0.005) {
        const c = { ...at(k, wide, since) };
        const nextTurn = c.angle - b.angle, nextStep = b.radius - c.radius;
        assert.ok(Math.abs(nextTurn - turn) < 0.0015, `turning pace is continuous at ${since.toFixed(2)}s`);
        assert.ok(Math.abs(nextStep - step) < 0.004, `closing pace is continuous at ${since.toFixed(2)}s`);
        turn = nextTurn; step = nextStep; b = c;
      }
      // Once caught it circles at the orbit's own pace.
      assert.ok(Math.abs(turn / 0.005 - TURN) < 0.02);
    }
  }
});

test('the system rests in the upper left of the hole: in the open sky on wide screens, inside the frame on narrow ones', () => {
  const wide = stateAt(0.5, true), narrow = stateAt(0.5, false);
  for (let k = 0; k < OPENING_BODIES; k++) {
    // Nothing has moved yet: every body is where its path begins.
    for (const [state, layout] of [[wide, true], [narrow, false]]) {
      const [x, y] = place(state.bodies[k]), [x0, y0] = place(at(k, layout, 0));
      assert.ok(Math.hypot(x - x0, y - y0) < 1e-9, 'at rest');
      assert.ok(state.bodies[k].since < 0 && state.bodies[k].reach === 0 && state.bodies[k].drained === 0);
      assert.equal(state.bodies[k].presence, 1);
    }
    // The area the owner marked, in shadow radii from the hole.
    const [x, y] = place(wide.bodies[k]);
    assert.ok(x > -10.2 && x < -5.8 && y > -3.1 && y < 0.15, `body ${k} rests in the marked area`);
    const [nx, ny] = place(narrow.bodies[k]);
    assert.ok(nx > -4.0 && nx < 0 && ny > -3.4 && ny < 0, `body ${k} rests inside a narrow frame`);
  }
});

test('each body holds still for a second or more, starts slowly, and only then gathers speed', () => {
  for (const wide of [true, false]) {
    const first = stateAt(0.95, wide);
    assert.ok(first.bodies.every((body) => body.since < 0), 'the whole system is still for the first second');
    // They leave one by one: the planets, then the star, then the rocks.
    const leaves = stateAt(0, wide).bodies.map((body) => -body.since);
    for (let k = 1; k < OPENING_BODIES; k++) assert.ok(leaves[k] > leaves[k - 1]);
    assert.ok(leaves[3] >= 2, 'the star holds out for two seconds');
    for (let k = 0; k < OPENING_BODIES; k++) {
      const [x0, y0] = place(at(k, wide, 0));
      const [x1, y1] = place(at(k, wide, 0.3));
      assert.ok(Math.hypot(x1 - x0, y1 - y0) < 0.05, 'barely moving at first');
      // Its speed only grows all the way in (every fall lasts longer than this).
      const speeds = [];
      for (let since = 0.02, from = [x0, y0]; since <= 1.6; since += 0.02) {
        const to = place(at(k, wide, since));
        speeds.push(Math.hypot(to[0] - from[0], to[1] - from[1]) / 0.02);
        from = to;
      }
      for (let i = 1; i < speeds.length; i++) assert.ok(speeds[i] >= speeds[i - 1] - 1e-9, 'accelerating');
      assert.ok(speeds.at(-1) > 8 * speeds[14], 'many times faster late in the fall than early');
    }
  }
});

test('the side nearest the hole goes first: matter runs ahead of each planet and of the star while the body follows and drains', () => {
  for (const wide of [true, false]) {
    for (let k = 0; k < 4; k++) {
      let reach = 0, drained = 0, led = false;
      for (let age = 0; age < OPENING_DURATION; age += 0.02) {
        const body = stateAt(age, wide).bodies[k];
        assert.ok(body.reach >= reach - 1e-6 && body.drained >= drained - 1e-9, 'only ever drawn out further');
        reach = body.reach; drained = body.drained;
        if (reach > 0.05 && body.presence > 0.5) {
          // The front of its matter is further along the same path: closer to the orbit than the body is.
          const front = at(k, wide, body.since);
          assert.ok(front.radius < body.radius && front.angle > body.angle, 'the matter leads the body');
          led = true;
        }
        // The body has gone into its stream before any of it reaches the ring.
        if (body.presence < 0.999) assert.equal(body.drained, 1);
        assert.ok(body.stretch >= 0 && body.stretch <= 1);
      }
      assert.ok(led && drained === 1 && reach > 0.5);
    }
    const rest = stateAt(0, wide).bodies;
    for (let k = 0; k < 4; k++) {
      assert.ok(bodyRadius(rest[k], 20) >= 2.6, 'visible on the smallest screen');
      assert.ok(bodyRadius(rest[k], 400) === rest[k].size * 400, 'true to scale on a large one');
    }
  }
});

test('a body does not shrink away or fade: it is drawn out, longer and finer, until it is its stream', () => {
  for (const wide of [true, false]) {
    for (let k = 0; k < 4; k++) {
      let reach = 1, girth = 1, bent = 0;
      for (let age = 0; age < OPENING_DURATION; age += 0.02) {
        const body = stateAt(age, wide).bodies[k];
        assert.equal(bodyRadius(body, 80), bodyRadius(stateAt(0, wide).bodies[k], 80), 'its size itself never changes');
        assert.ok(bodyReach(body) >= reach - 1e-9 && bodyGirth(body) <= girth + 1e-9, 'only ever longer and finer');
        reach = bodyReach(body); girth = bodyGirth(body);
        if (body.drained === 0 && body.stretch === 0) assert.ok(reach === 1 && girth === 1, 'whole until the tides take hold');
        // Drawn out, it follows the curve of its own path, never tighter than the smallest orbit.
        assert.ok(Number.isFinite(body.bend) && Math.abs(body.bend) <= 0.7);
        if (body.stretch === 0) assert.ok(body.bend === 0, 'and a body the tides have not touched is simply round');
        if (body.drained > 0.3) bent = Math.max(bent, Math.abs(body.bend));
      }
      assert.ok(reach > 6, 'many times its own length by the end');
      assert.ok(girth < 0.1, 'and as fine as a thread');
      assert.ok(bent > 0.01, 'along a path that does curve');
    }
  }
});

test('the pull is gentle: a planet or the star gathers speed smoothly and is never seen to rush', () => {
  const dt = 1 / 120;
  for (const wide of [true, false]) {
    for (let k = 0; k < 4; k++) {
      let before = null, speed = 0, top = 0, frontTop = 0, frontBefore = null;
      for (let age = 0; age < 8; age += dt) {
        const body = stateAt(age, wide).bodies[k];
        const here = place(body), front = place(at(k, wide, body.since));
        if (before && body.drained < 0.9 && body.presence > 0.05) {
          const now = Math.hypot(here[0] - before[0], here[1] - before[1]) / dt;
          assert.ok(now < 4.5, `body ${k} moves at ${now.toFixed(1)} shadow radii a second`);
          assert.ok(Math.abs(now - speed) / dt < 8, `body ${k} changes pace without a jolt`);
          top = Math.max(top, now); speed = now;
        }
        if (frontBefore) frontTop = Math.max(frontTop, Math.hypot(front[0] - frontBefore[0], front[1] - frontBefore[1]) / dt);
        before = here; frontBefore = front;
      }
      assert.ok(top > 2.5, 'yet it visibly closes in');
      assert.ok(frontTop > 1.5 * top, 'while the front of its matter is pulled on well ahead of it');
    }
  }
});

test('nothing swings out of sight: no planet nor the star passes behind the navigation or off a narrow frame', () => {
  for (const wide of [true, false]) {
    for (let k = 0; k < 4; k++) {
      for (let age = 0; age < 8; age += 0.01) {
        const body = stateAt(age, wide).bodies[k];
        const [x, y] = place(body), stream = place(at(k, wide, body.since)), lit = at(k, wide, body.since).presence > 0.02;
        if (wide) {
          // The navigation's edge is about 3.3 shadow radii above the hole. A body keeps
          // well below it while it is whole, and its last faint moments stay inside too.
          if (body.drained < 0.8) assert.ok(y > -3.1, `body ${k} stays below the navigation on a wide screen`);
          if (body.drained < 0.95) assert.ok(y > -3.25, `body ${k} never reaches the navigation`);
          // Its thin stream may come close to that edge, never past it.
          if (lit) assert.ok(stream[1] > -3.3, `the stream of body ${k} stays in the frame`);
        } else {
          if (body.drained < 0.95) assert.ok(Math.abs(x) < 4.0 && y > -3.4, `body ${k} stays inside a narrow frame`);
          if (lit) assert.ok(Math.abs(stream[0]) < 4.0 && stream[1] > -3.4);
        }
      }
    }
  }
});

test('no two of the planets and the star ever touch on their way in', () => {
  for (const wide of [true, false]) {
    for (let age = 0; age < 8; age += 0.02) {
      const bodies = stateAt(age, wide).bodies;
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
        if (bodies[i].drained > 0.85 || bodies[j].drained > 0.85) continue;
        const a = place(bodies[i]), b = place(bodies[j]);
        assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.55, `bodies ${i} and ${j} keep clear of each other at ${age.toFixed(1)}s`);
      }
    }
  }
});

test('every body has spread into the ring before the opening ends, and stays gone', () => {
  const state = createOpeningState();
  state.update(SCENE_START + OPENING_DURATION - 0.05, true);
  assert.equal(state.active, true);
  for (const body of state.bodies) assert.ok(body.presence < 0.01, 'merged by the end');
  for (const later of [OPENING_DURATION, OPENING_DURATION + 5, 300]) {
    state.update(SCENE_START + later, true);
    assert.equal(state.active, false);
    for (const body of state.bodies) assert.equal(body.presence, 0);
  }
  // Presence only ever fades.
  for (let k = 0; k < OPENING_BODIES; k++) {
    let previous = 1;
    for (let since = 0; since < 12; since += 0.02) {
      const presence = at(k, true, since).presence;
      assert.ok(presence <= previous + 1e-9 && presence >= 0);
      previous = presence;
    }
    assert.equal(previous, 0);
  }
});

test('the planets leave their matter first, then the star, all inside the disk and in time', () => {
  const state = createOpeningState();
  state.update(SCENE_START + 1, true);
  const seeds = [0, 1, 2, 3].map((k) => [...state.seeds.slice(k * 4, k * 4 + 4)]);
  const [planets, star] = [seeds.slice(0, 3), seeds[3]];
  for (const [when, angle, radius, share] of planets) {
    assert.ok(when < star[0], 'a planet settles before the star');
    assert.ok(when > 1 && when < OPENING_DURATION - 3);
    assert.ok(angle >= 0 && angle < Math.PI * 2);
    assert.ok(radius > 3.0 && radius < 9.5, 'inside the disk');
    assert.ok(share > 0 && share < 0.5, 'a planet brings a little');
  }
  assert.equal(star[3], 1, 'the star brings the rest');
  assert.ok(star[2] > 3.0 && star[2] < 6, 'the star settles in the inner disk, and the ring grows outward from there');
  assert.ok(star[0] + 5 < OPENING_DURATION, 'with time left for the ring to grow');
  assert.deepEqual(state.bodies.map((b) => b.kind).slice(0, 4), [PLANET, PLANET, PLANET, STAR]);
  assert.ok(state.bodies.slice(4).every((b) => b.kind === FRAGMENT));
});

test('the opening depends on scene time alone, so Pause and Play cannot change it', () => {
  const snapshot = (state) => JSON.stringify([state.active, state.bodies, [...state.seeds]]);
  const fresh = createOpeningState(), wandering = createOpeningState();
  for (const time of [70, 19, 300.5, 22.2, 18, 25.7]) wandering.update(time, true);
  for (const time of [18.4, 21, 23.3, 26.9, 40]) {
    fresh.update(time, true); wandering.update(time, true);
    assert.equal(snapshot(wandering), snapshot(fresh));
  }
});

test('both layouts keep the same timing, and the ring finishes inside the opening', () => {
  const wide = stateAt(1, true), narrow = stateAt(1, false);
  for (let k = 0; k < 4; k++) {
    assert.ok(Math.abs(narrow.seeds[k * 4] - wide.seeds[k * 4]) < 0.05, 'matter settles at the same moment');
    assert.equal(narrow.seeds[k * 4 + 2], wide.seeds[k * 4 + 2]);
  }
  // The halo and the final breath are timed from the star's matter, so both layouts end inside the opening.
  for (const state of [wide, narrow]) assert.ok(state.seeds[12] + 5.3 <= OPENING_DURATION);
});

test('the ordinary streaks stay out of the opening and fade in as the ring completes', () => {
  assert.equal(openingStreakGain(SCENE_START), 0);
  assert.equal(openingStreakGain(SCENE_START + 6), 0);
  let previous = 0;
  for (let time = SCENE_START; time < SCENE_START + 12; time += 0.05) {
    const gain = openingStreakGain(time);
    assert.ok(gain >= previous && gain <= 1);
    previous = gain;
  }
  assert.equal(openingStreakGain(SCENE_START + OPENING_DURATION), 1);
});
