import { streamPoint, streamPresence, type createDisruptionState } from './blackHoleDisruption';
import {
  OPENING_BODIES, STAR, FRAGMENT, openingPoint, bodyRadius, bodyGirth, type OpeningPoint, type createOpeningState,
} from './blackHoleOpening';

/** A visual clockwise flow, measured in apparent shadow radii (not a GR simulation). */
const RATE = 4.8;
const PITCH = 2.2;
const SEGMENTS = 26;
const STREAM_SEGMENTS = 128;
const STREAM_FINE = 320;
type Stream = ReturnType<typeof createDisruptionState>['stream'];
type Opening = ReturnType<typeof createOpeningState>;
/** Ribbons drawn at once: the disrupted star, or every body of the opening. */
const RIBBONS = 2 + OPENING_BODIES;
const TAU = Math.PI * 2;
const NORMAL = 1 / Math.hypot(1, PITCH);

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => { const x = clamp(v); return x * x * (3 - 2 * x); };
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

/** Draw the original material paths directly into the black hole's GPU surface. */
export function createInfallRenderer(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
  const program = gl.createProgram();
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  const fragment = gl.createShader(gl.FRAGMENT_SHADER);
  const vao = gl.createVertexArray();
  const vertexBuffer = gl.createBuffer(), indexBuffer = gl.createBuffer();
  if (!program || !vertex || !fragment || !vao || !vertexBuffer || !indexBuffer) {
    gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment);
    gl.deleteVertexArray(vao); gl.deleteBuffer(vertexBuffer); gl.deleteBuffer(indexBuffer);
    return null;
  }
  gl.shaderSource(vertex, `#version 300 es
    precision highp float;
    layout(location=0) in vec2 aPosition;
    layout(location=1) in vec2 aLocal;
    layout(location=2) in vec2 aShape;
    layout(location=3) in vec4 aColor;
    uniform vec2 uViewport;
    out vec2 vLocal;
    out vec2 vShape;
    out vec4 vColor;
    out vec2 vCenter;
    void main() {
      vec2 p = aPosition / uViewport * 2.0 - 1.0;
      gl_Position = vec4(p.x, -p.y, 0, 1);
      vLocal = aLocal; vShape = aShape; vColor = aColor;
      vCenter = aPosition - aLocal;
    }
  `);
  gl.shaderSource(fragment, `#version 300 es
    precision highp float;
    uniform vec2 uViewport;
    uniform vec2 uCenter;
    uniform float uHorizon;
    uniform float uDpr;
    in vec2 vLocal;
    in vec2 vShape;
    in vec4 vColor;
    in vec2 vCenter;
    out vec4 color;
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float strands(vec2 p) {
      vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1)), u.x), u.y);
    }
    void main() {
      bool head = vShape.y < 0.0;
      float heat = head ? -1.0 - vShape.y : vShape.y;
      float distance = head ? length(vLocal) : abs(vLocal.x);
      float radius = vShape.x;
      float pixelAA = 0.65 / uDpr;
      float aa = pixelAA;
      float arrival = 1.0;
      vec2 p = vec2(gl_FragCoord.x / uDpr, uViewport.y - gl_FragCoord.y / uDpr);
      if (head) {
        vec2 source = vCenter - uCenter;
        float r = length(source);
        arrival = smoothstep(1.0, 1.06, r / uHorizon);
        float lens = 1.0 - smoothstep(1.12, 1.65, r / uHorizon);
        if (lens > 0.0) {
          vec2 ray = p - uCenter;
          float imageRadius = length(ray);
          float angle = imageRadius > 0.0001
            ? atan(ray.y, ray.x) - atan(source.y, source.x) : 0.0;
          angle = mod(angle + 3.14159265359, 6.28318530718) - 3.14159265359;
          float radialScale = mix(1.0, 0.38, lens);
          float tangentialScale = mix(1.0, 6.0, lens);
          vec2 bent = vec2((imageRadius - r) / radialScale, angle * r / tangentialScale);
          distance = mix(distance, length(bent), lens);
          // Filter the compressed radial width rather than letting it flicker
          // between rows of pixels as the curved image moves toward the shadow.
          aa /= radialScale;
        }
      }
      float core = (1.0 - smoothstep(radius - aa, radius + aa, distance))
        * min(1.0, radius / aa);
      float spread = 0.6 + heat * 1.4;
      float glow = exp(-pow(max(0.0, distance - radius) / spread, 2.0))
        * heat * 0.22 * min(1.0, radius);
      if (!head && vLocal.y > 0.5) {
        // A stream of matter, not a drawn line: fine strands run along it.
        core *= 0.70 + 0.60 * strands(vec2(vLocal.y * 0.045, vLocal.x * 1.2 + heat * 7.0));
        glow *= 0.80 + 0.40 * strands(vec2(vLocal.y * 0.018, heat * 3.0));
      }
      float outside = smoothstep(-pixelAA, pixelAA, length(p - uCenter) - uHorizon);
      vec3 light = vColor.rgb * core + vec3(1.0, 0.75, 0.44) * glow;
      vec3 emission = light * vColor.a * outside * arrival;
      // Additive ribbons also need coverage on a transparent canvas. Keeping
      // RGB <= alpha preserves their light when the browser composites the sky.
      color = vec4(emission, max(emission.r, max(emission.g, emission.b)));
    }
  `);
  gl.compileShader(vertex); gl.compileShader(fragment);
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
  gl.detachShader(program, vertex); gl.detachShader(program, fragment);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!linked) {
    gl.deleteProgram(program); gl.deleteVertexArray(vao);
    gl.deleteBuffer(vertexBuffer); gl.deleteBuffer(indexBuffer);
    return null;
  }
  const uniforms = Object.fromEntries(['uViewport', 'uCenter', 'uHorizon', 'uDpr']
    .map(name => [name, gl.getUniformLocation(program, name)]));
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
  const vertices = new Float32Array((stars.length * ((SEGMENTS + 1) * 2 + 4) + RIBBONS * ((STREAM_SEGMENTS + 1) * 2 + 4)) * 10);
  const indices = new Uint16Array((stars.length * (SEGMENTS + 1) + RIBBONS * (STREAM_SEGMENTS + 1)) * 6);
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices.byteLength, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices.byteLength, gl.DYNAMIC_DRAW);
  for (const [index, size, offset] of [[0, 2, 0], [1, 2, 8], [2, 2, 16], [3, 4, 24]]) {
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(index, size, gl.FLOAT, false, 40, offset);
  }
  gl.bindVertexArray(null);
  let vertexCount = 0, indexCount = 0;
  // The red of what is being drawn: full for every light here but a stream of ice.
  let red = 1;
  // What a ribbon is at one point along it: half its width in pixels, and its light.
  let half = 0, light = 0;
  // x, y and presence along a stream: finely sampled, then evenly spaced.
  const fine = new Float32Array((STREAM_FINE + 1) * 3), fineLength = new Float32Array(STREAM_FINE + 1);
  const path = new Float32Array((STREAM_SEGMENTS + 1) * 3);
  function addVertex(x: number, y: number, lx: number, ly: number, radius: number,
    kind: number, green: number, blue: number, alpha: number) {
    const at = vertexCount++ * 10;
    vertices[at] = x; vertices[at + 1] = y;
    vertices[at + 2] = lx; vertices[at + 3] = ly;
    vertices[at + 4] = radius; vertices[at + 5] = kind;
    vertices[at + 6] = red; vertices[at + 7] = green; vertices[at + 8] = blue;
    vertices[at + 9] = alpha;
  }
  function quad(a: number, b: number, c: number, d: number) {
    indices[indexCount++] = a; indices[indexCount++] = b; indices[indexCount++] = c;
    indices[indexCount++] = c; indices[indexCount++] = b; indices[indexCount++] = d;
  }
  // Lay one ribbon along the path sampled into fine (x, y, how much of the matter
  // is still its own). Its points are placed at equal steps of length, so curved
  // stretches get as many as straight ones and its shape is even along what is
  // seen. The shape gives its width and light at each point, from the leading
  // end (0) to the other (1). It takes the disk's own orange as it is absorbed.
  function ribbon(heat: number, coolRed: number, coolGreen: number, coolBlue: number, shape: (along: number) => void) {
    for (let i = 1; i <= STREAM_FINE; i++) {
      fineLength[i] = fineLength[i - 1] + Math.hypot(fine[i * 3] - fine[i * 3 - 3], fine[i * 3 + 1] - fine[i * 3 - 2]);
    }
    const total = fineLength[STREAM_FINE];
    for (let j = 0, k = 0; j <= STREAM_SEGMENTS; j++) {
      const target = total * j / STREAM_SEGMENTS;
      while (k < STREAM_FINE - 1 && fineLength[k + 1] < target) k++;
      const step = fineLength[k + 1] - fineLength[k];
      const mix = step > 0 ? Math.min(1, (target - fineLength[k]) / step) : 0;
      for (let c = 0; c < 3; c++) path[j * 3 + c] = fine[k * 3 + c] + (fine[k * 3 + 3 + c] - fine[k * 3 + c]) * mix;
    }
    for (let j = 0; j <= STREAM_SEGMENTS; j++) {
      const along = j / STREAM_SEGMENTS;
      const before = Math.max(0, j - 1) * 3, after = Math.min(STREAM_SEGMENTS, j + 1) * 3;
      const tx = path[after] - path[before], ty = path[after + 1] - path[before + 1];
      const length = Math.hypot(tx, ty) || 1;
      const nx = -ty / length, ny = tx / length;
      const x = path[j * 3], y = path[j * 3 + 1], presence = path[j * 3 + 2];
      shape(along);
      const extent = half + 2 + heat * 5;
      red = 1 + (coolRed - 1) * presence;
      const green = 0.60 + (coolGreen - 0.60) * presence, blue = 0.26 + (coolBlue - 0.26) * presence;
      const alpha = light * presence;
      // The distance along the stream goes with each point: the shader uses it
      // to give the stream the fine strands of flowing matter.
      const run = 1 + total * along;
      const at = vertexCount;
      addVertex(x + nx * extent, y + ny * extent, extent, run, half, heat, green, blue, alpha);
      addVertex(x - nx * extent, y - ny * extent, -extent, run, half, heat, green, blue, alpha);
      if (j > 0) quad(at - 2, at - 1, at, at + 1);
    }
    red = 1;
  }
  // A stream led by its brightest matter: pointed at the leading end, widest
  // just behind it, tapering to the tail.
  const comet = (thickness: number, brightness: number) => (along: number) => {
    half = thickness * (1 - along) ** 0.7 * ease(along / 0.035) + 0.25;
    light = brightness * (0.25 + 0.75 * (1 - along) ** 1.5) * (1 - along) ** 0.6;
  };
  // A tongue of matter drawn off the near side of a body, from its leading tip
  // back to the body: a thread in front, opening out to the body's own width
  // where it leaves it, and fainter there, where the same matter is spread
  // wider. As the body drains (fed falls to 0) the mouth closes, and what is
  // left is the thread, pointed at both ends.
  const tongue = (thread: number, mouth: number, fed: number, brightness: number) => (along: number) => {
    // A long fine point in front, however short the tongue still is.
    const closing = fed + (1 - fed) * ease((1 - along) / 0.2);
    const open = fed * along ** 2.4;
    half = (thread * (0.25 + 0.75 * ease(along / 0.45)) + Math.max(0, mouth - thread) * open) * ease(along / 0.05) * closing + 0.25;
    light = brightness * ease(along / 0.12) * closing * (0.55 + 0.45 * (1 - along)) * (1 - 0.6 * open);
  };
  // A round point of light at the leading end of a ribbon.
  function head(x: number, y: number, radius: number, heat: number, alpha: number) {
    const extent = radius + 2 + heat * 5;
    const at = vertexCount;
    addVertex(x - extent, y - extent, -extent, -extent, radius, -1 - heat, 0.96, 0.96, alpha);
    addVertex(x + extent, y - extent, extent, -extent, radius, -1 - heat, 0.96, 0.96, alpha);
    addVertex(x - extent, y + extent, -extent, extent, radius, -1 - heat, 0.96, 0.96, alpha);
    addVertex(x + extent, y + extent, extent, extent, radius, -1 - heat, 0.96, 0.96, alpha);
    quad(at, at + 1, at + 2, at + 3);
  }
  const sample: OpeningPoint = { radius: 0, angle: 0, presence: 0 };

  return {
    resize(w: number, h: number, x: number, y: number, radius: number) {
      width = w; height = h; cx = x; cy = y; horizon = radius;
    },
    draw(time: number, stream?: Stream, gain = 1, opening?: Opening, wide = false) {
      vertexCount = 0; indexCount = 0;
      const count = gain <= 0 ? 0 : width < 720 ? 65 : stars.length;
      for (let i = 0; i < count; i++) {
        const star = stars[i];
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
        const alpha = star.brightness * clamp(age / 1.4) * gain;
        const green = ((star.warm ? 215 : 232) * (1 - heat) + 248 * heat) / 255;
        const blue = ((star.warm ? 175 : 255) * (1 - heat) + 205 * heat) / 255;
        if (heat > 0) {
          for (let j = 0; j <= SEGMENTS; j++) {
            const material = first + (1 - first) * j / SEGMENTS;
            const point = materialPoint(headSquared, star.tail, phase, material);
            const cos = Math.cos(point.angle), sin = Math.sin(point.angle);
            const px = cx + cos * point.radius * horizon;
            const py = cy + sin * point.radius * horizon;
            const nx = (PITCH * cos - sin) * NORMAL;
            const ny = (cos + PITCH * sin) * NORMAL;
            const half = star.size * (0.65 + heat * 0.4) * (1 - material) ** 1.4;
            const extent = half + 2 + heat * 5;
            const at = vertexCount;
            addVertex(px + nx * extent, py + ny * extent, extent, 0, half, heat, green, blue, alpha * heat);
            addVertex(px - nx * extent, py - ny * extent, -extent, 0, half, heat, green, blue, alpha * heat);
            if (j > 0) quad(at - 2, at - 1, at, at + 1);
          }
        }
        if (first === 0 && x > -10 && x < width + 10 && y > -10 && y < height + 10) {
          const radius = star.size * (1 - heat * 0.25);
          // Only the sprite footprint changes: the approved material path and
          // timing remain continuous through the transition into a curved arc.
          const lensAt = clamp((head.radius - 1.12) / (1.65 - 1.12));
          const lens = 1 - lensAt * lensAt * (3 - 2 * lensAt);
          const extent = (radius + 2 + heat * 5) * (1 + 5 * lens);
          const at = vertexCount;
          addVertex(x - extent, y - extent, -extent, -extent, radius, -1 - heat, green, blue, alpha);
          addVertex(x + extent, y - extent, extent, -extent, radius, -1 - heat, green, blue, alpha);
          addVertex(x - extent, y + extent, -extent, extent, radius, -1 - heat, green, blue, alpha);
          addVertex(x + extent, y + extent, extent, extent, radius, -1 - heat, green, blue, alpha);
          quad(at, at + 1, at + 2, at + 3);
        }
      }
      if (stream?.active) {
        // The disrupted star: one long ribbon along its own path, dissolving
        // where it enters the disk.
        const { edgeAngle, headSquared, span, first, stretch, brightness } = stream;
        const heat = 0.4 + 1.0 * stretch;
        for (let i = 0; i <= STREAM_FINE; i++) {
          const point = streamPoint(edgeAngle, headSquared + span * (first + (1 - first) * i / STREAM_FINE));
          fine[i * 3] = cx + Math.cos(point.angle) * point.radius * horizon;
          fine[i * 3 + 1] = cy + Math.sin(point.angle) * point.radius * horizon;
          fine[i * 3 + 2] = streamPresence(point.radius);
        }
        ribbon(heat, 1, 0.96, 0.96 * (1 - 0.35 * stretch), comet(1.6 - 0.8 * stretch, brightness));
        if (first === 0) head(fine[0], fine[1], 1.9 - 0.9 * stretch, heat, brightness * fine[2]);
      }
      if (opening?.active) {
        // The opening's bodies. The tides take the near side of a planet or of
        // the star first: its matter runs ahead along the path the body is
        // about to take, a tongue that winds onto the body's orbit and fades
        // as it spreads into the ring, while the body follows at its own even
        // pace and drains into it. The small rocks lead their own streams.
        for (let k = 0; k < opening.bodies.length; k++) {
          const body = opening.bodies[k];
          const rock = body.kind === FRAGMENT;
          const size = bodyRadius(body, horizon);
          if (body.reach > 0.01) {
            let any = 0;
            for (let i = 0; i <= STREAM_FINE; i++) {
              openingPoint(k, wide, body.since - body.reach * i / STREAM_FINE, sample);
              fine[i * 3] = cx + Math.cos(sample.angle) * sample.radius * horizon;
              fine[i * 3 + 1] = cy + Math.sin(sample.angle) * sample.radius * horizon;
              fine[i * 3 + 2] = sample.presence;
              any += sample.presence;
            }
            if (any > 0.001) {
              // A wisp leaves the near side first; its mouth opens as the body pours in
              // after it, and narrows again with the body as the body is drawn fine.
              const fed = 1 - body.drained, rise = Math.min(1, body.stretch * 6);
              const mouth = size * bodyGirth(body) * ease(body.stretch * 1.6);
              if (body.kind === STAR) {
                // Glowing gas around a white-hot core.
                ribbon(3.2, 1, 0.80, 0.52, tongue(0.5, 0.5, fed, 0.5 * rise));
                ribbon(0.8 + 1.0 * body.stretch, 1, 0.97, 0.90, tongue(1.15, 0.6 * mouth, fed, 1.6 * rise));
              } else if (rock) {
                ribbon(0.6, 1, 0.94, 0.86, comet(0.7, body.look * body.stretch));
              } else {
                // Dust, rock and ice, each in its world's own colour: softer and dimmer than the star's.
                const [r, g, b] = body.look === 0 ? [1, 0.78, 0.54] : body.look === 1 ? [1, 0.88, 0.66] : [0.80, 0.91, 1];
                ribbon(1.5, r, g, b, tongue(0.7, 0.7 * mouth, fed, 0.8 * rise));
              }
            }
          }
          if (rock && body.presence > 0.001) {
            // At rest it is one more faint point in the sky; it brightens as it falls.
            head(cx + Math.cos(body.angle) * body.radius * horizon, cy + Math.sin(body.angle) * body.radius * horizon,
              size * (1 - 0.55 * body.drained), 0.5, body.look * body.presence * (0.45 + 0.55 * body.stretch));
          }
        }
      }
      gl.useProgram(program);
      gl.uniform2f(uniforms.uViewport, width, height);
      gl.uniform2f(uniforms.uCenter, cx, cy);
      gl.uniform1f(uniforms.uHorizon, horizon);
      gl.uniform1f(uniforms.uDpr, canvas.width / width);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices, 0, vertexCount * 10);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, indices, 0, indexCount);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.BLEND); gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteProgram(program); gl.deleteVertexArray(vao);
      gl.deleteBuffer(vertexBuffer); gl.deleteBuffer(indexBuffer);
    },
  };
}
