import test from 'node:test';
import assert from 'node:assert/strict';
import { DISK_INNER, INNER_TURN, angularVelocity, angularGradient } from '../src/lib/blackHoleDisk.ts';
import { materialShader, compositeShader, bloomSourceShader, geometryShader } from '../src/lib/blackHoleShaders.ts';
import { createHotspotState } from '../src/lib/blackHoleHotspots.ts';

test('the disk ends at the innermost stable circular orbit, three Schwarzschild radii out', () => {
  assert.equal(DISK_INNER, 3);
  for (const shader of [geometryShader, compositeShader, bloomSourceShader]) {
    assert.ok(shader.includes('const float R_IN = 3.0;'), 'the shaders draw with the same inner edge');
  }
});

test('the disk turns by Kepler\'s law exactly: the square of the period goes as the cube of the radius', () => {
  assert.equal(angularVelocity(DISK_INNER), INNER_TURN);
  for (let r = DISK_INNER; r <= 9.5; r += 0.25) {
    const period = 2 * Math.PI / angularVelocity(r);
    const expected = (2 * Math.PI / INNER_TURN) ** 2 * (r / DISK_INNER) ** 3;
    assert.ok(Math.abs(period ** 2 / expected - 1) < 1e-12, `at ${r} radii`);
    // Twice as far out, matter takes the square root of eight times as long to go round.
    assert.ok(Math.abs(angularVelocity(r) / angularVelocity(2 * r) - Math.sqrt(8)) < 1e-12);
    // The shear is the slope of that law.
    const slope = (angularVelocity(r + 1e-5) - angularVelocity(r - 1e-5)) / 2e-5;
    assert.ok(Math.abs(angularGradient(r) - slope) < 1e-7);
    assert.ok(angularGradient(r) < 0, 'the inner disk overtakes the outer');
  }
});

test('the shaders turn the disk by the same law, with the same numbers', () => {
  for (const shader of [compositeShader, bloomSourceShader]) {
    assert.ok(shader.includes(`float angularVelocity = ${INNER_TURN.toFixed(3)} * pow(R_IN / flowRadius, 1.5);`));
  }
  assert.ok(!materialShader.includes('flowRadius'), 'the plasma atlas itself does not turn');
});

test('a hot spot is carried round at the rate of the matter it sits in, and no faster', () => {
  const state = createHotspotState();
  // Follow the first knot for a few seconds in the middle of its life.
  const at = (time) => { state.update(time); return { r: state.parameters[0], angle: state.parameters[1], on: state.parameters[3] }; };
  const a = at(25), b = at(25.5);
  assert.ok(a.on > 0 && b.on > 0);
  let turn = b.angle - a.angle;
  if (turn < -Math.PI) turn += 2 * Math.PI;
  const rate = turn / 0.5, expected = angularVelocity((a.r + b.r) / 2);
  assert.ok(Math.abs(rate - expected) < 0.01 * expected, `turning at ${rate.toFixed(4)}, matter at ${expected.toFixed(4)}`);
  assert.ok(b.r < a.r, 'drifting slowly inward');
});
