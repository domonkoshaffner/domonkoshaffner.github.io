/**
 * What the hole's gravity does to the light of the stars behind it.
 *
 * The shaders already send every sight line along its true curved path, so a
 * background star is drawn where its light really arrives from. But bending
 * the paths also changes how large each star's image is. Close to the hole the
 * whole sky is folded into a narrow band: just outside the shadow a star's
 * image is squeezed a hundredfold or more across the band and severalfold
 * along it. A star is a point of light, so its image is then that many times
 * fainter. The stars there do not stay crisp: they sink into a faint, even
 * wash, and only come back to full strength about two shadow radii out.
 *
 * A star field looked up one pixel at a time cannot show this by itself (a
 * pixel either lands on a star or misses it), so the factor is worked out here
 * from the light paths and handed to the shaders as a short table.
 *
 * Lengths are in Schwarzschild radii, for a hole that does not spin.
 */

/** How far the camera is from the hole. Mirrors D in the shaders. */
export const CAMERA_DISTANCE = 15;
/** The impact parameter of the shadow's edge: 3√3/2. Mirrors B_CRIT in the shaders. */
export const SHADOW_EDGE = 3 * Math.sqrt(3) / 2;

/**
 * The whole angle a light path of impact parameter b sweeps round the hole,
 * from the camera out to the far sky; null if the hole captures it. The
 * orbit equation for light, u'' + u = 3/2 u² with u = 1/r, by Runge and Kutta.
 */
export function sweep(b: number, step = 5e-4): number | null {
  const pull = (u: number) => 1.5 * u * u - u;
  let u = 1 / CAMERA_DISTANCE, turned = 0;
  let du = Math.sqrt(Math.max(1 / (b * b) - u * u * (1 - u), 0));
  while (turned < 40) {
    const k1u = du, k1v = pull(u);
    const k2u = du + 0.5 * step * k1v, k2v = pull(u + 0.5 * step * k1u);
    const k3u = du + 0.5 * step * k2v, k3v = pull(u + 0.5 * step * k2u);
    const k4u = du + step * k3v, k4v = pull(u + step * k3u);
    const next = u + step / 6 * (k1u + 2 * k2u + 2 * k3u + k4u);
    // Out at infinity u is zero: stop exactly where the path crosses it, not a step late.
    if (next <= 0) return turned + step * u / (u - next);
    u = next;
    du += step / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
    turned += step;
    if (u > 1) return null;
  }
  return turned;
}

/** The angle from the camera's line to the hole at which a path of impact parameter b arrives. */
const seenAt = (b: number) => Math.asin(b * Math.sqrt(1 - 1 / CAMERA_DISTANCE) / CAMERA_DISTANCE);

/**
 * How a far star's image is changed where its light arrives with impact
 * parameter b: its length along the ring round the hole and its width across
 * it, both as multiples of what they would be with no hole there. Their
 * product is how much brighter (or, below one, fainter) the star appears.
 */
export function starImage(b: number) {
  const here = sweep(b), inside = sweep(b - 2e-3), outside = sweep(b + 2e-3);
  if (here === null || inside === null || outside === null) return null;
  // Which way the star really lies, measured round from straight behind the hole.
  const round = (here - Math.PI) % (2 * Math.PI);
  const behind = round <= Math.PI ? round : 2 * Math.PI - round;
  const along = Math.sin(seenAt(b)) / Math.max(Math.abs(Math.sin(behind)), 1e-9);
  const across = Math.abs((seenAt(b + 2e-3) - seenAt(b - 2e-3)) / (outside - inside));
  return { along, across, brightness: along * across };
}

/** The table runs from the shadow's edge to here; beyond, stars are as bright as they are. */
export const DIMMING_REACH = 6.2;

/**
 * How bright a background star is, against its true brightness, at even steps
 * of impact parameter from SHADOW_EDGE to DIMMING_REACH. Never above one:
 * where lensing brightens a star instead (in a thin ring about two shadow
 * radii out) its image is large enough to be drawn as it is. Each entry is the
 * average over its own step, which takes in the thin rings very close to the
 * shadow where single stars flare. The numbers are the output of
 * computeStarDimming below; a test works them out afresh and compares.
 */
export const STAR_DIMMING = [
  0.0015, 0.0032, 0.0058, 0.0104, 0.0172, 0.0268, 0.0399, 0.0576, 0.0813, 0.1126,
  0.1542, 0.2099, 0.2855, 0.3907, 0.5425, 0.7742, 0.9944, 1.0000, 1.0000, 1.0000,
];

/** The derivation of STAR_DIMMING. Takes a moment: it follows a few hundred light paths. */
export function computeStarDimming(count: number, within = 8): number[] {
  const width = (DIMMING_REACH - SHADOW_EDGE) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    let sum = 0, taken = 0;
    for (let k = 0; k < within; k++) {
      const b = SHADOW_EDGE + width * (i + (k + 0.5) / within - 0.5);
      if (b <= SHADOW_EDGE + 4e-3) { taken++; continue; }   // inside the shadow: no star at all
      const image = starImage(b);
      if (image) sum += Math.min(1, image.brightness);
      taken++;
    }
    return sum / taken;
  });
}
