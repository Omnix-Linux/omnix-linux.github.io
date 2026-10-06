// The hero shader dims on a trigger with a fixed half-second fade, not with the
// scroll position: a fast flick past the hero must not skip the fade.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'coronal.js'), 'utf8');

test('the shader fades over 0.5s when html.hero-dimmed toggles', () => {
  assert.match(html, /#coronal \{[^}]*transition:[^}]*opacity \.5s/);
  assert.match(html, /\.hero-dimmed #coronal \{ opacity: \.08; \}/);
});

test('the shader is not tied to the scroll timeline or --hero-fade', () => {
  assert.doesNotMatch(html, /hero-fade-shader/);
  assert.doesNotMatch(html, /#coronal \{ opacity: calc\(/);
  const scrollRule = html.slice(html.indexOf('@supports (animation-timeline: --page)'));
  assert.doesNotMatch(scrollRule.slice(0, scrollRule.indexOf('}')), /#coronal/);
});

test('two hero markers drive the trigger with hysteresis, not a scroll listener', () => {
  assert.match(html, /<section class="hero" id="top">\s*<div class="hero-dim-trigger" aria-hidden="true"><\/div>\s*<div class="hero-wake-trigger" aria-hidden="true"><\/div>/);
  // Dims 20svh in going down; wakes as soon as you scroll back above 45svh.
  assert.match(html, /\.hero-dim-trigger \{ top: 20svh; \}/);
  assert.match(html, /\.hero-wake-trigger \{ top: 45svh; \}/);
  assert.match(js, /new IntersectionObserver\([\s\S]*?hero-dimmed[\s\S]*?observer\.observe\(dimTrigger\);\s*observer\.observe\(wakeTrigger\);/);
});
