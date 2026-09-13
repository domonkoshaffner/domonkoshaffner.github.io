/** Stationary light paths, a seamless plasma atlas, and a cheap animated composite. */
export const vertexShader = `#version 300 es
  void main() {
    vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
  }
`;

const common = `
  precision highp float;
  precision highp int;
  const float PI = 3.14159265359;
  const float TAU = 6.28318530718;
  const float R_IN = 2.6;
  const float R_OUT = 9.5;
  const float B_CRIT = 2.598;
  const float D = 15.0;
  uniform vec2 uRes;
  uniform vec2 uCenter;
  uniform float uZoom;
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  vec2 hash22(vec2 p) {
    float n = hash21(p);
    return vec2(n, hash21(p + n + 17.17));
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x),
               mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1)), u.x), u.y);
  }
  vec2 pack16(float v) {
    float n = floor(clamp(v, 0.0, 1.0) * 65535.0 + 0.5);
    return vec2(floor(n / 256.0), mod(n, 256.0)) / 255.0;
  }
  float unpack16(vec2 v) { return dot(v, vec2(65280.0, 255.0)) / 65535.0; }
`;

// Calculated only at initialization or an actual viewport change. RGBA8 targets
// work without float-render-target extensions; each material coordinate is 16-bit.
export const geometryShader = `#version 300 es
${common}
  layout(location = 0) out vec4 firstHit;
  layout(location = 1) out vec4 secondHit;
  layout(location = 2) out vec4 transport;
  layout(location = 3) out vec4 background;
  const float R_BOUND = 13.0;

  vec3 stars(vec3 d) {
    vec2 sph = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)));
    vec3 col = vec3(0.0);
    {
      vec2 g = sph * 48.0;
      vec2 id = floor(g), f = fract(g), r = hash22(id);
      if (r.x < 0.14) {
        vec2 pos = 0.15 + 0.7 * hash22(id + 7.3);
        float dd = length(f - pos);
        float size = 0.035 + 0.05 * r.y;
        float pixel = 48.0 / (uRes.y * uZoom);
        float width2 = size * size + pixel * pixel * 0.35;
        float br = exp(-3.5 * dd * dd / width2) * size * size / width2;
        vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.9, 0.72), hash21(id + 3.3));
        // The background is a fixed sky. Only the separate infalling stars move.
        float brightness = 0.8 + 0.2 * sin(18.0 * (0.8 + 2.5 * r.y) + r.x * 60.0);
        col += tint * br * brightness * (0.6 + 0.8 * r.y);
      }
    }
    {
      vec2 g = sph * 130.0;
      vec2 id = floor(g), f = fract(g), r = hash22(id + 99.0);
      if (r.x < 0.22) {
        vec2 pos = 0.2 + 0.6 * hash22(id + 1.9);
        float pixel = 130.0 / (uRes.y * uZoom);
        float width2 = 0.0036 + pixel * pixel * 0.35;
        float br = exp(-3.5 * dot(f - pos, f - pos) / width2) * 0.0036 / width2;
        col += vec3(0.8, 0.86, 1.0) * br * 0.35;
      }
    }
    col += vec3(0.025, 0.045, 0.075)
      * pow(vnoise(sph * 3.0), 2.0) * vnoise(sph * 9.0 + 4.2)
      * (0.5 + vnoise(sph * 20.0 + 9.1)) * 0.08;
    return col;
  }

  vec4 hitCoordinates(vec3 p) {
    return vec4(pack16(length(p.xz) / R_OUT), pack16((atan(p.z, p.x) + PI) / TAU));
  }

  void main() {
    firstHit = vec4(0.0);
    secondHit = vec4(0.0);
    transport = vec4(0.0);
    background = vec4(0.0);
    vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y - uCenter;
    float elev = 1.50;
    vec3 ro = vec3(0.0, sin(elev) * D, -cos(elev) * D);
    vec3 fw = normalize(-ro);
    vec3 rt = normalize(cross(fw, vec3(0, 1, 0)));
    vec3 up = cross(rt, fw);
    vec3 rd = normalize(fw * uZoom + rt * uv.x + up * uv.y);
    float impact = length(cross(ro, rd));
    float pxb = 2.0 * D / (uRes.y * uZoom);
    if (impact <= B_CRIT - 0.6 * pxb) return;

    float edge = smoothstep(-0.6 * pxb, 0.6 * pxb, impact - B_CRIT);
    float margin = max(2.0 * pxb, 0.06);
    if (impact < B_CRIT + margin) {
      float safeImpact = B_CRIT + margin;
      float radius = uZoom * safeImpact / sqrt(D * D - safeImpact * safeImpact);
      vec2 safeUV = uv * radius / max(length(uv), 0.0001);
      rd = normalize(fw * uZoom + rt * safeUV.x + up * safeUV.y);
    }
    vec3 sky = stars(rd);
    if (impact > R_OUT + 1.0) {
      background = vec4(sqrt(clamp(sky * 0.25, 0.0, 1.0)), 1.0);
      return;
    }

    float b = dot(ro, rd);
    float h = b * b - (dot(ro, ro) - R_BOUND * R_BOUND);
    vec3 p = ro + rd * max(-b - sqrt(max(h, 0.0)), 0.0);
    vec3 v = rd;
    vec3 hv = cross(p, v);
    float h2 = dot(hv, hv);
    float opacity = 0.0, glow = 0.0;
    bool captured = false;
    int hits = 0;
    for (int i = 0; i < 280; i++) {
      float r2 = dot(p, p), r = sqrt(r2);
      if (r < 1.0) { captured = true; break; }
      if (r > R_BOUND && dot(p, v) > 0.0) break;
      float dt = clamp(0.008 + 0.025 * r, 0.03, 0.45);
      vec3 a = -1.5 * h2 * p / (r2 * r2 * r);
      vec3 pm = p + v * (0.5 * dt);
      vec3 vm = v + a * (0.5 * dt);
      float rm2 = dot(pm, pm);
      vec3 vn = v - 1.5 * h2 * pm / (rm2 * rm2 * sqrt(rm2)) * dt;
      vec3 pn = p + vm * dt;
      if (abs(p.y) < 1.5) {
        float rr = length(p.xz);
        glow += dt * exp(-p.y * p.y * 6.0)
          * smoothstep(R_IN - 0.5, R_IN + 1.0, rr)
          * (1.0 - smoothstep(R_OUT - 2.0, R_OUT + 1.0, rr))
          * pow(R_IN / max(rr, R_IN), 2.0);
      }
      if (p.y * pn.y < 0.0) {
        vec3 hit = mix(p, pn, p.y / (p.y - pn.y));
        float hr = length(hit.xz);
        if (hr > R_IN && hr < R_OUT) {
          float weight = (1.0 - opacity) * edge;
          vec3 tangent = vec3(-hit.z, 0.0, hit.x) / hr;
          float dop = sqrt(0.5 / hr) * dot(tangent, -normalize(vn));
          if (hits == 0) {
            firstHit = hitCoordinates(hit);
            transport.rg = vec2(weight, dop * 0.5 + 0.5);
          } else if (hits == 1) {
            secondHit = hitCoordinates(hit);
            transport.ba = vec2(weight, dop * 0.5 + 0.5);
          }
          hits++;
          float alpha = smoothstep(R_IN, R_IN + 0.25, hr)
            * (1.0 - smoothstep(R_OUT - 3.5, R_OUT, hr));
          opacity += (1.0 - opacity) * alpha;
        }
      }
      p = pn; v = vn;
      if (opacity > 0.985) break;
    }
    vec3 col = glow * vec3(1.0, 0.42, 0.12) * 0.07;
    if (!captured) col += (1.0 - opacity) * stars(normalize(v));
    col *= edge;
    float outerBlend = smoothstep(R_OUT + 0.3, R_OUT + 1.0, impact);
    col = mix(col, sky, outerBlend);
    transport.rb *= 1.0 - outerBlend;
    // A square-root encoding preserves very faint stars in ordinary RGBA8.
    background = vec4(sqrt(clamp(col * 0.25, 0.0, 1.0)), 1.0);
  }
`;

