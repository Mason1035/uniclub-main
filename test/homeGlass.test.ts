import './homeStarfieldPerformance.test';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlassField, glassMapSize, sampleGlassEdge, traceGlassRay } from '../src/lib/graphics/homeGlassOptics';

test('curved entry rays obey Snell and normal incidence has no displacement', () => {
  const angle = Math.PI / 3;
  const result = traceGlassRay(Math.tan(angle), 34);
  const refractedAngle = Math.asin(Math.sin(angle) / 1.5);
  assert.ok(Math.abs(result.offset + 34 * Math.tan(angle - refractedAngle)) < 1e-9);
  assert.ok(Math.abs(traceGlassRay(0, 34).offset) < 1e-12);
  assert.ok(Math.abs(traceGlassRay(0, 34).reflection - .04) < 1e-9);
  assert.ok(traceGlassRay(80, 34).reflection > .9);
  assert.ok(Math.abs(traceGlassRay(2, 34, 1).offset) < 1e-9);
});

test('convex lip samples inward and mirror geometry has opposite directions', () => {
  const field = createGlassField(600, 240, 44, true);
  const pixel = (x: number, y: number) => field.displacement.slice((y * field.width + x) * 4, (y * field.width + x) * 4 + 2);
  assert.ok(pixel(8, 120)[0] > 128);
  assert.ok(pixel(591, 120)[0] < 128);
  assert.ok(pixel(300, 8)[1] > 128);
  assert.ok(pixel(300, 231)[1] < 128);
  const left = sampleGlassEdge(10, 25, 600, 240, 44, true);
  const right = sampleGlassEdge(590, 25, 600, 240, 44, true);
  assert.equal(left.depth, right.depth);
  assert.equal(left.nx, -right.nx);
  assert.equal(left.ny, right.ny);
});

test('flat interior remains neutral without a reflection wash', () => {
  const field = createGlassField(600, 240, 44, true);
  for (let y = 55; y < field.height - 55; y++) {
    for (let x = 55; x < field.width - 55; x++) {
      const i = (y * field.width + x) * 4;
      assert.equal(field.displacement[i], 128);
      assert.equal(field.displacement[i + 1], 128);
      assert.equal(field.fresnel[i + 3], 0);
    }
  }
  assert.ok(field.maximum > 7 && field.maximum < 24);
});

test('map budget covers wide and long content without growing with device DPR', () => {
  for (const [width, height] of [[1152, 233], [600, 280], [1200, 2000], [344, 220]]) {
    const map = glassMapSize(width, height);
    assert.ok(map.width <= 1024 && map.height <= 512);
    assert.ok(map.width * map.height <= 262144);
    assert.ok(map.width <= width && map.height <= height);
  }
});
