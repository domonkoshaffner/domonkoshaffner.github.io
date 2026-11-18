/**
 * The disk's own numbers, in one place: the shaders draw with them, and the
 * hot spots and the wave of a tidal disruption move with them. Lengths are in
 * Schwarzschild radii.
 */

/** The innermost stable circular orbit, where the disk ends. */
export const DISK_INNER = 3;

/**
 * How fast matter at that inner edge turns, in radians per second. The scene
 * is a time-lapse: round a black hole of a million solar masses this orbit
 * takes about eight minutes, not eighteen seconds.
 */
export const INNER_TURN = 0.34;

/**
 * Matter on a circular orbit turns at a rate that falls as the 3/2 power of
 * its radius. That is Kepler's law, and round a black hole that does not spin
 * it holds exactly for circular orbits, in the time of a far observer, all the
 * way in to the innermost stable one.
 */
export const angularVelocity = (r: number) => INNER_TURN * (DISK_INNER / r) ** 1.5;

/** How that rate changes with radius: what shears a knot of matter into a trailing arc. */
export const angularGradient = (r: number) => -1.5 * angularVelocity(r) / r;