// A 2048², seamlessly periodic atlas with mipmaps: turbulence is generated once,
// then advected coherently. Filtering prevents subpixel filaments from sparkling.
export const materialShader = `#version 300 es
${common}
  out vec4 plasma;
  float pnoise(vec2 p, vec2 period) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
    vec2 i0 = mod(i, period), i1 = mod(i + 1.0, period);
    return mix(mix(hash21(i0), hash21(vec2(i1.x, i0.y)), u.x),
               mix(hash21(vec2(i0.x, i1.y)), hash21(i1), u.x), u.y);
  }
  float fbm(vec2 p, vec2 period) {
    float a = 0.5, s = 0.0;
    for (int k = 0; k < 4; k++) {
      s += a * pnoise(p, period);
      p = p * 2.0 + vec2(0, 13.7);
      period *= 2.0;
      a *= 0.5;
    }
    return s;
  }
  void main() {
    vec2 q = gl_FragCoord.xy / uRes * vec2(24.0, 80.0);
    float warp = fbm(q * vec2(1, 0.35), vec2(24, 28));
    float eddy = pnoise(q * vec2(2, 1.6), vec2(48, 128));
    vec2 flow = q + vec2(warp * 2.4, warp * 4.8 + eddy * 0.8);
    float broad = fbm(flow, vec2(24, 80));
    float fine = fbm(flow * vec2(2, 2.6), vec2(48, 208));
    float ridges = pow(1.0 - abs(2.0 * fine - 1.0), 8.0);
    float threads = smoothstep(0.45, 0.78, broad) + ridges * 0.55;
    float lanes = smoothstep(0.24, 0.62, broad);
    float energy = 0.08 + lanes * 0.65 + threads * threads * 5.0;
    plasma = vec4(broad, sqrt(energy / 14.0), clamp(threads - 0.65, 0.0, 0.65) / 0.65, 1.0);
  }
`;

