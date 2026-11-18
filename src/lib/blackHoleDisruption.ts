/**
 * A tidal disruption, about once a minute. One star falls in on a steeper path
 * than the rest, is drawn out into a long stream, and feeds the disk, which
 * answers with a wave of heat that winds inward.
 *
 * Everything is a function of scene time, like the hot spots: Pause freezes the
 * event exactly and Play resumes the same one. Radii of the stream are in
 * apparent shadow radii on screen; the wave lives in disk coordinates.
 */
const TAU = Math.PI * 2;
/** Scene time of the first event. The scene starts at 18 and opens for 10 seconds; this follows it. */
export const FIRST_DISRUPTION = 30;
export const DISRUPTION_INTERVAL = 60;

const START = 12;          // where the star begins, far outside the frame
const EDGE = 3.5;          // the disk's outer edge: the path's angle is given here
const MERGE = 2.3;         // absorbed: nothing of the stream is drawn inside this
const LANDING = 3.4;       // the disk starts to answer when the head gets here
const FALL = 11;           // loss of radius² per second: faster than the ordinary streaks
// The path is one spiral whose pitch (turn per unit of log radius) grows
// smoothly as it closes in: nearly straight far out, winding into the disk's
// own flow at the edge, with no corner anywhere in between.
const PITCH_FAR = 0.45, PITCH_NEAR = 2.3, PITCH_POWER = 1.6;
const FULL_SPAN = 70;      // length of the fully drawn-out stream, in radius²
const WAVE_OUTER = 8.0, WAVE_INNER = 2.75;   // disk radii the heat travels between

const hash = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (from: number, to: number, value: number) => {
  const x = clamp((value - from) / (to - from));
  return x * x * (3 - 2 * x);
};
/** Same orbital-speed profile as the disk in the shader and the hot spots. */
const angularVelocity = (r: number) => 0.045 + 0.32 * (2.6 / r) ** 1.35;

/** Where the material at a given radius² sits on the stream's path. */
export function streamPoint(edgeAngle: number, squared: number) {
  const radius = Math.sqrt(Math.max(MERGE * MERGE, squared));
  // The integral of pitch(r) / r, with pitch = FAR + NEAR * (EDGE / r) ^ POWER.
  return {
    radius,
    angle: edgeAngle - PITCH_FAR * Math.log(radius / EDGE)
      + PITCH_NEAR / PITCH_POWER * ((EDGE / radius) ** PITCH_POWER - 1),
  };
}

/** How much of the material at this radius is still its own light, not yet the disk's. */
export const streamPresence = (radius: number) => smooth(MERGE, EDGE + 0.5, radius);

export function createDisruptionState() {
  // The stream, for the infall renderer.
  const stream = {
    active: false,
    edgeAngle: 0,      // screen angle (clockwise, y down) where it meets the disk's edge
    headSquared: 0,    // radius² of the leading end
    span: 0,           // length in radius²
    first: 0,          // fraction already absorbed, from the leading end
    stretch: 0,        // 0 = still a star, 1 = fully drawn out
    brightness: 0,
  };
  // The disk's answer, for the shaders: radius, angle, shear, strength; then
  // radial width and angular concentration.
  const wave = new Float32Array(4);
  const waveShape = new Float32Array(2);

  return {
    stream, wave, waveShape,
    update(time: number, wide: boolean) {
      // Start from nothing each time: the state is a function of time alone.
      stream.active = false;
      stream.edgeAngle = stream.headSquared = stream.span = stream.first = stream.stretch = stream.brightness = 0;
      wave.fill(0); waveShape.fill(0);
      const id = Math.floor((time - FIRST_DISRUPTION) / DISRUPTION_INTERVAL);
      if (id < 0) return;
      const age = time - (FIRST_DISRUPTION + id * DISRUPTION_INTERVAL);
      // Arrive where there is room to watch it: a long arc across the open
      // left on wide screens, up from below on narrow ones. Each event varies.
      const edgeAngle = Math.PI + (wide ? 1.05 + 0.35 * hash(id + 7) : -0.45 + 0.35 * hash(id + 7));

      const headSquared = START * START - FALL * age;
      const head = Math.sqrt(Math.max(MERGE * MERGE, headSquared));
      const stretch = smooth(7.2, 3.6, head);
      const span = 1.2 + FULL_SPAN * stretch;
      const first = clamp((MERGE * MERGE - headSquared) / span);
      if (first < 1) {
        stream.active = true;
        stream.edgeAngle = edgeAngle;
        stream.headSquared = headSquared;
        stream.span = span;
        stream.first = first;
        stream.stretch = stretch;
        // It enters the frame gently and is brightest while being pulled apart.
        stream.brightness = smooth(0, 2.5, age) * (0.9 + 0.7 * stretch);
      }

      // The wave starts as the head reaches the disk and outlives the stream.
      const sinceLanding = age - (START * START - LANDING * LANDING) / FALL;
      if (sinceLanding <= -0.5 || sinceLanding >= 12.5) return;
      const travel = smooth(0, 9, sinceLanding);
      const radius = WAVE_OUTER + (WAVE_INNER - WAVE_OUTER) * travel;
      const landingPhi = streamPoint(edgeAngle, LANDING * LANDING).angle + Math.PI;
      // Carried around with the disk, the inner part running ahead.
      const turned = Math.max(0, sinceLanding) * angularVelocity((radius + WAVE_OUTER) * 0.5);
      wave[0] = radius;
      wave[1] = ((landingPhi + turned + Math.PI) % TAU + TAU) % TAU - Math.PI;
      wave[2] = -0.10 - 0.05 * Math.max(0, sinceLanding);
      // The inner disk is already brilliant, so the surge eases as it arrives.
      wave[3] = smooth(-0.5, 1.5, sinceLanding) * (1 - smooth(9, 12.5, sinceLanding)) * (1 - 0.4 * travel);
      waveShape[0] = 0.75 - 0.25 * travel;
      waveShape[1] = 0.9;
    },
  };
}
