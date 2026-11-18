import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMERA_DISTANCE, SHADOW_EDGE, DIMMING_REACH, STAR_DIMMING, sweep, starImage, computeStarDimming,
} from '../src/lib/blackHoleLensing.ts';
import { DISK_INNER } from '../src/lib/blackHoleDisk.ts';
import { geometryShader } from '../src/lib/blackHoleShaders.ts';

test('light paths: far from the hole they are bent by the weak-field amount, and inside the shadow\'s edge they are captured', () => {
  // With no bending a path sweeps pi less the angle it is seen at; a distant path
  // is bent by two Schwarzschild radii over its impact parameter, a little more for
  // a camera this close.
  for (const b of [40, 80, 160]) {
    const straight = Math.PI - Math.asin(b / CAMERA_DISTANCE > 1 ? 1 : b / CAMERA_DISTANCE);
    if (b > CAMERA_DISTANCE) continue;
    assert.ok(sweep(b) > straight);
  }
  const far = 12, bent = sweep(far) - (Math.PI - Math.asin(far * Math.sqrt(1 - 1 / CAMERA_DISTANCE) / CAMERA_DISTANCE));
  assert.ok(bent > 0.9 * 2 / far && bent < 2.2 * 2 / far, `a path ${far} radii out is bent by about ${(2 / far).toFixed(3)} rad, found ${bent.toFixed(3)}`);
  assert.equal(sweep(SHADOW_EDGE - 0.01), null, 'just inside the edge light falls in');
  assert.ok(sweep(SHADOW_EDGE + 0.01) > 1.5 * Math.PI, 'just outside it winds most of the way round first');
  assert.ok(Math.abs(SHADOW_EDGE - 3 * Math.sqrt(3) / 2) < 1e-12);
});

test('in the gap between the shadow and the disk a background star is tens to hundreds of times fainter', () => {
  // The disk's inner edge is seen at an impact parameter of about its radius plus 0.8.
  const innerEdge = DISK_INNER + 0.8;
  for (let b = SHADOW_EDGE + 0.05; b < innerEdge; b += 0.05) {
    const image = starImage(b);
    assert.ok(image.across < 0.12, `squeezed across the ring at ${b.toFixed(2)}`);
    // Only in hair-thin rings right at the shadow, where a star sits exactly behind the hole, does one flare.
    if (b > SHADOW_EDGE + 0.2) assert.ok(image.brightness < 0.06, `no brighter than a twentieth at ${b.toFixed(2)}`);
  }
  assert.ok(starImage(SHADOW_EDGE + 0.4).brightness < 0.01, 'a hundredth, close in');
  // Well out, lensing leaves a star about as bright as it is, or brightens it.
  for (const b of [6.5, 8, 10]) assert.ok(starImage(b).brightness > 0.95);
});

test('the table the shaders use is what the light paths give', () => {
  const fresh = computeStarDimming(STAR_DIMMING.length);
  assert.equal(fresh.length, STAR_DIMMING.length);
  fresh.forEach((value, i) => assert.ok(Math.abs(value - STAR_DIMMING[i]) < 0.002 + 0.02 * value, `entry ${i}: ${STAR_DIMMING[i]} against ${value.toFixed(4)}`));
  for (let i = 1; i < STAR_DIMMING.length; i++) assert.ok(STAR_DIMMING[i] >= STAR_DIMMING[i - 1], 'stars only brighten outward');
  assert.ok(STAR_DIMMING[0] < 0.005 && STAR_DIMMING.at(-1) === 1);
  assert.ok(STAR_DIMMING[6] < 0.05, 'a twentieth or less everywhere inside the disk\'s inner edge');
  assert.ok(STAR_DIMMING.every((v) => v <= 1), 'never brighter than the star is');
  // Full brightness is back a little over two shadow radii out.
  const back = SHADOW_EDGE + (DIMMING_REACH - SHADOW_EDGE) * STAR_DIMMING.findIndex((v) => v === 1) / (STAR_DIMMING.length - 1);
  assert.ok(back / SHADOW_EDGE > 2 && back / SHADOW_EDGE < 2.5);
});

test('the sky shader carries the same table, camera and shadow', () => {
  assert.ok(geometryShader.includes(`float[${STAR_DIMMING.length}](${STAR_DIMMING.map((v) => v.toFixed(4)).join(', ')})`));
  assert.ok(geometryShader.includes(`const float D = ${CAMERA_DISTANCE.toFixed(1)};`));
  assert.ok(geometryShader.includes(`const float B_CRIT = ${SHADOW_EDGE.toFixed(3)};`));
  assert.ok(geometryShader.includes(`(${DIMMING_REACH.toFixed(1)} - B_CRIT)`));
  // Both skies use it: the one behind the disk and the one of the opening, before there is a disk.
  assert.equal(geometryShader.split('stars(dir) * starlight').length - 1, 1);
  assert.equal(geometryShader.split('stars(rd) * starlight').length - 1, 1);
});