// Shared by the full-resolution image and a small, separately filtered glow.
const diskLight = `
  uniform float uTime;
  uniform sampler2D uFirst;
  uniform sampler2D uSecond;
  uniform sampler2D uTransport;
  uniform sampler2D uBackground;
  uniform sampler2D uPlasma;
  uniform vec4 uHotSpots[2];
  uniform vec2 uHotSpotWidths[2];

  float localHeating(float r, float phi, vec2 radialDerivative, vec2 angularDerivative) {
    float heat = 0.0;
    for (int i = 0; i < 2; i++) {
      vec4 knot = uHotSpots[i];
      vec2 width = uHotSpotWidths[i];
      float dr = r - knot.x;
      if (knot.w <= 0.0 || abs(dr) > width.x * 4.5 + length(radialDerivative)) continue;
      float angle = phi - knot.y - knot.z * dr;
      angle = mod(angle + PI, TAU) - PI;
      vec2 shearedDerivative = angularDerivative - knot.z * radialDerivative;
      // Integrate the narrow knot over the pixel footprint. This keeps the
      // full-resolution highlight and the small bloom source equally stable.
      vec2 variance = vec2(dot(radialDerivative, radialDerivative),
        dot(shearedDerivative, shearedDerivative)) / 12.0;
      vec2 filteredWidth = sqrt(width * width + variance);
      vec2 distance = vec2(dr, angle) / filteredWidth;
      float coverage = width.x * width.y / (filteredWidth.x * filteredWidth.y);
      heat += exp(-0.5 * dot(distance, distance)) * knot.w * coverage;
    }
    return heat;
  }

  vec2 flowCoordinates(float r, float phi, float age, float angularVelocity) {
    // Differential rotation: the hot inner flow overtakes the outer disk.
    // A shared rotation carries the whole pattern; only the shear has a finite
    // lifetime, preventing ever-tighter spirals and eventual texture aliasing.
    float angle = phi - 0.24 * uTime - (angularVelocity - 0.24) * age;
    // Broad, gentle eddies deform the material in its moving reference frame.
    // Integer angular frequencies keep both sides of the atan seam identical.
    float bend = 0.025 * sin(3.0 * angle + 1.4 * r + 0.12 * uTime)
      + 0.012 * sin(7.0 * angle - 0.8 * r - 0.085 * uTime);
    float ripple = 0.065 * sin(2.0 * angle + 1.8 * r - 0.095 * uTime)
      + 0.030 * sin(5.0 * angle - 1.1 * r + 0.14 * uTime);
    return vec2((angle + bend) / TAU + log(r) * 7.0 / 24.0,
                ((r + ripple) * 6.4 + 0.22 * uTime) / 80.0);
  }

  vec3 emission(vec4 packedHit, float dop, float weight) {
    float r = unpack16(packedHit.rg) * R_OUT;
    float phi = unpack16(packedHit.ba) * TAU - PI;
    float flowRadius = max(r, R_IN);
    float angularVelocity = 0.045 + 0.32 * pow(R_IN / flowRadius, 1.35);
    // Two staggered flows renew only while their contribution is zero. Their
    // smooth handover lets strands form and dissolve without a visible reset.
    float phaseA = fract((uTime - 18.0) / 24.0);
    float phaseB = fract(phaseA + 0.5);
    float blend = smoothstep(0.0, 1.0, 0.5 - 0.5 * cos(TAU * phaseA));
    vec2 stA = flowCoordinates(flowRadius, phi, phaseA * 24.0, angularVelocity);
    vec2 stB = flowCoordinates(flowRadius, phi, phaseB * 24.0, angularVelocity);
    vec2 dxA = dFdx(stA), dyA = dFdy(stA);
    vec2 dxB = dFdx(stB), dyB = dFdy(stB);
    // Keep derivatives outside the branch, and unwrap the periodic angular
    // seam, so mip filtering remains stable at the shadow and disk boundaries.
    dxA.x -= round(dxA.x); dyA.x -= round(dyA.x);
    dxB.x -= round(dxB.x); dyB.x -= round(dyB.x);
    vec2 radialDerivative = vec2(dFdx(r), dFdy(r));
    vec2 angularDerivative = vec2(dFdx(phi), dFdy(phi));
    angularDerivative -= TAU * round(angularDerivative / TAU);
    if (r <= R_IN || weight < 0.001) return vec3(0.0);
    vec3 a = textureGrad(uPlasma, stA, dxA, dyA).rgb;
    vec3 b = textureGrad(uPlasma, stB, dxB, dyB).rgb;
    vec3 field = mix(b, a, blend);
    // The atlas stores square-root energy. Blend in linear light so a handover
    // does not dim the entire disk halfway through its cycle.
    field.g = sqrt(mix(b.g * b.g, a.g * a.g, blend));
    float edgeIn = smoothstep(R_IN, R_IN + 0.25, r);
    float edgeOut = 1.0 - smoothstep(R_OUT - 3.5, R_OUT, r + (field.r - 0.5) * 0.8);
    float profile = edgeIn * edgeOut * pow(R_IN / r, 1.1);
    float t = clamp((r - R_IN) / (R_OUT - R_IN), 0.0, 1.0);
    vec3 hot = vec3(1.00, 0.38, 0.045);
    vec3 warm = vec3(1.00, 0.12, 0.003);
    vec3 cool = vec3(0.48, 0.025, 0.001);
    vec3 col = mix(mix(hot, warm, smoothstep(0.0, 0.38, t)), cool, smoothstep(0.35, 1.0, t));
    col = mix(col, vec3(1.0, 0.64, 0.18), field.b * 0.65 * (1.0 - t));
    // A restrained pale-gold shoulder in the strongest inner filaments.
    float peak = smoothstep(1.4, 3.6, field.g * field.g * 14.0)
      * (1.0 - smoothstep(0.15, 0.60, t));
    col = mix(col, vec3(1.0, 0.72, 0.32), peak * 0.28);
    col = mix(col, col * vec3(0.85, 0.95, 1.2), clamp(dop * 2.5, 0.0, 1.0));
    float beam = pow(clamp(1.0 + dop, 0.3, 2.0), 2.0);
    float heat = localHeating(r, phi, radialDerivative, angularDerivative);
    // Heat existing strands, retaining their dark lanes and fine structure.
    // The same emission feeds bloom, so the knot belongs to the luminous disk.
    float energy = field.g * field.g * 14.0;
    col = mix(col, vec3(1.0, 0.85, 0.52), clamp(heat * 0.55, 0.0, 0.65));
    energy += heat * (0.40 + 1.90 * energy);
    return col * beam * profile * energy * weight;
  }

`;

