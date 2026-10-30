// Original ClassHub starfield, adapted from the approved independent experiment.
// Immutable geometry; mouse motion changes only a separate displacement buffer.
const VERTEX = `
attribute vec3 position;
attribute vec3 color;
attribute vec3 properties;
attribute vec2 displacement;
uniform vec2 viewport;
uniform vec2 rotation;
uniform float time;
uniform float dpr;
uniform float motion;
uniform float strength;
uniform float scroll;
varying vec3 tint;
varying float brightness;
void main(){
  vec3 p=position;
  float sy=sin(rotation.x),cy=cos(rotation.x);
  float sx=sin(rotation.y),cx=cos(rotation.y);
  p=vec3(p.x*cy+p.z*sy,p.y,-p.x*sy+p.z*cy);
  p=vec3(p.x,p.y*cx-p.z*sx,p.y*sx+p.z*cx);
  p.xy+=motion*vec2(sin(time*.065+properties.z),cos(time*.049+properties.z))*0.004*(p.z+1.5);
  float distanceLayer=clamp((position.z+.7)/1.4,0.,1.);
  float scrollSpeed=mix(.025,.24,distanceLayer*distanceLayer);
  p.y=mod(p.y+1.16+scroll*scrollSpeed,2.32)-1.16;
  float aspect=viewport.x/viewport.y;
  gl_Position=vec4((p.x+displacement.x*2./viewport.y*motion)/aspect,p.y+displacement.y*2./viewport.y*motion,0.,1.);
  gl_PointSize=(properties.x*7.8+2.)*dpr;
  float pulse=.94+.06*sin(time*(.35+properties.z*.045)+properties.z);
  // Keep the central reading column quiet, especially below the hero.
  float center=1.-smoothstep(.15,.75,abs(p.x/aspect));
  brightness=properties.y*mix(1.,pulse,motion)*mix(1.,.27,center*strength);
  tint=color;
}`;
const FRAGMENT = `
precision mediump float;
varying vec3 tint;
varying float brightness;
void main(){
  float r=length(gl_PointCoord-.5)*2.;
  float core=exp(-r*r*42.);
  float halo=exp(-r*r*9.)*.11;
  float a=(core+halo)*brightness*(1.-smoothstep(.8,1.,r));
  if(a<.001)discard;
  vec3 light=mix(tint,vec3(1.),core*.55);
  gl_FragColor=vec4(light*a,a);
}`;
const PALETTE = [[.427,.796,.957],[.478,.694,.996],[.973,.475,.082],[.98,.6,.298],[.96,.965,.984]];

