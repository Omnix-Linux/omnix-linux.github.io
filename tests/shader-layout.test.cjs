const test = require('node:test');
const assert = require('node:assert/strict');
const {ringAnchor} = require('../shader-layout.js');
const registry = require('../shader-profile.json');

test('each shader enum links its source and measured circle to a reference image', () => {
  assert.equal(registry.version, 2);
  assert(registry.shaders[registry.activeShader]);
  for (const profile of Object.values(registry.shaders)) {
    assert.match(profile.source, /^https:\/\//);
    const {ring, referenceSize, measurement} = profile.geometry;
    assert(referenceSize.width === referenceSize.height);
    assert.equal(ring.character, "O");
    assert(Number.isFinite(ring.radius) && ring.radius > 0);
    assert.deepEqual(ring.bounds, {
      left: ring.center.x - ring.radius, top: ring.center.y - ring.radius,
      right: ring.center.x + ring.radius, bottom: ring.center.y + ring.radius
    });
    assert.equal(ring.center.x, measurement.centerPixels.x / referenceSize.width);
    assert.equal(ring.center.y, measurement.centerPixels.y / referenceSize.height);
    assert.equal(ring.radius, measurement.radiusPixels / referenceSize.width);
    assert(require('node:fs').existsSync(require('node:path').join(__dirname, '..', measurement.image)));
  }
});

test('reference screenshot anchors the suffix beyond the measured right rim', () => {
  const ring = registry.shaders.CORONAL.geometry.ring;
  const anchor = ringAnchor(ring, {left: 0, top: 0, size: 560}, .075);
  for (const [key, value] of Object.entries({centerX: 280, centerY: 280, radius: 162, x: 484, y: 280})) {
    assert(Math.abs(anchor[key] - value) < 1e-9);
  }
});

test('an off-center replacement circle scales and translates its anchor', () => {
  const ring = {center: {x: .3, y: .6}, radius: .2};
  assert.deepEqual(ringAnchor(ring, {left: -50, top: 100, size: 400}, .05),
    {centerX: 70, centerY: 340, radius: 80, x: 170, y: 340});
  assert.deepEqual(ringAnchor(ring, {left: -100, top: 200, size: 800}, .05),
    {centerX: 140, centerY: 680, radius: 160, x: 340, y: 680});
});