// Square-root encoding keeps faint glow smooth in ordinary RGBA8 targets, with
// no floating-point-render-target extension required. Gaussian taps decode to
// linear light before averaging. The original scene never passes through these targets.
const bloomEncoding = `
  vec3 encodeGlow(vec3 light) { return sqrt(clamp(light / 8.0, 0.0, 1.0)); }
  vec3 decodeGlow(vec3 encoded) { return encoded * encoded * 8.0; }
`;

export const bloomSourceShader = `#version 300 es
${common}
${diskLight}
${bloomEncoding}
  uniform vec2 uSceneRes;
  out vec4 color;
  void main() {
    vec2 screen = gl_FragCoord.xy / uRes;
    ivec2 pixel = min(ivec2(screen * uSceneRes), ivec2(uSceneRes) - 1);
    vec4 first = texelFetch(uFirst, pixel, 0);
    vec4 second = texelFetch(uSecond, pixel, 0);
    vec4 tr = texelFetch(uTransport, pixel, 0);
    vec3 light = emission(first, tr.g * 2.0 - 1.0, tr.r)
      + emission(second, tr.a * 2.0 - 1.0, tr.b);
    vec2 uv = (screen * 2.0 - 1.0) * vec2(uSceneRes.x / uSceneRes.y, 1.0) - uCenter;
    float radius = uZoom * B_CRIT / sqrt(D * D - B_CRIT * B_CRIT);
    light *= smoothstep(radius * 0.08, radius * 0.20, length(uv) - radius);
    // A soft threshold admits only luminous filaments. The sky, infalling stars,
    // and analytic photon ring are deliberately absent from the glow source.
    float lum = dot(light, vec3(0.2126, 0.7152, 0.0722));
    float knee = clamp(lum - 0.45 + 0.30, 0.0, 0.60);
    float contribution = max(lum - 0.45, knee * knee / 1.20) / max(lum, 0.0001);
    color = vec4(encodeGlow(light * contribution), 1.0);
  }
`;

