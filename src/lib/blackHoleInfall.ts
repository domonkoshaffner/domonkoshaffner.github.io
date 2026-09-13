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
    void main() {
      vec2 p = aPosition / uViewport * 2.0 - 1.0;
      gl_Position = vec4(p.x, -p.y, 0, 1);
      vLocal = aLocal; vShape = aShape; vColor = aColor;
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
    out vec4 color;
    void main() {
      bool head = vShape.y < 0.0;
      float heat = head ? -1.0 - vShape.y : vShape.y;
      float distance = head ? length(vLocal) : abs(vLocal.x);
      float radius = vShape.x;
      float aa = 0.65 / uDpr;
      float core = (1.0 - smoothstep(radius - aa, radius + aa, distance))
        * min(1.0, radius / aa);
      float spread = 0.6 + heat * 1.4;
      float glow = exp(-pow(max(0.0, distance - radius) / spread, 2.0))
        * heat * 0.22 * min(1.0, radius);
      vec2 p = vec2(gl_FragCoord.x / uDpr, uViewport.y - gl_FragCoord.y / uDpr);
      float outside = smoothstep(-aa, aa, length(p - uCenter) - uHorizon);
      vec3 light = vColor.rgb * core + vec3(1.0, 0.75, 0.44) * glow;
      color = vec4(light * vColor.a * outside, 0.0);
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
  const vertices = new Float32Array(stars.length * ((SEGMENTS + 1) * 2 + 4) * 10);
  const indices = new Uint16Array(stars.length * (SEGMENTS + 1) * 6);
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
  function addVertex(x: number, y: number, lx: number, ly: number, radius: number,
    kind: number, green: number, blue: number, alpha: number) {
    const at = vertexCount++ * 10;
    vertices[at] = x; vertices[at + 1] = y;
    vertices[at + 2] = lx; vertices[at + 3] = ly;
    vertices[at + 4] = radius; vertices[at + 5] = kind;
    vertices[at + 6] = 1; vertices[at + 7] = green; vertices[at + 8] = blue;
    vertices[at + 9] = alpha;
  }
  function quad(a: number, b: number, c: number, d: number) {
    indices[indexCount++] = a; indices[indexCount++] = b; indices[indexCount++] = c;
    indices[indexCount++] = c; indices[indexCount++] = b; indices[indexCount++] = d;
  }
  return {
    resize(w: number, h: number, x: number, y: number, radius: number) {
      width = w; height = h; cx = x; cy = y; horizon = radius;
    },
    draw(time: number) {
      vertexCount = 0; indexCount = 0;
      const count = width < 720 ? 65 : stars.length;
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
        const alpha = star.brightness * clamp(age / 1.4);
        const green = ((star.warm ? 215 : 232) * (1 - heat) + 248 * heat) / 255;
        const blue = ((star.warm ? 175 : 255) * (1 - heat) + 205 * heat) / 255;
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
          const extent = radius + 2 + heat * 5;
          const at = vertexCount;
          for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            addVertex(x + sx * extent, y + sy * extent, sx * extent, sy * extent,
              radius, -1 - heat, green, blue, alpha);
          }
          quad(at, at + 1, at + 2, at + 3);
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
