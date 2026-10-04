const test = require('node:test');
const assert = require('node:assert/strict');
const { scrollState, fadeStops } = require('../column-scroll.js');

test('shorter copy begins at the top and ends aligned with the taller panel bottom', () => {
  assert.equal(scrollState(300, 800, -200).translation, 0);
  assert.equal(scrollState(300, 800, 0).translation, 0);
  assert.equal(scrollState(300, 800, 800).translation + 300, 800);
  assert.equal(scrollState(300, 800, 1200).translation + 300, 800);
});

test('copy moves at its height ratio while the panel follows normal document scrolling', () => {
  for (const [copy, panel] of [[300, 800], [450, 600], [799, 801]]) {
    const a = scrollState(copy, panel, 100);
    const b = scrollState(copy, panel, 200);
    const copyScreenTravel = 100 - (b.translation - a.translation);
    assert(Math.abs(copyScreenTravel / 100 - copy / panel) < 1e-9);
    assert.equal(a.speed, copy / panel);
    for (let distance = -100; distance < panel + 200; distance += 25) {
      const state = scrollState(copy, panel, distance);
      assert(state.translation >= 0 && state.translation + copy <= panel);
    }
  }
});

test('equal, taller, empty, and rounding-sized differences retain full scroll speed', () => {
  for (const [copy, panel] of [[400, 400], [600, 400], [400, 401], [0, 400], [400, 0]]) {
    assert.deepEqual(scrollState(copy, panel, 200), { enabled: false, speed: 1, translation: 0 });
  }
});

test('unclipped text remains opaque and viewport borders feather clipped text', () => {
  assert.deepEqual(fadeStops(300, 200, 76, 900, 28), [0, 0, 300, 300]);
  assert.deepEqual(fadeStops(300, 50, 76, 900, 28), [26, 54, 300, 300]);
  assert.deepEqual(fadeStops(300, 750, 76, 900, 28), [0, 0, 122, 150]);
  assert.equal(fadeStops(300, 901, 76, 900, 28), null);
  assert.equal(fadeStops(300, -300, 76, 900, 28), null);
});

test('tiny visible slivers fade in without overlapping or reversing gradient stops', () => {
  assert.deepEqual(fadeStops(300, 895, 76, 900, 28), [0, 0, 2.5, 5]);
  for (let top = -350; top < 950; top += 5) {
    const stops = fadeStops(300, top, 76, 900, 28);
    if (stops) for (let i = 1; i < stops.length; i++) assert(stops[i] >= stops[i - 1]);
  }
});
