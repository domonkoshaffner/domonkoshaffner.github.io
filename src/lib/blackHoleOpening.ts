/**
 * The opening: on arrival there is no disk, only a plain starry sky with a
 * black hole in it, and a small star system at rest beside it: a star, three
 * planets and a few small rocks. After a moment the hole's pull tells. One by
 * one the bodies start to move, slowly at first, then faster. Nothing falls
 * into the hole. Each body is caught on a path that winds down onto a circular
 * orbit; the side of it nearest the hole is pulled ahead first, into a tongue
 * of matter that runs on along the path while the body, held back, follows at
 * an even pace and drains into it, and that matter spreads into the ring. The
 * ring grows outward from where the star's matter settles.
 *
 * Everything is a function of scene time, like every other event: the scene
 * clock only runs while the hero is visible and playing, so the opening plays
 * when the visitor first sees it, Pause freezes it, and it never plays twice
 * in a visit. Positions are in apparent shadow radii on screen, with angles
 * clockwise and y pointing down, as in the streak renderer.
 */
const TAU = Math.PI * 2;

/** The scene clock starts here. */
export const SCENE_START = 18;
/** Seconds until the scene is exactly the ordinary one. Mirrors OPENING in the disk shader. */
export const OPENING_DURATION = 10.5;
/** What the shader is given once the opening is over: any value past its end. */
export const OPENING_OVER = 1000;

/** How fast caught matter circles the hole, in radians per second. Mirrors TURN in the disk shader. */
export const TURN = 3.5;
/** How much a path turns per unit of log distance from its orbit, once it is close in. */
const PITCH = 0.9;
/** A body's fall goes as this power of the time since it began to move: from rest, gently, then fast. */
const GATHER = 2.5;
/** Matter starts to spread into the ring after turning this far past being caught, and has merged by the second. */
const SETTLE_FROM = 2.2, SETTLE_BY = 4.6;
/**
 * The ring begins to light where the front of a stream is once it has turned
 * this far past being caught, and from there the light keeps pace with that
 * front. Sooner than the stream starts to fade: the owner found the disk came
 * up a little late after the streams, so it now starts under them.
 */
const LIGHT_FROM = 0.8;
/** A body drains into its stream between these times, before and after the front of its matter is caught. */
const DRAIN_FROM = 0.35, DRAIN_BY = 0.95;
/** A rock is drawn out behind itself from this long before it is caught to this long after. */
const PULL_FROM = 0.8, PULL_BY = 0.25;

export const PLANET = 0, STAR = 1, FRAGMENT = 2;

type Body = {
  kind: number;
  hold: number;      // seconds into the opening before it begins to move
  fall: number;      // seconds from then until the front of its matter is caught at its orbit's pace
  wide: [number, number];     // where it rests on a wide screen: radius and angle
  narrow: [number, number];   // and on a narrow one
  orbit: number;     // radius of the circular orbit it is caught on
  reach: number;     // seconds of path a rock is drawn out over
  pace: number;      // the most shadow radii a second the body of a planet or of the star is seen to move at
  size: number;      // radius of the body itself, in shadow radii
  look: number;      // which planet, or how bright a rock
  share: number;     // how much of the ring's matter it brings
};
const at = (x: number, y: number): [number, number] => [Math.hypot(x, y), Math.atan2(y, x)];

/**
 * The system. It rests in the open sky to the upper left of the hole: well
 * clear of it on a wide screen, in the corner of the frame on a narrow one.
 * The planets go first and leave thin rings at their own orbits; the star,
 * the heaviest, holds out longest and brings almost all of the matter; the
 * rocks that were scattered round it follow it in.
 */
