import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENE_START, OPENING_DURATION, OPENING_OVER, openingAge, openingRush, openingStreakGain,
} from '../src/lib/blackHoleOpening.ts';
import { FIRST_DISRUPTION } from '../src/lib/blackHoleDisruption.ts';

test('the opening starts with the scene and is over for good after its duration', () => {
  assert.equal(openingAge(SCENE_START), 0);
  assert.ok(Math.abs(openingAge(SCENE_START + 1.5) - 1.5) < 1e-9);
  assert.ok(openingAge(SCENE_START + OPENING_DURATION - 0.001) < OPENING_DURATION);
  for (const later of [OPENING_DURATION + 0.001, 60, 3600]) {
    assert.equal(openingAge(SCENE_START + later), OPENING_OVER);
  }
  assert.ok(OPENING_OVER > OPENING_DURATION);
});

test('the opening is short and finishes before the first star is pulled apart', () => {
  assert.ok(OPENING_DURATION <= 7.5);
  assert.ok(SCENE_START + OPENING_DURATION < FIRST_DISRUPTION);
});

test('hurried streaks never jump or run backwards, and keep their head start', () => {
  let previous = SCENE_START + openingRush(SCENE_START);
  assert.equal(openingRush(SCENE_START), 0, 'no jump at the first frame');
  for (let time = SCENE_START + 0.01; time < SCENE_START + 9; time += 0.01) {
    const effective = time + openingRush(time);
    assert.ok(effective > previous, 'streak time always moves forward');
    assert.ok(effective - previous < 0.01 * 5.5, 'never more than a few times normal speed');
    previous = effective;
  }
  assert.equal(openingRush(SCENE_START + 12), openingRush(SCENE_START + 100));
});

test('streaks start brighter and ease to exactly their normal light', () => {
  assert.ok(openingStreakGain(SCENE_START) > 1.5);
  let previous = openingStreakGain(SCENE_START);
  for (let time = SCENE_START + 0.05; time < SCENE_START + 8; time += 0.05) {
    const gain = openingStreakGain(time);
    assert.ok(gain <= previous && gain >= 1);
    previous = gain;
  }
  assert.equal(openingStreakGain(SCENE_START + 6), 1);
});
