/** Sparse, deterministic heating events carried by the existing plasma flow. */
const TAU = Math.PI * 2;
const FIRST_BIRTH = 17; // The scene starts at 18, with the first knot already beginning to emerge.
const INTERVAL = 20;
const DRIFT = 0.22 / 6.4; // Same inward material speed as flowCoordinates in the shader.
const hash = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
const smooth = (from: number, to: number, value: number) => {
  const x = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return x * x * (3 - 2 * x);
};
const angularVelocity = (r: number) => 0.045 + 0.32 * (2.6 / r) ** 1.35;
const angularGradient = (r: number) => -0.32 * 1.35 * (2.6 / r) ** 1.35 / r;

export function createHotspotState() {
  // Each event: radius, angle, radial shear, strength; widths: radial, angular.
  const parameters = new Float32Array(8);
  const widths = new Float32Array(4);
  const events = Array.from({ length: 2 }, () => ({
    id: -Infinity, birth: 0, lifetime: 0, radius: 0, angle: 0, width: 0, strength: 0,
  }));

  return {
    parameters, widths,
    update(time: number) {
      const latest = Math.floor((time - FIRST_BIRTH) / INTERVAL);
      for (let slot = 0; slot < 2; slot++) {
        const id = latest - slot;
        const at = slot * 4, sizeAt = slot * 2;
        parameters[at + 3] = 0;
        if (id < 0) continue;
        const event = events[slot];
        if (event.id !== id) {
          event.id = id;
          event.birth = FIRST_BIRTH + id * INTERVAL + (id === 0 ? 0 : hash(id + 17) * 4);
          event.lifetime = 24 + hash(id + 31) * 4;
          // Place the knots in the darker mid-disk so they can be followed
          // clearly against the already-brilliant inner filaments.
          event.radius = id === 0 ? 5.2 : 4.75 + hash(id + 53) * 1.10;
          event.angle = id === 0 ? 1.3 : hash(id + 79) * TAU;
          event.width = 0.19 + hash(id + 97) * 0.075;
          event.strength = 0.95 + hash(id + 113) * 0.20;
        }
        const age = time - event.birth;
        if (age <= 0 || age >= event.lifetime) continue;
        const progress = age / event.lifetime;
        const envelope = smooth(0, 0.18, progress) * (1 - smooth(0.55, 1, progress));
        const r = event.radius - DRIFT * age;
        const middle = (r + event.radius) * 0.5;
        // Integrate the same orbital-speed profile as the disk along the slow
        // inward drift. Its radial derivative bends the knot into a trailing arc.
        const angle = event.angle + age / 6 * (angularVelocity(event.radius)
          + 4 * angularVelocity(middle) + angularVelocity(r));
        const shear = age / 6 * (angularGradient(event.radius)
          + 4 * angularGradient(middle) + angularGradient(r));
        parameters[at] = r;
        parameters[at + 1] = ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
        parameters[at + 2] = shear;
        parameters[at + 3] = envelope * event.strength;
        widths[sizeAt] = event.width * (1 + 0.25 * progress);
        widths[sizeAt + 1] = 0.095 + 0.27 * smooth(0.08, 0.90, progress);
      }
    },
  };
}
