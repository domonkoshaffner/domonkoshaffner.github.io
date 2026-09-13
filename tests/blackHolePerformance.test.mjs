import test from 'node:test';
import assert from 'node:assert/strict';
import { createBloomCadence } from '../src/lib/blackHolePerformance.ts';

const playback = (budget, seconds, fps) => {
  for (let i = 0; i < seconds * fps; i++) budget.sample(1000 / fps);
};

test('120 Hz playback refreshes glow at 60 Hz without depending on frame count', () => {
  const budget = createBloomCadence();
  let updates = 0;
  for (let frame = 0; frame < 1200; frame++) if (budget.shouldUpdate(18 + frame / 120)) updates++;
  assert.equal(updates, 600);
  assert.equal(budget.shouldUpdate(50), true);
  assert.equal(budget.shouldUpdate(50), false);
  assert.equal(budget.shouldUpdate(18), true);
});

test('ordinary 60 Hz playback, occasional stalls and brief pressure retain full glow cadence', () => {
  const budget = createBloomCadence();
  for (let minute = 0; minute < 5; minute++) {
    playback(budget, 58, 60);
    budget.sample(500);
    playback(budget, 2, 30);
  }
  assert.equal(budget.rate, 60);
});

test('sustained slow playback reduces only glow cadence and does not oscillate', () => {
  const budget = createBloomCadence();
  playback(budget, 7, 40);
  assert.equal(budget.rate, 60);
  playback(budget, 3, 40);
  assert.equal(budget.rate, 30);
  playback(budget, 180, 120);
  assert.equal(budget.rate, 30);
  let updates = 0;
  for (let i = 0; i < 120; i++) if (budget.shouldUpdate(18 + i / 120)) updates++;
  assert.equal(updates, 30);
});

test('below 30 fps, glow refreshes at 15 Hz while the scene can keep rendering every frame', () => {
  const budget = createBloomCadence();
  playback(budget, 10, 25);
  assert.equal(budget.rate, 15);
  let updates = 0;
  for (let frame = 0; frame < 250; frame++) if (budget.shouldUpdate(18 + frame / 25)) updates++;
  assert.equal(updates, 150);
  playback(budget, 180, 120);
  assert.equal(budget.rate, 15);
});

test('a device that slows further can take a second step without reallocating anything', () => {
  const budget = createBloomCadence();
  playback(budget, 10, 40);
  assert.equal(budget.rate, 30);
  playback(budget, 7, 25);
  assert.equal(budget.rate, 15);
});

test('pause and background gaps cannot join two separate slow periods', () => {
  const budget = createBloomCadence();
  playback(budget, 6, 30);
  budget.resume();
  playback(budget, 6, 30);
  assert.equal(budget.rate, 60);
  playback(budget, 5, 60);
  assert.equal(budget.rate, 60);
});

test('resize and context recovery rebuild the glow at the same frozen scene time', () => {
  const budget = createBloomCadence();
  assert.equal(budget.shouldUpdate(18), true);
  assert.equal(budget.shouldUpdate(18), false);
  budget.invalidate();
  assert.equal(budget.shouldUpdate(18), true);
});
