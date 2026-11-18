import { PLANET, STAR, bodyRadius, bodyReach, bodyGirth, type createOpeningState } from './blackHoleOpening';

type Opening = ReturnType<typeof createOpeningState>;

/**
 * The bodies of the opening, drawn into the black hole's own GPU surface: three
 * planets as small shaded spheres lit by their star, and the star itself. The
 * tides take the side nearest the hole first, so each is drawn out forwards,
 * into the mouth of its own stream, further and finer until it is the stream.
 * It never shrinks away or fades: there is no moment at which it disappears.
 * Each is a single quad, so this costs nothing to speak of, and only while the
 * opening plays.
 */
export function createBodiesRenderer(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
  const program = gl.createProgram();
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  const fragment = gl.createShader(gl.FRAGMENT_SHADER);
  if (!program || !vertex || !fragment) {
    gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment);
    return null;
  }
  gl.shaderSource(vertex, `#version 300 es
    precision highp float;
    uniform vec2 uViewport;
    uniform vec2 uAt;
    uniform float uExtent;
    out vec2 vLocal;
    void main() {
      vec2 corner = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
      vLocal = corner * uExtent;
      vec2 p = (uAt + vLocal) / uViewport * 2.0 - 1.0;
      gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
    }
  `);
  gl.shaderSource(fragment, `#version 300 es
    precision highp float;
    uniform float uRadius;    // of the body, in CSS pixels
    uniform float uExtent;    // half the width of what is drawn, in CSS pixels
    uniform float uPixel;     // CSS pixels per device pixel
    uniform vec2 uAxis;       // the way it is going on screen: its near side is drawn out that way
    uniform float uStretch;   // how far the tides have got with it: 0 whole, 1 a teardrop
    uniform float uReach;     // how many of its radii its near side now reaches ahead
    uniform float uGirth;     // how narrow it has become across: 1 whole, towards 0 as it drains
    uniform float uBend;      // the curve of its path over that reach: 1 / radius of the arc, in radii of the body
    uniform vec3 uLight;      // towards its star: screen x and y (y down), z towards the viewer
    uniform float uLook;      // 0 banded giant, 1 ringed giant, 2 small ice world, 9 the star
    uniform float uAlpha;
    in vec2 vLocal;
    out vec4 color;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1)), u.x), u.y);
    }

    void main() {
      // The tides draw out the leading side and narrow it towards a point; as
      // the body drains the whole of it follows, longer and finer, along the
      // curve of its own path, until it is a thread of the stream. The far
      // side is the last to go.
      vec2 across = vec2(-uAxis.y, uAxis.x);
      float forward = dot(vLocal, uAxis) / uRadius;
      float side = dot(vLocal, across) / uRadius;
      if (abs(uBend) > 0.002) {
        // Measure along and across the arc of the path, not a straight line.
        float arc = 1.0 / uBend, turn = sign(arc);
        vec2 fromCentre = vec2(forward, arc - side);
        forward = atan(fromCentre.x, turn * fromCentre.y) * abs(arc);
        side = arc - turn * length(fromCentre);
      }
      float lead = max(forward, 0.0);
      float ahead = lead / uReach;
      float behind = min(forward, 0.0) / mix(0.3, 1.0, uGirth);
      vec2 q = vec2(behind + ahead, side / (uGirth * (1.0 - 0.45 * uStretch * smoothstep(0.0, 1.0, ahead))));
      float d = length(q);
      float aa = 1.2 * uPixel / (uRadius * uGirth);
      float drain = 1.0 - uGirth;

      if (uLook > 8.5) {
        // The star: in truth ten times the width of its largest planet, and
        // here at least the largest body. A photosphere that darkens and
        // reddens towards its limb, finely mottled; a close corona and a faint
        // wide glow. It is light, so it is added to the scene.
        float disc = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
        float mu = sqrt(max(1.0 - d * d, 0.0));
        float grain = 0.6 * noise(q * 7.0 + 3.0) + 0.4 * noise(q * 15.0);
        vec3 light = mix(vec3(1.0, 0.64, 0.28), vec3(1.0, 0.95, 0.84), pow(mu, 0.7))
          * (0.60 + 0.40 * mu) * (0.95 + 0.10 * grain) * disc;
        // Its corona and glow go into the stream with it.
        float beyond = max(d - 1.0, 0.0);
        light += vec3(1.0, 0.80, 0.52) * (0.50 * exp(-beyond / 0.28) + 0.16 * exp(-beyond / 1.3) + 0.045 * exp(-beyond / 4.0))
          * (1.0 - disc) * (1.0 - 0.85 * smoothstep(0.1, 0.9, drain));
        // No lens stands between this star and the eye, so it has no cross of
        // light (the owner asked for that to go). Its corona thins out all
        // round it instead, in soft streamers of uneven length, as the Sun's
        // does in an eclipse. Whole turns only, so they close without a seam.
        vec2 s = vLocal / uRadius;
        float around = atan(s.y, s.x), away = max(length(s) - 1.0, 0.0);
        float streamers = 0.5 + 0.22 * sin(5.0 * around + 1.3) + 0.16 * sin(9.0 * around + 4.1) + 0.12 * sin(16.0 * around + 2.2);
        light += vec3(1.0, 0.86, 0.64) * 0.11 * exp(-away / (1.2 + 2.6 * streamers)) * (1.0 - disc) * (1.0 - uStretch);
        // Exactly nothing at the edge of what is drawn, so no edge can show.
        light *= uAlpha * (1.0 - smoothstep(0.72, 1.0, length(vLocal) / uExtent));
        color = vec4(light, max(light.r, max(light.g, light.b)));
        return;
      }

      float body = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, d);
      // The sphere's surface normal, turned back into screen directions.
      float nz = sqrt(max(1.0 - d * d, 0.0));
      vec3 n = vec3(q.x * uAxis + q.y * across, nz);
      float facing = dot(n, uLight);
      // A soft terminator: lit crescent, dark night side.
      float lit = smoothstep(-0.10, 0.30, facing) * (0.30 + 0.70 * max(facing, 0.0));

      // Each world has its own axis; latitude gives bands, longitude breaks them up.
      vec3 pole = normalize(uLook < 0.5 ? vec3(0.42, -0.86, 0.28) : uLook < 1.5 ? vec3(-0.34, -0.90, 0.28) : vec3(0.15, -0.95, 0.27));
      float lat = dot(n, pole);
      vec3 east = normalize(cross(pole, vec3(0.0, 0.0, 1.0)));
      float lon = atan(dot(n, east), dot(n, cross(pole, east)));
      vec3 surface;
      if (uLook < 0.5) {
        float bands = 0.5 + 0.5 * sin(lat * 10.0 + 0.9 * sin(lon * 2.0 + 1.3) + 2.2 * noise(vec2(lon * 1.5, lat * 6.0)));
        surface = mix(vec3(0.90, 0.74, 0.54), vec3(0.58, 0.33, 0.22), bands);
        surface = mix(surface, vec3(0.96, 0.88, 0.74), 0.35 * smoothstep(0.55, 0.9, noise(vec2(lon * 3.0, lat * 14.0))));
      } else if (uLook < 1.5) {
        float bands = 0.5 + 0.5 * sin(lat * 14.0 + 0.5 * sin(lon * 3.0));
        surface = mix(vec3(0.93, 0.85, 0.66), vec3(0.74, 0.61, 0.43), bands * 0.8);
      } else {
        surface = mix(vec3(0.36, 0.60, 0.80), vec3(0.72, 0.88, 0.94), noise(vec2(lon * 2.0, lat * 5.0) + 7.0));
        surface = mix(surface, vec3(0.94, 0.97, 1.0), smoothstep(0.62, 0.82, abs(lat)));
      }
      vec3 paint = surface * lit * (0.62 + 0.38 * nz);
      // A thin bright atmosphere along the lit limb, and the faintest starlight on the night side.
      vec3 air = uLook < 1.5 ? vec3(1.0, 0.86, 0.66) : vec3(0.66, 0.86, 1.0);
      paint += air * pow(1.0 - nz, 3.0) * 0.55 * smoothstep(-0.2, 0.4, facing);
      paint += surface * 0.012;
      // Drawn fine, it glows as its stream does, in the same colour: by the end
      // the two cannot be told apart.
      vec3 hot = uLook < 0.5 ? vec3(1.0, 0.78, 0.54) : uLook < 1.5 ? vec3(1.0, 0.88, 0.66) : vec3(0.80, 0.91, 1.0);
      float heat = smoothstep(0.3, 0.93, drain);
      paint = mix(paint, hot * 0.75, heat);
      vec3 rgb = paint * body;
      float alpha = body;

      if (uLook > 0.5 && uLook < 1.5) {
        // Rings: a flat band of ice, tilted, in front of the planet on the near
        // side and hidden behind it on the far side. The tides take them with
        // the planet: drawn out forwards (half as far for their size, so they
        // stay beside the body), narrowed towards its stream, and gone into
        // it in the same way.
        float along = lead / (1.0 + 0.5 * (uReach - 1.0));
        vec2 drawn = vec2(behind + along, side / (uGirth * (1.0 - 0.6 * uStretch * smoothstep(0.0, 2.3, along))));
        vec2 whole = drawn.x * uAxis + drawn.y * across;
        vec2 major = vec2(0.94, -0.34), minor = vec2(0.34, 0.94);
        vec2 r = vec2(dot(whole, major), dot(whole, minor) / 0.30);
        float rho = length(r);
        float edge = 2.0 * aa;
        float band = smoothstep(1.42, 1.42 + edge + 0.04, rho) * (1.0 - smoothstep(2.28 - edge - 0.04, 2.28, rho));
        band *= 1.0 - 0.75 * smoothstep(0.045, 0.0, abs(rho - 1.93));
        band *= 0.55 + 0.45 * smoothstep(1.42, 1.9, rho);
        float inFront = step(0.0, dot(whole, minor));
        float seen = band * mix(1.0 - body, 1.0, inFront);
        float ringLight = 0.35 + 0.65 * smoothstep(-0.4, 0.5, dot(normalize(whole), uLight.xy));
        vec3 ring = mix(vec3(0.90, 0.82, 0.66) * 0.62 * ringLight, hot * 0.6, heat);
        rgb = mix(rgb, ring, seen * 0.85);
        alpha = max(alpha, seen * 0.8);
      }
      // It is a solid thing: it hides what is behind it.
      color = vec4(rgb, alpha) * uAlpha;
    }
  `);
  gl.compileShader(vertex); gl.compileShader(fragment);
  gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
  const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!linked) console.error('[blackhole] bodies shader:', gl.getShaderInfoLog(fragment) || gl.getProgramInfoLog(program));
  gl.detachShader(program, vertex); gl.detachShader(program, fragment);
  gl.deleteShader(vertex); gl.deleteShader(fragment);
  if (!linked) { gl.deleteProgram(program); return null; }
  const uniforms = Object.fromEntries(
    ['uViewport', 'uAt', 'uExtent', 'uRadius', 'uPixel', 'uAxis', 'uStretch', 'uReach', 'uGirth', 'uBend', 'uLight', 'uLook', 'uAlpha']
      .map((name) => [name, gl.getUniformLocation(program, name)]));
  let width = 1, height = 1, cx = 0, cy = 0, horizon = 1;
  const smooth = (from: number, to: number, value: number) => {
    const x = Math.max(0, Math.min(1, (value - from) / (to - from)));
    return x * x * (3 - 2 * x);
  };
  const place = (radius: number, angle: number) => [cx + Math.cos(angle) * radius * horizon, cy + Math.sin(angle) * radius * horizon];

  function begin() {
    gl.useProgram(program);
    gl.bindVertexArray(null);
    gl.uniform2f(uniforms.uViewport, width, height);
    gl.uniform1f(uniforms.uPixel, width / canvas.width);
    gl.enable(gl.BLEND);
  }

  return {
    resize(w: number, h: number, x: number, y: number, radius: number) {
      width = w; height = h; cx = x; cy = y; horizon = radius;
    },
    /** The planets: solid, so they hide the mouths of their own streams. */
    drawPlanets(opening: Opening) {
      if (!opening.active) return;
      const star = opening.bodies.find((body) => body.kind === STAR)!;
      const [sx, sy] = place(star.radius, star.angle);
      let started = false;
      for (const body of opening.bodies) {
        if (body.kind !== PLANET) continue;
        // It is there until it is as fine as its stream; only that last thread lets go.
        const alpha = (1 - smooth(0.93, 1, body.drained)) * body.presence;
        if (alpha < 0.003) continue;
        if (!started) { begin(); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); started = true; }
        const [x, y] = place(body.radius, body.angle);
        const radius = bodyRadius(body, horizon), reach = bodyReach(body);
        // Lit by its star, wherever the star is, a little from the viewer's side.
        const lx = sx - x, ly = sy - y, far = Math.hypot(lx, ly) || 1;
        gl.uniform2f(uniforms.uAt, x, y);
        gl.uniform1f(uniforms.uExtent, radius * Math.max(1.3 * reach, body.look === 1 ? 2.5 * (1 + 0.5 * (reach - 1)) : 0) + 4);
        gl.uniform1f(uniforms.uRadius, radius);
        gl.uniform2f(uniforms.uAxis, Math.cos(body.heading), Math.sin(body.heading));
        gl.uniform1f(uniforms.uStretch, body.stretch);
        gl.uniform1f(uniforms.uReach, reach);
        gl.uniform1f(uniforms.uGirth, bodyGirth(body));
        gl.uniform1f(uniforms.uBend, body.bend * radius / horizon);
        gl.uniform3f(uniforms.uLight, lx / far * 0.93, ly / far * 0.93, 0.37);
        gl.uniform1f(uniforms.uLook, body.look);
        gl.uniform1f(uniforms.uAlpha, alpha);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      if (started) gl.disable(gl.BLEND);
    },
    /** The star: light, so it goes on top of everything. */
    drawStar(opening: Opening) {
      if (!opening.active) return;
      const star = opening.bodies.find((body) => body.kind === STAR)!;
      // It pours into its stream, drawn as fine as the stream is: its light is the stream's by then.
      const alpha = (1 - 0.5 * smooth(0.5, 1, star.drained)) * (1 - smooth(0.93, 1, star.drained)) * star.presence;
      if (alpha < 0.003) return;
      begin(); gl.blendFunc(gl.ONE, gl.ONE);
      const [x, y] = place(star.radius, star.angle);
      const radius = bodyRadius(star, horizon), reach = bodyReach(star);
      gl.uniform2f(uniforms.uAt, x, y);
      gl.uniform1f(uniforms.uExtent, radius * Math.max(13, 1.6 * reach + 3));
      gl.uniform1f(uniforms.uRadius, radius);
      gl.uniform2f(uniforms.uAxis, Math.cos(star.heading), Math.sin(star.heading));
      gl.uniform1f(uniforms.uStretch, star.stretch);
      gl.uniform1f(uniforms.uReach, reach);
      gl.uniform1f(uniforms.uGirth, bodyGirth(star));
      gl.uniform1f(uniforms.uBend, star.bend * radius / horizon);
      gl.uniform3f(uniforms.uLight, 0, 0, 1);
      gl.uniform1f(uniforms.uLook, 9);
      gl.uniform1f(uniforms.uAlpha, alpha);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disable(gl.BLEND);
    },
    dispose() { gl.deleteProgram(program); },
  };
}