function rng(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to allocate a starfield shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

export class HomeStarfieldRenderer {
  canvas: HTMLCanvasElement;
  host: HTMLElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram | null = null;
  buffer: WebGLBuffer | null = null;
  motionBuffer: WebGLBuffer | null = null;
  uniforms: Record<string, WebGLUniformLocation | null> = {};
  mode: string;
  paused: boolean;
  fallback: boolean;
  disposed: boolean;
  pageSuspended: boolean;
  time: number;
  rotationX: number;
  rotationY: number;
  targetX: number;
  targetY: number;
  scrollTarget: number;
  scrollPosition: number;
  pointerX: number;
  pointerY: number;
  pointerPreviousX: number;
  pointerPreviousY: number;
  pointerActive: boolean;
  pointerTracked: boolean;
  pointerPressed: boolean;
  motionRemaining: number;
  scrollCooldownUntil: number;
  frameId: number;
  lastTime: number;
  totalFrames: number;
  cpuSamples: Float64Array<ArrayBuffer>;
  intervalSamples: Float64Array<ArrayBuffer>;
  sampleIndex: number;
  sampleCount: number;
  cleanups: Array<() => void>;
  media: MediaQueryList;
  forcedMedia: MediaQueryList;
  pointerMedia: MediaQueryList;
  reducedMotion: boolean;
  dprMedia?: MediaQueryList;
  dprListener?: () => void;
  observer?: ResizeObserver;
  pointerBounds?: DOMRect;
  deviceDpr = 1;
  width = 0;
  height = 0;
  dpr = 1;
  count = 0;
  bufferBytes = 0;
  baseData = new Float32Array(0);
  offsets = new Float32Array(0);
  velocities = new Float32Array(0);
  masses = new Float32Array(0);
  drags = new Float32Array(0);
  motionDirty = false;
  materialMode: boolean | undefined;
  idleTimer = 0;
  interactionUntil = 0;
  activeCount = 0;
  activeIndices = new Uint32Array(0);
  activeFlags = new Uint8Array(0);
  phaseSin = new Float64Array(0);
  phaseCos = new Float64Array(0);
  constructor(canvas: HTMLCanvasElement, { host = canvas.parentElement, active = true }: { host?: HTMLElement; active?: boolean } = {}) {
    this.canvas = canvas;
    this.host = host;
    this.mode = 'field';
    this.paused = !active;
    this.fallback = false;
    this.disposed = false;
    this.pageSuspended = false;
    this.time = 0;
    this.rotationX = 0;
    this.rotationY = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.scrollTarget = window.scrollY;
    this.scrollPosition = this.scrollTarget;
    this.pointerX = this.pointerY = this.pointerPreviousX = this.pointerPreviousY = 0;
    this.pointerActive = this.pointerTracked = this.pointerPressed = false;
    this.motionRemaining = 0;
    this.scrollCooldownUntil = 0;
    this.frameId = 0;
    this.lastTime = 0;
    this.totalFrames = 0;
    this.cpuSamples = new Float64Array(240);
    this.intervalSamples = new Float64Array(240);
    this.sampleIndex = 0;
    this.sampleCount = 0;
    this.cleanups = [];
    this.media = matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.media.matches;
    this.forcedMedia = matchMedia('(forced-colors: active)');
    this.gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', premultipliedAlpha: true });
    if (!this.gl) throw new Error('WebGL unavailable');
    try {
      this.createResources();
      this.frame = this.frame.bind(this);
      this.listen(document, 'visibilitychange', () => { if (document.hidden) this.clearMotion(); this.reconcile(); });
      this.listen(window, 'resize', () => this.resize(), { passive: true });
      this.listen(window, 'scroll', () => {
        this.scrollTarget = window.scrollY;
        this.scrollCooldownUntil = performance.now() + 120;
        this.pointerTracked = false;
        this.interactionUntil = performance.now() + 180;
        this.wake();
      }, { passive: true });
      this.bindPointerField();
      this.watchPixelRatio();
      this.listen(this.media, 'change', () => {
        this.reducedMotion = this.media.matches;
        this.clearMotion();
        this.draw();
        this.reconcile();
      });
      this.listen(canvas, 'webglcontextlost', event => {
        event.preventDefault();
        this.fallback = true;
        this.clearMotion();
        this.host.dataset.ready = 'false';
        this.reconcile();
      });
      this.listen(canvas, 'webglcontextrestored', () => {
        this.fallback = false;
        try { this.createResources(); this.width = 0; this.resize(); this.reconcile(); }
        catch { this.fallback = true; this.host.dataset.ready = 'false'; this.reconcile(); }
      });
      this.listen(this.forcedMedia, 'change', () => { this.clearMotion(); this.draw(); this.reconcile(); });
      this.listen(window, 'pagehide', () => this.suspend());
      this.listen(window, 'pageshow', () => this.resume());
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(host);
      this.resize();
      this.reconcile();
    } catch (error) { this.dispose(); throw error; }
  }
  listen(target: EventTarget, event: string, listener: EventListener, options?: AddEventListenerOptions) {
    target.addEventListener(event, listener, options);
    this.cleanups.push(() => target.removeEventListener(event, listener, options));
  }
  watchPixelRatio() {
    this.dprMedia?.removeEventListener('change', this.dprListener);
    this.dprMedia = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`);
    this.dprListener = () => { this.watchPixelRatio(); this.resize(); };
    this.dprMedia.addEventListener('change', this.dprListener);
  }
  releasePointer() { this.pointerActive = this.pointerTracked = this.pointerPressed = false; }
  clearMotion() {
    this.releasePointer();
    this.motionRemaining = 0;
    this.activeCount = 0;
    this.activeFlags.fill(0);
    this.offsets?.fill(0);
    this.velocities?.fill(0);
    this.motionDirty = true;
  }
  bindPointerField() {
    this.pointerMedia = matchMedia('(any-hover: hover) and (any-pointer: fine)');
    const move = (event: PointerEvent) => {
      if (!this.pointerMedia.matches || this.reducedMotion || this.paused || this.fallback || !event.isPrimary || !['mouse','pen'].includes(event.pointerType)) return;
      // Radix dialogs keep their normal pointer/form behavior.
      if (document.body.hasAttribute('data-scroll-locked')) { this.releasePointer(); return; }
      // Cards own their pointer feedback, including links, images and nested SVGs.
      // Releasing the path also prevents a swept impulse across the card on exit.
      if (event.composedPath().some(target => target instanceof Element && target.matches('.home-card, .glass-material, .dialog-panel, .admin-sidebar, .admin-topbar, input, textarea, select, button, a, [data-starfield-block]'))) {
        this.releasePointer();
        return;
      }
      const bounds = this.pointerBounds;
      if (!bounds || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return this.releasePointer();
      this.pointerX = event.clientX - bounds.left - bounds.width * .5;
      this.pointerY = bounds.height * .5 - (event.clientY - bounds.top);
      this.pointerActive = true;
      this.interactionUntil = performance.now() + 180;
      this.wake();
      this.pointerPressed = !!(event.buttons & 1);
      // Entering or releasing a drag starts a new path; neither produces a jump.
      if (!this.pointerTracked || this.pointerPressed || event.type === 'pointerup') {
        this.pointerPreviousX = this.pointerX;
        this.pointerPreviousY = this.pointerY;
        this.pointerTracked = true;
      }
    };
    this.listen(window, 'pointermove', move, { passive: true });
    this.listen(window, 'pointerdown', move, { passive: true });
    this.listen(window, 'pointerup', move, { passive: true });
    this.listen(window, 'pointercancel', () => this.releasePointer(), { passive: true });
    this.listen(window, 'pointerout', (event: PointerEvent) => { if (!event.relatedTarget) this.releasePointer(); }, { passive: true });
    this.listen(window, 'blur', () => this.clearMotion());
    this.listen(this.pointerMedia, 'change', () => { this.clearMotion(); this.draw(); });
  }
  createResources() {
    const gl = this.gl;
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    let fragment;
    try { fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT); }
    catch (error) { gl.deleteShader(vertex); throw error; }
    const program = gl.createProgram();
    if (!program) { gl.deleteShader(vertex); gl.deleteShader(fragment); throw new Error('Unable to allocate a starfield program'); }
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { const message = gl.getProgramInfoLog(program); gl.deleteProgram(program); throw new Error(message); }
    this.program = program;
    this.buffer = gl.createBuffer();
    this.motionBuffer = gl.createBuffer();
    if (!this.buffer || !this.motionBuffer) throw new Error('Unable to allocate starfield buffers');
    this.uniforms = Object.fromEntries(['viewport','rotation','time','dpr','motion','strength','scroll'].map(name => [name, gl.getUniformLocation(program, name)]));
    gl.useProgram(program); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    for (const [i, name] of ['position','color','properties'].entries()) {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 36, i * 12);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.motionBuffer);
    const displacement = gl.getAttribLocation(program, 'displacement');
    gl.enableVertexAttribArray(displacement); gl.vertexAttribPointer(displacement, 2, gl.FLOAT, false, 8, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.disable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
  }
  generate() {
    const random = rng(20261013);
    this.count = this.width < 600 ? 2800 : 6000;
    const data = new Float32Array(this.count * 9);
    const aspect = this.width / this.height;
    for (let i = 0; i < this.count; i++) {
      const offset = i * 9;
      let x, y;
        // A clustered mixture, rather than a uniform tiled pattern.
        x = (random() * 2 - 1) * aspect * 1.10;
        y = random() * 2.32 - 1.16;
        if (i % 7 === 0) { x = (random() + random() - 1) * aspect; y = (random() + random() - 1) * 1.12; }
        const layerRoll = random();
        const layer = layerRoll < .50 ? 0 : layerRoll < .85 ? 1 : 2;
        const z = [-.65, 0, .65][layer] + (random() - .5) * .08;
        const size = [.45,.70,.95][layer] + Math.pow(random(), 4) * [.65,1.1,1.7][layer];
        const brightness = (.28 + Math.pow(random(), 2) * .90) * [.58,.84,1.0][layer];
      const roll = random();
      const color = PALETTE[roll < .36 ? 0 : roll < .52 ? 1 : roll < .64 ? 2 : roll < .74 ? 3 : 4];
      data[offset] = x; data[offset+1] = y; data[offset+2] = z;
      data[offset+3] = color[0]; data[offset+4] = color[1]; data[offset+5] = color[2];
      data[offset+6] = size; data[offset+7] = brightness; data[offset+8] = random() * Math.PI * 2;
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
    this.bufferBytes = data.byteLength;
    this.baseData = data;
    this.offsets = new Float32Array(this.count * 2);
    this.velocities = new Float32Array(this.count * 2);
    this.masses = new Float32Array(this.count);
    this.drags = new Float32Array(this.count);
    this.activeIndices = new Uint32Array(this.count);
    this.activeFlags = new Uint8Array(this.count);
    this.phaseSin = new Float64Array(this.count);
    this.phaseCos = new Float64Array(this.count);
    for (let i = 0; i < this.count; i++) {
      // Mass is derived from the existing visible core, without changing its size.
      const coreDiameter = (data[i * 9 + 6] * 7.8 + 2) * .4;
      const t = Math.max(0, Math.min(1, (coreDiameter - 1) / 13));
      const mass = .65 + 1.75 * t * t * (3 - 2 * t);
      this.masses[i] = mass;
      this.drags[i] = 2.3 / Math.sqrt(mass);
      this.phaseSin[i] = Math.sin(data[i * 9 + 8]);
      this.phaseCos[i] = Math.cos(data[i * 9 + 8]);
    }
    this.clearMotion();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.motionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.offsets, this.gl.DYNAMIC_DRAW);
    this.motionDirty = false;
  }
  resize() {
    if (this.disposed || this.fallback) return;
    this.deviceDpr = devicePixelRatio || 1;
    const bounds = this.host.getBoundingClientRect();
    this.pointerBounds = bounds;
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    const dpr = Math.max(.5, Math.min(this.deviceDpr, 1.5, Math.sqrt(2400000 / (width * height))));
    if (width === this.width && height === this.height && dpr === this.dpr) return;
    this.width = width; this.height = height; this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.generate(); this.draw();
  }
  draw() {
    if (this.disposed || this.fallback || !this.width) return;
    const gl = this.gl, u = this.uniforms;
    gl.useProgram(this.program); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.viewport, this.width, this.height);
    gl.uniform2f(u.rotation, this.rotationX, this.rotationY);
    gl.uniform1f(u.time, this.time); gl.uniform1f(u.dpr, this.dpr);
    gl.uniform1f(u.motion, this.reducedMotion ? 0 : 1);
    gl.uniform1f(u.strength, this.mode === 'field' ? .46 + .30 * Math.min(1, this.scrollPosition / this.height) : .3);
    gl.uniform1f(u.scroll, this.reducedMotion ? 0 : this.scrollPosition / this.height);
    if (this.motionDirty) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.motionBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.offsets);
      this.motionDirty = false;
    }
    gl.drawArrays(gl.POINTS, 0, this.count);
    if (this.host.dataset.ready !== 'true') this.host.dataset.ready = 'true';
  }
  frame(now: number) {
    this.frameId = 0;
    if (!this.canAnimate()) return;
    // Cap expensive canvas/backdrop invalidations on high-refresh displays.
    if (this.lastTime && now - this.lastTime < 1000 / 60 - .3) {
      this.frameId = requestAnimationFrame(this.frame);
      return;
    }
    const start = performance.now();
    // Scalar check only: do not measure layout unless the display scale changes.
    if (this.deviceDpr !== (devicePixelRatio || 1)) this.resize();
    const interval = this.lastTime ? now - this.lastTime : 0;
    const dt = Math.min(interval / 1000, .15);
    this.lastTime = now; this.time += dt;
    const damping = 1 - Math.exp(-dt * 7);
    this.scrollPosition += (this.scrollTarget - this.scrollPosition) * (1 - Math.exp(-dt * 11));
    this.rotationX += (this.targetX - this.rotationX) * damping;
    this.rotationY += (this.targetY - this.rotationY) * damping;
    this.advanceMotion(dt, now);
    this.updateMaterialMode(this.isInteracting(now));
    this.draw(); this.totalFrames++;
    if (interval > 0) {
      this.cpuSamples[this.sampleIndex] = performance.now() - start;
      this.intervalSamples[this.sampleIndex] = interval;
      this.sampleIndex = (this.sampleIndex + 1) % 240;
      this.sampleCount = Math.min(this.sampleCount + 1, 240);
    }
    this.schedule(now);
  }
  advanceMotion(dt: number, now: number) {
    if (!this.offsets || dt <= 0) return;
    // Solve a damped velocity and gradual return analytically, independent of FPS.
    if (this.motionRemaining > 0) {
      this.motionRemaining = Math.max(0, this.motionRemaining - dt);
      const returnDecay = Math.exp(-dt);
      // The other stars have zero motion. Advancing only touched indices is exact.
      for (let n = 0; n < this.activeCount; n++) {
        const i = this.activeIndices[n];
        const j = i * 2;
        const drag = this.drags[i];
        const velocityDecay = Math.exp(-drag * dt);
        const travel = (returnDecay - velocityDecay) / (drag - 1);
        this.offsets[j] = this.offsets[j] * returnDecay + this.velocities[j] * travel;
        this.offsets[j + 1] = this.offsets[j + 1] * returnDecay + this.velocities[j + 1] * travel;
        this.velocities[j] *= velocityDecay;
        this.velocities[j + 1] *= velocityDecay;
      }
      if (this.motionRemaining === 0) {
        this.offsets.fill(0); this.velocities.fill(0);
        this.activeFlags.fill(0); this.activeCount = 0;
      }
      this.motionDirty = true;
    }
    if (!this.pointerActive || !this.pointerTracked) return;
    const startX = this.pointerPreviousX, startY = this.pointerPreviousY;
    const dx = this.pointerX - startX, dy = this.pointerY - startY;
    this.pointerPreviousX = this.pointerX;
    this.pointerPreviousY = this.pointerY;
    const lengthSquared = dx * dx + dy * dy;
    if (this.pointerPressed || now < this.scrollCooldownUntil || lengthSquared < .0001) return;
    const radius = Math.max(88, this.height * .0125);
    const impulseLimit = Math.min(1, this.height * .09 / Math.sqrt(lengthSquared));
    const impulseX = dx * impulseLimit * 5.4, impulseY = dy * impulseLimit * 5.4;
    const speedLimit = this.height * .25;
    const scale = this.height * .5;
    const scroll = this.scrollPosition / this.height;
    const sy = Math.sin(this.rotationX), cy = Math.cos(this.rotationX);
    const sx = Math.sin(this.rotationY), cx = Math.cos(this.rotationY);
    const data = this.baseData;
    const driftSinX = Math.sin(this.time * .065), driftCosX = Math.cos(this.time * .065);
    const driftSinY = Math.sin(this.time * .049), driftCosY = Math.cos(this.time * .049);
    for (let i = 0; i < this.count; i++) {
      const k = i * 9, j = i * 2;
      // Match the existing shader's projection; the immutable star data stays intact.
      const x = data[k] * cy + data[k + 2] * sy;
      const z = -data[k] * sy + data[k + 2] * cy;
      const y = data[k + 1] * cx - z * sx;
      const rotatedZ = data[k + 1] * sx + z * cx;
      const baseX = x + (driftSinX * this.phaseCos[i] + driftCosX * this.phaseSin[i]) * .004 * (rotatedZ + 1.5);
      const layer = Math.max(0, Math.min(1, (data[k + 2] + .7) / 1.4));
      const driftY = y + (driftCosY * this.phaseCos[i] - driftSinY * this.phaseSin[i]) * .004 * (rotatedZ + 1.5);
      const wrappedY = ((driftY + 1.16 + scroll * (.025 + .215 * layer * layer)) % 2.32 + 2.32) % 2.32 - 1.16;
      const relativeX = baseX * scale + this.offsets[j] - startX;
      const relativeY = wrappedY * scale + this.offsets[j + 1] - startY;
      const along = Math.max(0, Math.min(1, (relativeX * dx + relativeY * dy) / lengthSquared));
      const distance = Math.hypot(relativeX - dx * along, relativeY - dy * along);
      if (distance >= radius) continue;
      if (!this.activeFlags[i]) {
        this.activeFlags[i] = 1;
        this.activeIndices[this.activeCount++] = i;
      }
      const t = distance / radius;
      const falloff = 1 - t * t * (3 - 2 * t);
      const weight = falloff * falloff / this.masses[i];
      const vx = this.velocities[j] + impulseX * weight;
      const vy = this.velocities[j + 1] + impulseY * weight;
      const limit = Math.min(1, speedLimit / Math.max(.00001, Math.hypot(vx, vy)));
      this.velocities[j] = vx * limit;
      this.velocities[j + 1] = vy * limit;
    }
    if (this.activeCount) this.motionRemaining = 6;
  }
  canAnimate() { return !this.disposed && !this.fallback && !this.paused && !this.reducedMotion && !this.forcedMedia.matches && !document.hidden && !this.pageSuspended; }
  isInteracting(now: number) {
    return now < this.interactionUntil || this.motionRemaining > 0 || Math.abs(this.scrollTarget - this.scrollPosition) > .02;
  }
  updateMaterialMode(interacting: boolean) {
    if (this.materialMode === interacting) return;
    this.materialMode = interacting;
    document.documentElement.dataset.homeRendering = interacting ? 'interactive' : 'idle';
  }
  schedule(now = performance.now()) {
    if (!this.canAnimate() || this.frameId || this.idleTimer) return;
    if (this.isInteracting(now)) this.frameId = requestAnimationFrame(this.frame);
    else {
      // Slow ambient drift/twinkle needs at most 15 updates/s, not 60–120.
      // Use a timer so idle pages don't keep a display-rate RAF polling loop alive.
      this.idleTimer = window.setTimeout(() => {
        this.idleTimer = 0;
        if (this.canAnimate()) this.frameId = requestAnimationFrame(this.frame);
      }, Math.max(0, 1000 / 15 - (now - this.lastTime)));
    }
  }
  wake() {
    clearTimeout(this.idleTimer); this.idleTimer = 0;
    if (this.canAnimate() && !this.frameId) this.frameId = requestAnimationFrame(this.frame);
  }
  reconcile() {
    if (this.canAnimate()) this.schedule();
    else {
      this.updateMaterialMode(false);
      cancelAnimationFrame(this.frameId); clearTimeout(this.idleTimer);
      this.frameId = this.idleTimer = 0; this.lastTime = 0;
    }
  }
  setActive(active: boolean) { this.paused = !active; this.releasePointer(); this.reconcile(); }
  suspend() { this.pageSuspended = true; this.clearMotion(); this.reconcile(); }
  resume() { this.pageSuspended = false; this.resize(); this.reconcile(); }
  metrics() {
    const cpu = Array.from(this.cpuSamples.slice(0, this.sampleCount)).sort((a,b)=>a-b);
    let interval = 0;
    for (let i=0;i<this.sampleCount;i++) interval += this.intervalSamples[i];
    return { mode:this.mode, count:this.count, bufferBytes:this.bufferBytes, motionBufferBytes:this.offsets?.byteLength??0, width:this.width,height:this.height,dpr:this.dpr, pixels:this.canvas.width*this.canvas.height, totalFrames:this.totalFrames, samples:this.sampleCount, meanFps:interval ? 1000*this.sampleCount/interval : 0, cpuMedianMs:cpu[Math.floor(cpu.length*.5)]??0,cpuP95Ms:cpu[Math.floor(cpu.length*.95)]??0, pointerActive:this.pointerActive,motionRemaining:this.motionRemaining, scrollTarget:this.scrollTarget,scrollPosition:this.scrollPosition,reducedMotion:this.reducedMotion, paused:this.paused, animating:!!(this.frameId || this.idleTimer), activeStars:this.activeCount, targetFps:this.isInteracting(performance.now())?60:15, fallback:this.fallback, disposed:this.disposed };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.reconcile(); this.observer?.disconnect();
    this.cleanups.forEach(remove=>remove()); this.cleanups.length=0;
    this.dprMedia?.removeEventListener('change', this.dprListener);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null); this.gl.useProgram(null);
    this.gl.deleteBuffer(this.buffer); this.gl.deleteBuffer(this.motionBuffer); this.gl.deleteProgram(this.program);
    this.canvas.width = this.canvas.height = 1;
    // StrictMode cleanup is not a renderer failure; avoid fetching the fallback.
    this.host.dataset.ready='loading';
    delete document.documentElement.dataset.homeRendering;
  }
}
