import test from 'node:test';
import assert from 'node:assert/strict';
import { HomeStarfieldRenderer } from '../src/lib/graphics/HomeStarfieldRenderer';

function fixture() {
  return Object.assign(Object.create(HomeStarfieldRenderer.prototype) as HomeStarfieldRenderer, {
    count: 6000, motionRemaining: 6, pointerActive: false,
    offsets: new Float32Array(12000), velocities: new Float32Array(12000),
    drags: new Float32Array(6000).fill(2.3), activeCount: 1,
    activeIndices: new Uint32Array(6000), activeFlags: new Uint8Array(6000),
  });
}

test('sparse inertia keeps the analytic trajectory and leaves untouched stars unchanged', () => {
  const r = fixture();
  r.activeIndices[0] = 10;
  r.activeFlags[10] = 1;
  r.offsets[20] = 12;
  r.velocities[20] = 40;
  for (let i = 0; i < 120; i++) r.advanceMotion(1 / 120, i * 1000 / 120);
  const drag = r.drags[10];
  const expected = 12 * Math.exp(-1) + 40 * (Math.exp(-1) - Math.exp(-drag)) / (drag - 1);
  assert.ok(Math.abs(r.offsets[20] - expected) < .0001);
  assert.ok(Math.abs(r.velocities[20] - 40 * Math.exp(-drag)) < .0001);
  assert.equal(r.offsets[22], 0);
  assert.equal(r.velocities[22], 0);
  for (let i = 0; i < 61; i++) r.advanceMotion(.1, 1100 + i * 100);
  assert.equal(r.activeCount, 0);
  assert.equal(r.activeFlags[10], 0);
  assert.equal(r.offsets[20], 0);
});

test('interactive 120Hz callbacks draw at most 60Hz without slowing animation time', () => {
  const rafDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  const dprDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 });
  Object.defineProperty(globalThis, 'devicePixelRatio', { configurable: true, value: 1 });
  try {
    const r = Object.assign(fixture(), {
      lastTime: 0, time: 0, frameId: 0, deviceDpr: 1, totalFrames: 0,
      scrollTarget: 0, scrollPosition: 0, rotationX: 0, rotationY: 0, targetX: 0, targetY: 0,
      sampleIndex: 0, sampleCount: 0, cpuSamples: new Float64Array(240), intervalSamples: new Float64Array(240),
    });
    r.canAnimate = () => true;
    r.schedule = () => {};
    r.advanceMotion = () => {};
    r.updateMaterialMode = () => {};
    r.draw = () => {};
    for (let i = 0; i < 240; i++) r.frame(1000 + i * 1000 / 120);
    assert.equal(r.totalFrames, 120);
    assert.ok(Math.abs(r.time - 2) < .025);
    assert.equal(r.isInteracting(1000), true);
    r.motionRemaining = 0; r.interactionUntil = 0;
    assert.equal(r.isInteracting(1000), false);
  } finally {
    if (rafDescriptor) Object.defineProperty(globalThis, 'requestAnimationFrame', rafDescriptor);
    else Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    if (dprDescriptor) Object.defineProperty(globalThis, 'devicePixelRatio', dprDescriptor);
    else Reflect.deleteProperty(globalThis, 'devicePixelRatio');
  }
});

test('repeated draws do not repeat ready-state DOM mutations', () => {
  let writes = 0;
  let ready = '';
  const dataset = Object.defineProperty({}, 'ready', { get: () => ready, set: value => { ready = value; writes++; } });
  const gl = Object.fromEntries(['useProgram', 'clear', 'uniform2f', 'uniform1f', 'drawArrays'].map(name => [name, () => {}]));
  const r = Object.assign(fixture(), { gl, host: { dataset }, uniforms: {}, width: 1280, height: 900, scrollPosition: 0, motionDirty: false });
  for (let i = 0; i < 10; i++) r.draw();
  assert.equal(writes, 1);
});