const BODIES: Body[] = [
  { kind: PLANET, hold: 1.0, fall: 2.2, wide: at(-6.6, -2.2), narrow: at(-2.3, -2.9), orbit: 2.20, reach: 0, pace: 3.4, size: 0.140, look: 0, share: 0.30 },
  { kind: PLANET, hold: 1.3, fall: 2.4, wide: at(-7.1, -0.5), narrow: at(-3.55, -1.0), orbit: 1.55, reach: 0, pace: 3.4, size: 0.175, look: 1, share: 0.34 },
  { kind: PLANET, hold: 1.6, fall: 2.6, wide: at(-7.7, -2.55), narrow: at(-2.0, -1.9), orbit: 2.50, reach: 0, pace: 4.0, size: 0.105, look: 2, share: 0.26 },
  { kind: STAR, hold: 2.0, fall: 2.4, wide: at(-8.4, -1.5), narrow: at(-3.4, -2.85), orbit: 1.80, reach: 0, pace: 4.0, size: 0.30, look: 0, share: 1 },
  { kind: FRAGMENT, hold: 4.4, fall: 1.9, wide: at(-9.3, -0.4), narrow: at(-3.0, -0.2), orbit: 2.15, reach: 0.45, pace: 0, size: 0.012, look: 0.9, share: 0 },
  { kind: FRAGMENT, hold: 4.9, fall: 1.9, wide: at(-10.0, -2.3), narrow: at(-3.9, -2.0), orbit: 2.50, reach: 0.40, pace: 0, size: 0.010, look: 0.7, share: 0 },
  { kind: FRAGMENT, hold: 5.4, fall: 1.8, wide: at(-6.1, -1.2), narrow: at(-1.6, -3.2), orbit: 1.95, reach: 0.45, pace: 0, size: 0.011, look: 0.8, share: 0 },
  { kind: FRAGMENT, hold: 5.9, fall: 1.8, wide: at(-9.9, -1.2), narrow: at(-3.9, -3.2), orbit: 2.75, reach: 0.40, pace: 0, size: 0.009, look: 0.6, share: 0 },
  { kind: FRAGMENT, hold: 6.4, fall: 1.7, wide: at(-8.0, -0.2), narrow: at(-3.0, -0.9), orbit: 2.30, reach: 0.40, pace: 0, size: 0.010, look: 0.75, share: 0 },
  { kind: FRAGMENT, hold: 6.9, fall: 1.7, wide: at(-9.0, -2.9), narrow: at(-2.7, -3.3), orbit: 2.85, reach: 0.35, pace: 0, size: 0.009, look: 0.6, share: 0 },
];
export const OPENING_BODIES = BODIES.length;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (from: number, to: number, value: number) => {
  const x = clamp((value - from) / (to - from));
  return x * x * (3 - 2 * x);
};
const rest = (body: Body, wide: boolean) => (wide ? body.wide : body.narrow);

/**
 * Where a body is caught: the radius at which its fall has brought it exactly
 * to the turning speed of its orbit, at the moment its fall ends. From there on
 * it circles at that speed while closing in on the orbit, so its path and its
 * pace are both smooth all the way. Found once for each layout and body.
 */
const caught = [true, false].map((wide) => BODIES.map((body) => {
  const start = rest(body, wide)[0];
  // Turning speed at the end of the fall, less the orbit's own: zero where the two match.
  const mismatch = (radius: number) =>
    (start ** 2 - radius ** 2) * (GATHER / 2) * PITCH / (body.fall * radius * (radius - body.orbit)) - TURN;
  let low = body.orbit + 1e-4, high = start - 1e-4;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (mismatch(mid) > 0) low = mid; else high = mid;
  }
  const radius = (low + high) / 2;
  return { radius, progress: -Math.log((radius - body.orbit) / (start - body.orbit)) };
}));

/**
 * The turn a path has made by a given progress along it. A body at rest falls
 * straight towards the hole at first; its path bends more and more as it
 * closes in, and winds onto its orbit.
 */
const turned = (along: number) => PITCH * (along - 1 + Math.exp(-along));

/** How far along its path the front of a body's matter is, a given time after the body began to move. */
function progress(index: number, wide: boolean, since: number) {
  const body = BODIES[index], end = caught[wide ? 0 : 1][index];
  if (since <= 0) return 0;
  if (since >= body.fall) return end.progress + TURN / PITCH * (since - body.fall);
  const start = rest(body, wide)[0];
  const radius = Math.sqrt(start ** 2 - (start ** 2 - end.radius ** 2) * (since / body.fall) ** GATHER);
  return -Math.log((radius - body.orbit) / (start - body.orbit));
}

export type OpeningPoint = { radius: number; angle: number; presence: number };

/**
 * Where the front of a body's matter is a given time after the body began to
 * move (before that it is at rest), and how much of it is still its own:
 * presence fades to nothing as it spreads into the ring. The rest of its
 * matter follows the same path later.
 */
export function openingPoint(index: number, wide: boolean, since: number, out: OpeningPoint) {
  const body = BODIES[index], [start, angle] = rest(body, wide);
  const along = progress(index, wide, since);
  out.radius = body.orbit + (start - body.orbit) * Math.exp(-along);
  out.angle = angle + turned(along);
  out.presence = 1 - smooth(SETTLE_FROM, SETTLE_BY, turned(along) - turned(caught[wide ? 0 : 1][index].progress));
  return out;
}

