// iOS Safari resizes the visible viewport while its toolbars slide. A fixed,
// full-screen backdrop sized with `inset: 0` follows that resize, so its
// gradient shifts mid-scroll and the page appears to jerk. Backdrops must take
// the large viewport height instead, which stays constant during the slide.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

for (const selector of ["body::before", ".scrim"]) {
  test(`${selector} keeps a constant height while iOS toolbars slide`, () => {
    const start = html.indexOf(`  ${selector} {`);
    assert.notStrictEqual(start, -1, `${selector} rule not found`);
    const rule = html.slice(start, html.indexOf("}", start));
    assert.match(rule, /position:\s*fixed/);
    assert.match(rule, /height:\s*100lvh/, "use the large viewport height");
    assert.doesNotMatch(rule, /inset:\s*0\s*;/, "inset: 0 resizes with the toolbars");
  });
}
