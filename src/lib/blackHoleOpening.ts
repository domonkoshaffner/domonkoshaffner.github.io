/**
 * The opening: on arrival the disk is not there yet. Matter rushes in and the
 * ring grows from its inner edge outward along spiral arms, strand by strand,
 * then settles into the ordinary scene.
 *
 * It is a function of scene time, like every other event: the scene clock only
 * runs while the hero is visible and playing, so the opening plays when the
 * visitor first sees it, Pause freezes it, and it never plays twice in a visit.
 */
/** The scene clock starts here. */
export const SCENE_START = 18;
/** Seconds until the scene is exactly the ordinary one. Mirrors OPENING in the disk shader. */
export const OPENING_DURATION = 7.0;
/** What the shader is given once the opening is over: any value past its end. */
export const OPENING_OVER = 1000;

const RUSH_TIME = 4.8;     // how long the streaks stay hurried
const RUSH_GAIN = 8.0;     // seconds of extra travel they are given in that time

/** Seconds since the opening began; OPENING_OVER once it has finished. */
export function openingAge(time: number) {
  const age = time - SCENE_START;
  return age < OPENING_DURATION ? Math.max(0, age) : OPENING_OVER;
}

/**
 * Extra travel time for the infalling streaks: they start several times faster
 * than usual and ease to their normal speed, then keep the head start, so
 * nothing ever jumps or runs backwards.
 */
export function openingRush(time: number) {
  const left = 1 - Math.min(1, Math.max(0, time - SCENE_START) / RUSH_TIME);
  return RUSH_GAIN * (1 - left * left);
}

/** The hurried streaks are also brighter, easing to their normal light. */
export function openingStreakGain(time: number) {
  const left = 1 - Math.min(1, Math.max(0, time - SCENE_START) / RUSH_TIME);
  return 1 + 0.9 * left;
}
