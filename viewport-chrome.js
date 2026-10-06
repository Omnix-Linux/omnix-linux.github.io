/* Decides whether a viewport change is only mobile browser chrome (iOS Safari's
 * URL bar and toolbars sliding in and out), which must never re-run layout.
 *
 * Re-placing the hero mid-scroll rewrote the shader canvas and restarted its
 * render buffers, so the shader jerked when the toolbars came back. A size
 * threshold was not enough: newer iPhones swing more than 160px, and iOS fires
 * visualViewport resizes whose window size has not changed at all. */
(function (root) {
  // Width is what real layout changes (rotation, window resizes) move. On a touch
  // screen a height-only change is the browser's chrome, whatever its size; a
  // desktop window resized by hand only by small amounts is treated the same.
  function isChromeOnly(prev, next, coarse) {
    if (next.w !== prev.w) return false;
    if (next.h === prev.h) return true;
    return coarse || Math.abs(next.h - prev.h) <= 160;
  }
  function current() {
    return { w: document.documentElement.clientWidth, h: window.innerHeight };
  }
  var coarse = null;
  function isCoarse() {
    if (!coarse) coarse = window.matchMedia("(pointer: coarse)");
    return coarse.matches;
  }
  // Returns true for chrome-only changes; otherwise records the new size in
  // `metrics` and returns false so the caller re-runs its layout.
  function chromeResize(metrics) {
    var next = current();
    if (isChromeOnly(metrics, next, isCoarse())) return true;
    metrics.w = next.w; metrics.h = next.h;
    return false;
  }
  var api = { isChromeOnly: isChromeOnly, chromeResize: chromeResize, current: current };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ViewportChrome = api;
})(this);
