import { createInfallRenderer } from './blackHoleInfall';
import {
  vertexShader, geometryShader, materialShader, compositeShader, bloomSourceShader, bloomBlurShader,
} from './blackHoleShaders';

const MAX_PIXELS = 8_388_608;
const MAX_WIDTH = 4096;
const ATLAS_SIZE = 2048;
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

type Pass = {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
};
type Scene = { framebuffer: WebGLFramebuffer; textures: WebGLTexture[] };
type Bloom = { width: number; height: number; textures: WebGLTexture[]; targets: WebGLFramebuffer[] };

export function startBlackHole(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-bh-canvas]')!;
  const toggle = document.querySelector<HTMLButtonElement>('[data-bh-toggle]');
  let infall: ReturnType<typeof createInfallRenderer> = null;
  const context = canvas.getContext('webgl2', {
    antialias: false, alpha: false, depth: false, stencil: false,
    powerPreference: 'high-performance',
  });
  const fail = () => {
    root.classList.remove('is-ready');
    root.classList.add('is-fallback');
    if (toggle) toggle.hidden = true;
  };
  if (!context) { fail(); return () => {}; }
  const gl = context;
  // Start each visit in motion; Pause applies to the current visit only.
  let playing = true;
  let inView = true, ready = false, disposed = false, lost = false;
  let time = 18.0, last = 0, raf = 0, resizeTimer = 0;
  let geometry: Pass, material: Pass, composite: Pass, bloomSource: Pass, bloomBlur: Pass;
  let scene: Scene | null = null;
  let bloom: Bloom | null = null;
  let plasma: WebGLTexture | null = null;
  let centerX = 0, centerY = 0, zoom = 1;
  let sceneKey = '', generation = 0;
  const programs = new Set<WebGLProgram>();
  const textures = new Set<WebGLTexture>();
  const framebuffers = new Set<WebGLFramebuffer>();
  // Local-only diagnostics. Nothing is collected, stored, or sent elsewhere.
  let samples: number[] = [], cpuSamples: number[] = [], builds = 0;
  let gpuQuery: WebGLQuery | null = null, gpuMs = 0, draws = 0;
  let timer: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null = null;
  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;

  async function makePass(source: string): Promise<Pass> {
    const current = generation;
    const program = gl.createProgram();
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    if (!program || !vs || !fs) throw new Error('Unable to allocate a shader');
    programs.add(program);
    gl.shaderSource(vs, vertexShader); gl.compileShader(vs);
    gl.shaderSource(fs, source); gl.compileShader(fs);
    gl.attachShader(program, vs); gl.attachShader(program, fs);
    gl.linkProgram(program);
    const parallel = gl.getExtension('KHR_parallel_shader_compile');
    if (parallel) {
      while (true) {
        if (disposed || lost || current !== generation) throw new Error('Renderer interrupted');
        if (gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) break;
        await nextFrame();
      }
    }
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    const message = linked ? '' : gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(program);
    gl.detachShader(program, vs); gl.detachShader(program, fs);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!linked) throw new Error(message || 'Shader linking failed');
    const uniforms = Object.fromEntries([
      'uRes', 'uCenter', 'uZoom', 'uTime',
      'uFirst', 'uSecond', 'uTransport', 'uBackground', 'uPlasma',
      'uSceneRes', 'uBloom', 'uSource', 'uDirection',
    ].map((name) => [name, gl.getUniformLocation(program, name)]));
    return { program, uniforms };
  }

  function texture(w: number, h: number, mipmaps = false) {
    const tex = gl.createTexture();
    if (!tex) throw new Error('Unable to allocate a texture');
    textures.add(tex);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, mipmaps ? Math.floor(Math.log2(Math.max(w, h))) + 1 : 1, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mipmaps ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, mipmaps ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, mipmaps ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    if (mipmaps) {
      const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
      if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,
        Math.min(8, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    }
    return tex;
  }

  function target(attachments: WebGLTexture[]) {
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) throw new Error('Unable to allocate a framebuffer');
    framebuffers.add(framebuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    const buffers = attachments.map((tex, i) => {
      const attachment = gl.COLOR_ATTACHMENT0 + i;
      gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, tex, 0);
      return attachment;
    });
    gl.drawBuffers(buffers);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Incomplete rendering target');
    }
    return framebuffer;
  }

  function use(pass: Pass, w = canvas.width, h = canvas.height) {
    gl.useProgram(pass.program);
    gl.viewport(0, 0, w, h);
    gl.uniform2f(pass.uniforms.uRes, w, h);
    gl.uniform2f(pass.uniforms.uCenter, centerX, centerY);
    gl.uniform1f(pass.uniforms.uZoom, zoom);
  }

  function deleteScene() {
    if (bloom) {
      for (const fb of bloom.targets) { gl.deleteFramebuffer(fb); framebuffers.delete(fb); }
      for (const tex of bloom.textures) { gl.deleteTexture(tex); textures.delete(tex); }
      bloom = null;
    }
    if (!scene) return;
    gl.deleteFramebuffer(scene.framebuffer); framebuffers.delete(scene.framebuffer);
    for (const tex of scene.textures) { gl.deleteTexture(tex); textures.delete(tex); }
    scene = null;
  }

  function resize() {
    if (!ready || lost || disposed) return;
    const rect = root.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // The same retina framebuffer is used for Pause AND Play. Never resize as
    // a reaction to frame time: that changes both the stars and the photon ring.
    const scale = Math.min(1,
      Math.min(MAX_WIDTH, maxTexture, maxViewport[0]) / (rect.width * dpr),
      Math.min(maxTexture, maxViewport[1]) / (rect.height * dpr),
      Math.sqrt(MAX_PIXELS / (rect.width * rect.height * dpr * dpr)));
    const w = Math.max(1, Math.round(rect.width * dpr * scale));
    const h = Math.max(1, Math.round(rect.height * dpr * scale));
    const aspect = rect.width / rect.height;
    const wide = rect.width > 860 && aspect > 1.1;
    centerX = wide ? aspect * 0.44 : 0;
    centerY = wide ? 0.10 : 0.32;
    zoom = wide ? Math.min(1.18, aspect * 0.76) : Math.max(0.4, Math.min(0.78, 1.35 * aspect));
    const key = `${w}:${h}:${centerX}:${centerY}:${zoom}`;
    if (key === sceneKey) return;
    deleteScene();
    canvas.width = w; canvas.height = h;
    const attachments = Array.from({ length: 4 }, () => texture(w, h));
    scene = { textures: attachments, framebuffer: target(attachments) };
    sceneKey = key;
    use(geometry);
    // Data textures must not be dithered: their channels contain packed coordinates.
    gl.disable(gl.DITHER);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // Only the soft light uses smaller targets. The scene, ring and stars keep
    // their original resolution. At retina density the glow is quarter-size;
    // sizing in CSS pixels keeps its apparent radius stable across densities.
    const bw = Math.max(1, Math.ceil(Math.min(w, rect.width) / 2));
    const bh = Math.max(1, Math.ceil(Math.min(h, rect.height) / 2));
    const glowTextures = Array.from({ length: 2 }, () => {
      const tex = texture(bw, bh, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
      if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, 1);
      return tex;
    });
    bloom = { width: bw, height: bh, textures: glowTextures, targets: glowTextures.map(tex => target([tex])) };
    const horizon = rect.height * 0.5 * zoom * 2.598 / Math.sqrt(15 ** 2 - 2.598 ** 2);
    infall?.resize(rect.width, rect.height,
      rect.width * 0.5 + centerX * rect.height * 0.5,
      rect.height * 0.5 - centerY * rect.height * 0.5, horizon);
    if (import.meta.env.DEV) {
      root.dataset.resolution = `${w} × ${h}`;
      root.dataset.sceneBuilds = String(++builds);
      root.dataset.motionTime = time.toFixed(4);
    }
    draw();
  }

  function bindLight(pass: Pass) {
    const names = ['uFirst', 'uSecond', 'uTransport', 'uBackground', 'uPlasma'];
    [...scene!.textures, plasma].forEach((tex, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(pass.uniforms[names[i]], i);
    });
    gl.uniform1f(pass.uniforms.uTime, time);
  }

  function drawBloom() {
    if (!bloom) return;
    const { width, height, textures: glowTextures, targets } = bloom;
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[0]);
    use(bloomSource, width, height);
    bindLight(bloomSource);
    gl.uniform2f(bloomSource.uniforms.uSceneRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    use(bloomBlur, width, height);
    gl.uniform1i(bloomBlur.uniforms.uSource, 0);
    gl.activeTexture(gl.TEXTURE0);
    for (let axis = 0; axis < 2; axis++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets[1 - axis]);
      gl.bindTexture(gl.TEXTURE_2D, glowTextures[axis]);
      gl.uniform2i(bloomBlur.uniforms.uDirection, axis === 0 ? 1 : 0, axis === 0 ? 0 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, glowTextures[0]);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  function draw() {
    if (!scene || !ready || lost || disposed) return;
    const began = import.meta.env.DEV ? performance.now() : 0;
    if (timer && gpuQuery && gl.getQueryParameter(gpuQuery, gl.QUERY_RESULT_AVAILABLE)) {
      if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) gpuMs = gl.getQueryParameter(gpuQuery, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(gpuQuery); gpuQuery = null;
    }
    let measure = false;
    if (timer && !gpuQuery && draws % 60 === 0) {
      gpuQuery = gl.createQuery();
      if (gpuQuery) { gl.beginQuery(timer.TIME_ELAPSED_EXT, gpuQuery); measure = true; }
    }
    drawBloom();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    use(composite);
    bindLight(composite);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, bloom!.textures[0]);
    gl.uniform1i(composite.uniforms.uBloom, 5);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    infall?.draw(time);
    if (measure && timer) gl.endQuery(timer.TIME_ELAPSED_EXT);
    if (import.meta.env.DEV) {
      draws++;
      cpuSamples.push(performance.now() - began);
    }
  }

  function frame(now: number) {
    raf = 0;
    if (!playing || !inView || document.hidden || !ready || lost || disposed) return;
    const elapsed = last ? now - last : 0;
    last = now;
    time += Math.min(elapsed, 100) / 1000;
    draw();
    if (import.meta.env.DEV && elapsed > 0) {
      samples.push(elapsed);
      if (samples.length >= 120) {
        const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
        const sorted = [...samples].sort((a, b) => a - b);
        root.dataset.frameMs = mean.toFixed(2);
        root.dataset.frameP95 = sorted[Math.floor(sorted.length * 0.95)].toFixed(2);
        root.dataset.cpuMs = (cpuSamples.reduce((a, b) => a + b, 0) / cpuSamples.length).toFixed(2);
        root.dataset.gpuMs = gpuMs.toFixed(2);
        root.dataset.motionTime = time.toFixed(4);
        samples = []; cpuSamples = [];
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function sleep() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; last = 0;
  }
  function wake() {
    if (!raf && playing && inView && !document.hidden && ready && !lost && !disposed) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }
  function setPlaying(value: boolean) {
    playing = value;
    if (toggle) {
      toggle.textContent = playing ? 'Pause' : 'Play';
      toggle.setAttribute('aria-pressed', String(!playing));
    }
    // Pausing freezes the exact displayed frame. Resuming continues its clock;
    // neither action rebuilds geometry, reallocates a canvas, or reseeds stars.
    if (playing) wake(); else sleep();
    if (import.meta.env.DEV) root.dataset.motionTime = time.toFixed(4);
  }
  function toggleMotion() {
    setPlaying(!playing);
  }
  function visibility() { if (document.hidden) sleep(); else wake(); }
  function contextLost(event: Event) {
    event.preventDefault(); lost = true; ready = false; generation++;
    sleep(); fail();
  }
  function release() {
    infall?.dispose(); infall = null;
    if (gpuQuery) { gl.deleteQuery(gpuQuery); gpuQuery = null; }
    for (const program of programs) gl.deleteProgram(program);
    for (const tex of textures) gl.deleteTexture(tex);
    for (const fb of framebuffers) gl.deleteFramebuffer(fb);
    programs.clear(); textures.clear(); framebuffers.clear();
    scene = null; bloom = null; plasma = null; sceneKey = '';
  }
  async function initialize() {
    const current = ++generation;
    lost = false;
    release();
    timer = import.meta.env.DEV ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
    try {
      [geometry, material, composite, bloomSource, bloomBlur] = await Promise.all([
        makePass(geometryShader), makePass(materialShader), makePass(compositeShader),
        makePass(bloomSourceShader), makePass(bloomBlurShader),
      ]);
      if (disposed || lost || current !== generation) return;
      infall = createInfallRenderer(canvas, gl);
      const atlasSize = Math.min(ATLAS_SIZE, maxTexture);
      plasma = texture(atlasSize, atlasSize, true);
      const atlasTarget = target([plasma]);
      use(material, atlasSize, atlasSize);
      gl.disable(gl.DITHER);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, plasma);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.deleteFramebuffer(atlasTarget); framebuffers.delete(atlasTarget);
      ready = true;
      resize();
      root.classList.remove('is-fallback'); root.classList.add('is-ready');
      if (toggle) toggle.hidden = false;
      setPlaying(playing);
    } catch (error) {
      if (disposed || current !== generation) return;
      generation++; ready = false; sleep(); release(); fail();
      console.error('[blackhole] renderer initialization failed:', error);
    }
  }
  function contextRestored() { void initialize(); }
  const resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      try { resize(); } catch (error) {
        ready = false; sleep(); release(); fail();
        console.error('[blackhole] resize failed:', error);
      }
    }, 120);
  });
  resizeObserver.observe(root);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    inView = entry?.isIntersecting ?? true;
    if (inView) wake(); else sleep();
  });
  intersectionObserver.observe(root);
  toggle?.addEventListener('click', toggleMotion);
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', contextRestored);
  void initialize();

  return () => {
    disposed = true; generation++; sleep(); clearTimeout(resizeTimer);
    resizeObserver.disconnect(); intersectionObserver.disconnect();
    toggle?.removeEventListener('click', toggleMotion);
    document.removeEventListener('visibilitychange', visibility);
    canvas.removeEventListener('webglcontextlost', contextLost);
    canvas.removeEventListener('webglcontextrestored', contextRestored);
    release();
  };
}