/** How far a rock has been drawn out behind itself. */
const pulled = (index: number, since: number) =>
  smooth(BODIES[index].fall - PULL_FROM, BODIES[index].fall + PULL_BY, since);

/**
 * How far along that path the body of a planet or of the star has got itself.
 * The front of its matter is pulled on faster and faster; the body is never
 * seen to rush. It is held to its own pace, eased in so that it gathers speed
 * and then keeps it. The gap between the two is the tongue of matter drawn off
 * its near side. Once the body has drained, what was its place is the free end
 * of the stream, which is let go to follow the rest. Worked out once for each
 * layout and body, in steps of STEP seconds.
 */
const STEP = 1 / 240, HELD_FOR = 7;
const held = [true, false].map((wide) => BODIES.map((body, index) => {
  if (body.kind === FRAGMENT) return null;
  const own = new Float32Array(Math.round(HELD_FOR / STEP) + 1);
  const a: OpeningPoint = { radius: 0, angle: 0, presence: 0 }, b: OpeningPoint = { radius: 0, angle: 0, presence: 0 };
  for (let i = 1; i < own.length; i++) {
    const here = own[i - 1];
    // How fast matter moves where the body now is,
    openingPoint(index, wide, here + 0.002, a); openingPoint(index, wide, Math.max(here - 0.002, 0), b);
    const speed = Math.hypot(Math.cos(a.angle) * a.radius - Math.cos(b.angle) * b.radius,
      Math.sin(a.angle) * a.radius - Math.sin(b.angle) * b.radius) / (here + 0.002 - Math.max(here - 0.002, 0));
    // and how much of that the body is allowed: all of it while slow, never more than its pace.
    const kept = 1 / Math.sqrt(1 + (speed / body.pace) ** 2);
    const freed = smooth(body.fall + DRAIN_BY - 0.3, body.fall + DRAIN_BY + 0.5, i * STEP);
    own[i] = here + STEP * (kept + (1 - kept) * freed);
  }
  return own;
}));
function bodyTime(index: number, wide: boolean, since: number) {
  const own = held[wide ? 0 : 1][index];
  if (!own || since <= 0) return since;
  const at = since / STEP, i = Math.floor(at);
  if (i >= own.length - 1) return own[own.length - 1] + since - HELD_FOR;
  return own[i] + (own[i + 1] - own[i]) * (at - i);
}

/** Seconds since the opening began; OPENING_OVER once it has finished. */
export function openingAge(time: number) {
  const age = time - SCENE_START;
  return age < OPENING_DURATION ? Math.max(0, age) : OPENING_OVER;
}

/**
 * The ordinary infalling streaks belong to the finished scene. During the
 * opening the system has the sky to itself; they fade in as the ring completes.
 */
export function openingStreakGain(time: number) {
  return smooth(7.8, 10.3, time - SCENE_START);
}

export type OpeningBody = {
  kind: number; look: number; size: number;
  since: number;         // seconds since it began to move (negative while it rests): where the front of its matter is
  reach: number;         // seconds of path its matter is now drawn out over, back from that front
  radius: number; angle: number;   // where the body itself is: a rock at the front, a planet or the star at the back
  heading: number;       // screen angle of the way it is going, or is about to go
  presence: number;      // how much of it has yet to spread into the ring
  stretch: number;       // how far the tides have got with it
  drained: number;       // how much of the body has gone into its stream
  bend: number;          // the curve of its path over the length it is drawn out to: 1 / radius of the arc, in shadow radii
};

/**
 * The radius of a body at rest, in CSS pixels: never so small that it stops
 * reading as what it is. Nothing here is to scale (the star is ten times the
 * width of a giant planet, and next to this hole a planet would be less than a
 * pixel), but the order is true: the star is the largest body, then the giants.
 */
export function bodyRadius(body: OpeningBody, horizon: number) {
  const least = body.kind === STAR ? 11 : body.kind === FRAGMENT ? 0.9 : body.look === 1 ? 7 : body.look === 0 ? 5.6 : 4.4;
  return Math.max(least, body.size * horizon);
}

/**
 * A planet or the star does not shrink away or fade as it drains: it is
 * drawn out. Its near side reaches this many of its own radii ahead along its
 * path, more and more,
 */
export const bodyReach = (body: OpeningBody) => 1 + 1.5 * body.stretch + 4.5 * body.drained ** 2;
/**
 * while across it narrows to this share of its width, until what is left is
 * as fine as the stream it has become. Nothing is left to disappear.
 */
