/** A visual clockwise flow, measured in apparent shadow radii (not a GR simulation). */
const RATE = 4.8;
const PITCH = 2.2;
const SEGMENTS = 26;
const TAU = Math.PI * 2;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const hash = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export function materialPoint(headSquared: number, tailSpan: number, phase: number, material: number) {
  const radius = Math.sqrt(Math.max(1, headSquared + tailSpan * material));
  return { radius, angle: phase - PITCH * Math.log(radius) };
}

export function firstVisibleMaterial(headSquared: number, tailSpan: number) {
  return clamp((1 - headSquared) / tailSpan);
}

export function createInfallRenderer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let width = 1, height = 1, cx = 0, cy = 0, horizon = 1;
  const stars = Array.from({ length: 110 }, (_, i) => ({
    size: 0.55 + hash(i + 10) * 0.85,
    brightness: 0.35 + hash(i + 80) * 0.65,
    radius: 5 + hash(i + 130) * 15,
    phase: hash(i + 240) * TAU,
    offset: hash(i + 390) * 80,
    tail: RATE * (0.3 + hash(i + 520) * 0.85),
    warm: hash(i + 700) > 0.8,
  }));
  const left = new Float32Array((SEGMENTS + 1) * 2);
  const right = new Float32Array((SEGMENTS + 1) * 2);

  return {
    resize(w: number, h: number, x: number, y: number, radius: number) {
      width = w; height = h; cx = x; cy = y; horizon = radius;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const backingWidth = Math.round(w * dpr), backingHeight = Math.round(h * dpr);
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth; canvas.height = backingHeight;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    draw(time: number) {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.moveTo(cx + horizon, cy);
      ctx.arc(cx, cy, horizon, 0, TAU);
      ctx.clip('evenodd');
      ctx.globalCompositeOperation = 'lighter';

      const count = width < 720 ? 65 : stars.length;
      for (let i = 0; i < count; i++) {
        const star = stars[i];
        // Continue the SAME material path after the head crosses the horizon.
        // Recycle only once its original tail has disappeared, with a soft entrance.
        const lifetime = (star.radius ** 2 - 1 + star.tail) / RATE;
        const elapsed = time + star.offset;
        const cycle = Math.floor(elapsed / lifetime);
        const age = elapsed - cycle * lifetime;
        const headSquared = star.radius ** 2 - RATE * age;
        const phase = star.phase + cycle * 2.399963 + PITCH * Math.log(star.radius);
        const first = firstVisibleMaterial(headSquared, star.tail);
        if (first >= 1) continue;
        const head = materialPoint(headSquared, star.tail, phase, first);
        const x = cx + Math.cos(head.angle) * head.radius * horizon;
        const y = cy + Math.sin(head.angle) * head.radius * horizon;
        const heat = clamp((5.5 - head.radius) / 4.5);
        const alpha = star.brightness * clamp(age / 1.4);
        const green = star.warm ? 215 : 232;
        const blue = Math.round((star.warm ? 175 : 255) * (1 - heat) + 205 * heat);
        ctx.fillStyle = `rgba(255,${Math.round(green + (248 - green) * heat)},${blue},${alpha})`;

        if (heat > 0) {
          for (let j = 0; j <= SEGMENTS; j++) {
            const material = first + (1 - first) * j / SEGMENTS;
            const point = materialPoint(headSquared, star.tail, phase, material);
            const cos = Math.cos(point.angle), sin = Math.sin(point.angle);
            const px = cx + cos * point.radius * horizon;
            const py = cy + sin * point.radius * horizon;
            const normal = 1 / Math.hypot(1, PITCH);
            const nx = (PITCH * cos - sin) * normal;
            const ny = (cos + PITCH * sin) * normal;
            const halfWidth = star.size * (0.65 + heat * 0.4) * (1 - material) ** 1.4;
            left[j * 2] = px + nx * halfWidth;
            left[j * 2 + 1] = py + ny * halfWidth;
            right[j * 2] = px - nx * halfWidth;
            right[j * 2 + 1] = py - ny * halfWidth;
          }
          ctx.globalAlpha = heat;
          ctx.shadowColor = 'rgba(255,191,112,0.65)';
          ctx.shadowBlur = heat * 5;
          ctx.beginPath();
          ctx.moveTo(left[0], left[1]);
          for (let j = 1; j <= SEGMENTS; j++) ctx.lineTo(left[j * 2], left[j * 2 + 1]);
          for (let j = SEGMENTS; j >= 0; j--) ctx.lineTo(right[j * 2], right[j * 2 + 1]);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        // Once swallowed, do not invent a replacement head on the rim.
        if (first === 0 && x > -10 && x < width + 10 && y > -10 && y < height + 10) {
          ctx.beginPath();
          ctx.arc(x, y, star.size * (1 - heat * 0.25), 0, TAU);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    },
  };
}