export const bloomBlurShader = `#version 300 es
${common}
${bloomEncoding}
  uniform sampler2D uSource;
  uniform ivec2 uDirection;
  out vec4 color;
  vec3 tap(ivec2 pixel) {
    return decodeGlow(texelFetch(uSource, clamp(pixel, ivec2(0), ivec2(uRes) - 1), 0).rgb);
  }
  void main() {
    ivec2 pixel = ivec2(gl_FragCoord.xy);
    vec3 light = tap(pixel) * 0.2270270270;
    light += (tap(pixel - uDirection) + tap(pixel + uDirection)) * 0.1945945946;
    light += (tap(pixel - 2 * uDirection) + tap(pixel + 2 * uDirection)) * 0.1216216216;
    light += (tap(pixel - 3 * uDirection) + tap(pixel + 3 * uDirection)) * 0.0540540541;
    light += (tap(pixel - 4 * uDirection) + tap(pixel + 4 * uDirection)) * 0.0162162162;
    color = vec4(encodeGlow(light), 1.0);
  }
`;

export const compositeShader = `#version 300 es
${common}
${diskLight}
${bloomEncoding}
  uniform sampler2D uBloom;
  uniform vec3 uSpace;
  out vec4 color;
  void main() {
    ivec2 pixel = ivec2(gl_FragCoord.xy);
    vec4 first = texelFetch(uFirst, pixel, 0);
    vec4 second = texelFetch(uSecond, pixel, 0);
    vec4 tr = texelFetch(uTransport, pixel, 0);
    vec3 sky = texelFetch(uBackground, pixel, 0).rgb;
    vec3 col = sky * sky * 4.0
      + emission(first, tr.g * 2.0 - 1.0, tr.r)
      + emission(second, tr.a * 2.0 - 1.0, tr.b);

    vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y - uCenter;
    float px = 2.0 / uRes.y;
    float radius = uZoom * B_CRIT / sqrt(D * D - B_CRIT * B_CRIT);
    float distanceToShadow = length(uv) - radius;
    float outside = smoothstep(-0.5 * px, 0.5 * px, distanceToShadow);
    float distanceFromEdge = max(0.0, distanceToShadow);
    col *= smoothstep(radius * 0.08, radius * 0.20, distanceFromEdge);
    float coreWidth = radius * 0.012;
    float filteredWidth = sqrt(coreWidth * coreWidth + px * px / 6.0);
    float rim = exp(-pow((distanceToShadow - coreWidth) / filteredWidth, 2.0)) * coreWidth / filteredWidth;
    float aureole = exp(-distanceFromEdge / (radius * 0.055));
    col += rim * vec3(0.72, 0.86, 1.0) * 3.0
      + aureole * vec3(0.12, 0.32, 0.80) * 0.85;
    vec2 screen = gl_FragCoord.xy / uRes;
    vec3 glow = decodeGlow(textureLod(uBloom, screen, 0.0).rgb) * 0.30
      + decodeGlow(textureLod(uBloom, screen, 2.0).rgb) * 0.18
      + decodeGlow(textureLod(uBloom, screen, 4.0).rgb) * 0.08;
    // Keep the shadow black and the thin blue-white ring sharply defined.
    col += glow * smoothstep(radius * 0.035, radius * 0.14, distanceFromEdge);
    col *= outside;

    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    vec3 mappedL = col * ((1.0 - exp(-lum * 1.3)) / max(lum, 0.0001));
    vec3 mappedC = 1.0 - exp(-col * 1.3);
    col = pow(clamp(mix(mappedL, mappedC, 0.12), 0.0, 1.0), vec3(1.0 / 2.2));
    col *= clamp(1.0 - 0.25 * dot(uv * 0.6, uv * 0.6), 0.0, 1.0);
    // Keep the dense, lensed sky near the disk. Distant space reveals the
    // page's native-resolution star canvas, without wide-angle stretching.
    // A broad Gaussian falloff gives the dense field a long, gentle tail
    // instead of a visible circular boundary against the quieter page sky.
    float skyFalloff = max(length(uv) / radius - 3.8, 0.0) / 3.2;
    float coverage = exp(-skyFalloff * skyFalloff);
    // The vignette shapes the luminous scene, never the page's blue-black floor.
    col += uSpace * (1.0 - col) * outside;
    color = vec4(col * coverage, coverage);
  }
`;