export const bodyGirth = (body: OpeningBody) => 1 - 0.93 * smooth(0, 1, body.drained);

export function createOpeningState() {
  const bodies: OpeningBody[] = BODIES.map((body) => ({
    kind: body.kind, look: body.look, size: body.size,
    since: -1, radius: 0, angle: 0, heading: 0, presence: 1, stretch: 0, reach: 0, drained: 0, bend: 0,
  }));
  // For the disk shader: when each planet's and the star's matter starts to
  // settle, at which angle of the disk, at which disk radius, and how much.
  const seeds = new Float32Array(16);
  const point: OpeningPoint = { radius: 0, angle: 0, presence: 0 };
  let seededFor: boolean | null = null;

  return {
    bodies, seeds,
    /** True while there is anything of the opening to draw. */
    active: false,
    update(time: number, wide: boolean) {
      const age = time - SCENE_START;
      this.active = age >= 0 && age < OPENING_DURATION;
      if (seededFor !== wide) {
        seededFor = wide;
        for (let k = 0; k < 4; k++) {
          const body = BODIES[k], end = caught[wide ? 0 : 1][k];
          // How long after being caught the front of its matter has turned far enough to light the ring.
          let low = 0, high = 3;
          for (let i = 0; i < 40; i++) {
            const mid = (low + high) / 2;
            if (turned(end.progress + TURN / PITCH * mid) - turned(end.progress) < LIGHT_FROM) low = mid; else high = mid;
          }
          seeds[k * 4] = body.hold + body.fall + high;
          // The disk's own angle runs half a turn from the screen's.
          const screen = rest(body, wide)[1] + turned(end.progress) + LIGHT_FROM;
          seeds[k * 4 + 1] = ((screen + Math.PI) % TAU + TAU) % TAU;
          // Apparent radius on screen to radius in the disk, for this face-on view.
          seeds[k * 4 + 2] = 2.598 * body.orbit - 0.8;
          seeds[k * 4 + 3] = body.share;
        }
      }
      for (let k = 0; k < BODIES.length; k++) {
        const body = bodies[k], spec = BODIES[k], rock = spec.kind === FRAGMENT;
        body.since = age - spec.hold;
        const own = bodyTime(k, wide, body.since);
        body.reach = rock ? spec.reach * pulled(k, body.since) : body.since - own;
        // Its heading, even at rest: the way it will first move.
        const moving = Math.max(own, 0.3);
        openingPoint(k, wide, moving + 0.02, point);
        const nx = Math.cos(point.angle) * point.radius, ny = Math.sin(point.angle) * point.radius;
        openingPoint(k, wide, moving, point);
        body.heading = Math.atan2(ny - Math.sin(point.angle) * point.radius, nx - Math.cos(point.angle) * point.radius);
        openingPoint(k, wide, own, point);
        body.radius = point.radius; body.angle = point.angle;
        body.presence = this.active ? point.presence : 0;
        // The tides have taken hold once its matter is a third of a second ahead of it.
        body.stretch = rock ? pulled(k, body.since) : smooth(0.02, 0.34, body.reach);
        body.drained = smooth(spec.fall - DRAIN_FROM, spec.fall + DRAIN_BY, body.since);
        // Drawn out, the body lies along its path, and the path curves. Take
        // the arc that leaves the body the way it is heading and passes
        // through where the path really is at the body's far end, so its tip
        // meets its own stream.
        body.bend = 0;
        if (!rock) {
          const x = Math.cos(point.angle) * point.radius, y = Math.sin(point.angle) * point.radius;
          const ax = Math.cos(body.heading), ay = Math.sin(body.heading);
          const length = Math.max(0.3, bodyReach(body) * spec.size);
          let along = 0, aside = 0;
          for (let ahead = 0.01; ahead < 1.2; ahead += 0.01) {
            openingPoint(k, wide, moving + ahead, point);
            const dx = Math.cos(point.angle) * point.radius - x, dy = Math.sin(point.angle) * point.radius - y;
            along = dx * ax + dy * ay; aside = dy * ax - dx * ay;
            if (Math.hypot(dx, dy) >= length) break;
          }
          // No path here bends more tightly than the smallest orbit; and a
          // body the tides have not touched is simply round.
          if (along > 0.02) {
            body.bend = Math.max(-0.7, Math.min(0.7, 2 * aside / (along * along + aside * aside))) * Math.min(1, body.stretch * 4);
          }
        }
      }
    },
  };
}
