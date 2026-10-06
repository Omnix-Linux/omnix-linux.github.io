// The shared rule that keeps iOS toolbar slides from re-running the hero
// placement (and restarting the shader's render buffers mid-scroll).
const test = require('node:test');
const assert = require('node:assert/strict');
const { isChromeOnly } = require('../viewport-chrome.js');

const phone = { w: 390, h: 664 };

test('an event with an unchanged size is not a layout change', () => {
  // iOS fires visualViewport resizes like this while its toolbars animate.
  assert.equal(isChromeOnly(phone, { w: 390, h: 664 }, true), true);
  assert.equal(isChromeOnly(phone, { w: 390, h: 664 }, false), true);
});

test('any height-only change on a touch screen is browser chrome', () => {
  assert.equal(isChromeOnly(phone, { w: 390, h: 744 }, true), true);
  // Newer iPhones collapse both toolbars for more than 160px.
  assert.equal(isChromeOnly(phone, { w: 390, h: 864 }, true), true);
  assert.equal(isChromeOnly(phone, { w: 390, h: 480 }, true), true);
});

test('a desktop window resized in height re-runs layout beyond small changes', () => {
  assert.equal(isChromeOnly({ w: 1440, h: 900 }, { w: 1440, h: 980 }, false), true);
  assert.equal(isChromeOnly({ w: 1440, h: 900 }, { w: 1440, h: 600 }, false), false);
});

test('a width change (rotation, window resize) always re-runs layout', () => {
  assert.equal(isChromeOnly(phone, { w: 844, h: 390 }, true), false);
  assert.equal(isChromeOnly(phone, { w: 391, h: 664 }, true), false);
});
