// The #who headline's scroll motion must be pure CSS: a view() timeline, frame-accurate
// on iOS, with no scroll listener driving it, disabled under reduced motion, and any
// scroll snapping only proximity (mandatory snapping traps the page).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("@supports (animation-timeline: view())");
const block = html.slice(start, html.indexOf("@keyframes who-rise", start));

test("the #who statement animates on a view timeline", () => {
  assert.notStrictEqual(start, -1);
  assert.match(block, /#who\s*\{\s*view-timeline:\s*--who block/);
  assert.match(block, /animation-timeline:\s*--who/);
  assert.match(block, /animation-range:\s*entry 0% entry \d+svh/);
});

test("the keyframes move only transform and opacity and end at rest", () => {
  const kf = html.slice(html.indexOf("@keyframes who-rise"));
  const body = kf.slice(0, kf.indexOf("\n  }\n"));
  for (const [, prop] of body.matchAll(/([a-z-]+):/g)) {
    assert.ok(["transform", "opacity", "animation-timing-function"].includes(prop), prop);
  }
  assert.match(body, /to \{ transform: none/);
});

test("reduced motion gets no scroll-driven motion", () => {
  assert.match(block, /@media \(prefers-reduced-motion: no-preference\)/);
});

test("no JS scroll listener drives the headline", () => {
  for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
    if (/addEventListener\(\s*["']scroll/.test(m[1])) assert.doesNotMatch(m[1], /#who|statement-inner/);
  }
});

test("scroll snapping is proximity only", () => {
  assert.doesNotMatch(html, /scroll-snap-type:[^;]*mandatory/);
  assert.match(block, /scroll-snap-type:\s*y proximity/);
});
