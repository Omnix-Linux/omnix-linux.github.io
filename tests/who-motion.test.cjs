// The #who statement must "magnetically fall into view, then release" with pure CSS: a rush on a
// view() timeline, a sticky pin whose final settle is a second scroll-driven ease-out, a hold
// from extra section length, then normal scrolling. No scroll listener may drive it (iOS jitter),
// reduced motion and unsupported browsers keep the static block, and no scroll snap may trap the page.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("@supports (animation-timeline: view()) and (position: sticky)");
const block = html.slice(start, html.indexOf("@keyframes who-rush", start));
const keyframes = (name) => {
  const kf = html.slice(html.indexOf(`@keyframes ${name}`));
  return kf.slice(0, kf.indexOf("\n  }\n"));
};

test("the #who statement rushes, then locks, on its own view timeline", () => {
  assert.notStrictEqual(start, -1);
  assert.match(block, /#who\s*\{[^}]*view-timeline:\s*--who block/);
  assert.match(block, /animation:\s*who-rush linear both,\s*who-lock linear both/);
  assert.match(block, /animation-timeline:\s*--who,\s*--who/);
  // The rush ends exactly where the lock (and the pin) begins.
  assert.match(block, /animation-range:\s*entry 0% entry var\(--who-d\),\s*entry var\(--who-d\) entry calc\(var\(--who-d\) \+ var\(--who-lock\)\)/);
  assert.match(html, /--who-d:\s*calc\(100svh - var\(--who-pin\) \+ clamp\(80px, 12svh, 150px\)\)/);
});

test("the statement pins with position: sticky and holds for extra section length", () => {
  assert.match(block, /#who \.statement-inner \{[^}]*position: sticky; top: var\(--who-pin\)/);
  assert.match(html, /--who-pin:\s*calc\(var\(--header-height\) \+ 24px\)/);
  // A grid item's sticky box is confined to its row, so #who must be a block here.
  assert.match(block, /#who \{[^}]*display: block/);
  assert.match(block, /#who::after \{[^}]*height: calc\(var\(--who-lock\) \+ var\(--who-hold\)\)/);
  assert.match(block, /--who-hold: 40svh/);
  assert.match(block, /@media \(max-width: 860px\) \{ #who \{ --who-lock: \d+svh; --who-hold: \d+svh; \} \}/);
});

test("keyframes move only translate/transform/opacity and end at rest", () => {
  const rush = keyframes("who-rush");
  const lock = keyframes("who-lock");
  for (const body of [rush, lock]) {
    for (const [, prop] of body.matchAll(/([a-z-]+):/g)) {
      assert.ok(["translate", "transform", "opacity", "animation-timing-function"].includes(prop), prop);
    }
  }
  assert.match(rush, /to \{ translate: none/);
  assert.match(lock, /to \{ transform: none/);
  // The lock starts lock/2 low on a quadratic ease-out (start speed 2 x lock/2 / lock = 1:1 with the scroll).
  assert.match(lock, /calc\(var\(--who-lock\) \/ 2\)/);
  assert.match(lock, /cubic-bezier\(0\.333, 0\.667, 0\.667, 1\)/);
});

test("reduced motion gets no scroll-driven motion and no hold", () => {
  assert.match(block, /@media \(prefers-reduced-motion: no-preference\)/);
  const outside = html.slice(0, start) + html.slice(html.indexOf("@keyframes who-rush"));
  assert.doesNotMatch(outside, /#who[^{]*\{[^}]*(position: sticky|view-timeline|--who-hold)/);
});

test("no JS scroll listener drives the statement", () => {
  for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
    if (/addEventListener\(\s*["']scroll/.test(m[1])) assert.doesNotMatch(m[1], /#who|statement-inner/);
  }
});

test("scroll snapping, if any, is proximity only and never on #who", () => {
  assert.doesNotMatch(html, /scroll-snap-type:[^;]*mandatory/);
  // Chrome's proximity snap on the tall held section pulled wheel scrolls back to its edges.
  assert.doesNotMatch(block, /scroll-snap-align/);
});
