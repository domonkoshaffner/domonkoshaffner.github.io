import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDisruptionState, streamPoint, streamPresence, FIRST_DISRUPTION, DISRUPTION_INTERVAL,
} from '../src/lib/blackHoleDisruption.ts';

const snapshot = (state) => ({ ...state.stream, wave: [...state.wave], waveShape: [...state.waveShape] });

test('nothing happens before the first event, and the scene starts before it', () => {
  const state = createDisruptionState();
  for (const time of [18, 20, FIRST_DISRUPTION - 0.01]) {
    state.update(time, true);
    assert.equal(state.stream.active, false);
    assert.equal(state.wave[3], 0);
  }
});

test('the star falls inward without ever turning back, then is absorbed', () => {
  const state = createDisruptionState();
  let previous = Infinity, sawStream = false, absorbedAt = null;
  for (let age = 0.1; age < 30; age += 0.1) {
    state.update(FIRST_DISRUPTION + age, true);
    if (!state.stream.active) { absorbedAt ??= sawStream ? age : null; continue; }
    assert.equal(absorbedAt, null, 'the stream does not come back once absorbed');
    sawStream = true;
    assert.ok(state.stream.headSquared < previous);
    previous = state.stream.headSquared;
    assert.ok(state.stream.first >= 0 && state.stream.first < 1);
    assert.ok(state.stream.stretch >= 0 && state.stream.stretch <= 1);
  }
  assert.ok(sawStream);
  assert.ok(absorbedAt > 15 && absorbedAt < 25, `absorbed after ${absorbedAt}s`);
});

test('the disk answers only after the stream lands, moves inward, and is quiet again before the next event', () => {
  const state = createDisruptionState();
  let firstHeat = null, lastHeat = null, previousRadius = Infinity, peak = 0;
  for (let age = 0; age < DISRUPTION_INTERVAL; age += 0.1) {
    state.update(FIRST_DISRUPTION + age, true);
    const strength = state.wave[3];
    assert.ok(strength >= 0 && strength <= 1.2);
    if (strength === 0) continue;
    firstHeat ??= age; lastHeat = age; peak = Math.max(peak, strength);
    assert.ok(state.wave[0] <= previousRadius + 1e-9, 'the wave never moves outward');
    previousRadius = state.wave[0];
    assert.ok(state.wave[0] >= 2.6 && state.wave[0] <= 9.5, 'the wave stays inside the disk');
    assert.ok(Math.abs(state.wave[1]) <= Math.PI + 1e-9);
  }
  assert.ok(firstHeat > 10, `first heat at ${firstHeat}s`);
  assert.ok(lastHeat < DISRUPTION_INTERVAL - 20, `last heat at ${lastHeat}s`);
  assert.ok(peak > 0.5);
});

test('the event depends on scene time alone, so Pause and Play cannot change it', () => {
  const fresh = createDisruptionState(), wandering = createDisruptionState();
  for (const time of [70, 25, 300.5, 36.2, 18, 41.7]) wandering.update(time, true);
  for (const time of [30, 36.2, 41.7, FIRST_DISRUPTION + DISRUPTION_INTERVAL + 13]) {
    fresh.update(time, true); wandering.update(time, true);
    assert.deepEqual(snapshot(wandering), snapshot(fresh));
  }
});

test('events repeat on schedule and are not all identical', () => {
  const state = createDisruptionState();
  const angles = new Set();
  for (let id = 0; id < 6; id++) {
    state.update(FIRST_DISRUPTION + id * DISRUPTION_INTERVAL + 10, true);
    assert.equal(state.stream.active, true);
    angles.add(state.stream.edgeAngle.toFixed(3));
  }
  assert.ok(angles.size > 3);
});

test('wide screens bring the star in from the left, narrow ones from below', () => {
  const state = createDisruptionState();
  state.update(FIRST_DISRUPTION + 5, true);
  const wide = streamPoint(state.stream.edgeAngle, 9 * 9);
  state.update(FIRST_DISRUPTION + 5, false);
  const narrow = streamPoint(state.stream.edgeAngle, 9 * 9);
  // Screen angles are clockwise with y pointing down.
  assert.ok(Math.cos(wide.angle) < -0.8, 'far out on the left');
  assert.ok(Math.sin(narrow.angle) > 0.8, 'far out below');
});

test('the path is one smooth curve with no corner, and nothing is drawn once absorbed', () => {
  // Direction of travel along the path, sampled at even steps of length.
  const position = (radius) => {
    const point = streamPoint(1, radius * radius);
    return [Math.cos(point.angle) * radius, Math.sin(point.angle) * radius, point.angle];
  };
  let previous = position(12), heading = null, sharpest = 0;
  for (let radius = 11.995; radius > 2.3; radius -= 0.005) {
    const here = position(radius);
    assert.ok(here[2] >= previous[2], 'always clockwise');
    const direction = Math.atan2(here[1] - previous[1], here[0] - previous[0]);
    const step = Math.hypot(here[0] - previous[0], here[1] - previous[1]);
    if (heading !== null) {
      const turn = Math.abs(Math.atan2(Math.sin(direction - heading), Math.cos(direction - heading)));
      sharpest = Math.max(sharpest, turn / step);
    }
    heading = direction; previous = here;
  }
  // Turn per unit of length. A corner would be a spike; the tightest part of
  // this path is its last winding into the disk, a circle of radius above 2.
  assert.ok(sharpest < 0.5, `sharpest curvature ${sharpest.toFixed(3)}`);
  assert.equal(streamPresence(2.3), 0);
  assert.equal(streamPresence(1.5), 0);
  assert.equal(streamPresence(6), 1);
});
