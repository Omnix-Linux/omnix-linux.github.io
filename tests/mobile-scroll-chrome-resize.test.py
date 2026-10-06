#!/usr/bin/env python3
"""Mobile-scroll chrome-resize test (iOS URL bar + toolbar slide-out).

Reproduces the iOS "motion jerk": while the page is scrolled on a phone-width
viewport, Safari's top URL bar and bottom toolbar slide out, so the viewport
HEIGHT grows with width constant. That fires `window` and `visualViewport`
resize events mid-scroll. On real iOS, svh-based CSS does NOT change when the
chrome collapses, so the test pins svh-derived layout values to their computed
px after load — mirroring real-device CSS stability — and then asserts the
site's resize handlers cause no motion:

  * a resize event IS received (the slide-out is real),
  * fixed hero elements keep their bounding boxes,
  * no inline style on them is rewritten,
  * no IntersectionObserver is torn down and rebuilt,
  * no minHeight rewrite happens on the omarchy demo section.

Before the fix, the site's resize handlers re-run layout math against
`window.innerHeight` and rebuild IntersectionObservers on every resize, so this
test FAILS (observer rebuilds + demo style churn). After the fix it PASSES.

Run:
  /home/niteris/.venv/bin/python3 tests/mobile-scroll-chrome-resize.test.py
"""
import http.server
import socket
import socketserver
import threading
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright

REPO = Path(__file__).resolve().parent.parent

# Instrumentation injected before any page script runs.
PROBE_JS = r"""
(function () {
  var probe = { resize: 0, vvResize: 0, io: 0, styleMutations: {} };
  window.__probe = probe;
  window.addEventListener("resize", function () { probe.resize++; }, true);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () { probe.vvResize++; });
  }
  var OrigIO = window.IntersectionObserver;
  if (typeof OrigIO === "function") {
    window.IntersectionObserver = new Proxy(OrigIO, {
      construct: function (target, args, newTarget) {
        probe.io++;
        return Reflect.construct(target, args, newTarget);
      }
    });
  }
  var sels = ["#coronal", ".logo-orbit", ".wordmark-text", ".tagline",
    ".site-header", ".rail", "#install-demo", ".desktop-demo"];
  function arm() {
    sels.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el || probe.styleMutations[sel] !== undefined) return;
      probe.styleMutations[sel] = 0;
      new MutationObserver(function (records) {
        records.forEach(function (r) {
          if (r.attributeName === "style") probe.styleMutations[sel]++;
        });
      }).observe(el, { attributes: true, attributeFilter: ["style"] });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arm);
  else arm();
})();
"""

# Pin svh-derived layout to current computed px. On real iOS, svh stays fixed
# while the URL bar/toolbars collapse; Chromium resolves svh to the live
# viewport, so pinning reproduces real-device CSS stability during the slide.
PIN_JS = r"""
(function pin() {
  // style.setProperty needs hyphenated CSS names; camelCase is silently ignored.
  var list = [].slice.call(document.querySelectorAll("main section, .wordmark"));
  list.forEach(function (el) {
    var cs = getComputedStyle(el);
    [["min-height", "minHeight"], ["padding-top", "paddingTop"],
     ["padding-bottom", "paddingBottom"], ["height", "height"]].forEach(function (pair) {
      var v = cs[pair[1]];
      if (v && v !== "auto" && v !== "normal") el.style.setProperty(pair[0], v, "important");
    });
  });
})();
"""

SNAP_JS = r"""
() => {
  var probe = window.__probe;
  var sels = ["#coronal", ".logo-orbit", ".wordmark-text", ".tagline",
    ".site-header", ".rail", "#install-demo", ".desktop-demo"];
  var out = {
    scrollY: document.getElementById('page').scrollTop,
    resize: probe.resize,
    vvResize: probe.vvResize,
    io: probe.io,
    styleMutations: Object.assign({}, probe.styleMutations),
    boxes: {},
    styles: {}
  };
  sels.forEach(function (sel) {
    var el = document.querySelector(sel);
    if (!el) return;
    var r = el.getBoundingClientRect();
    out.boxes[sel] = [r.x, r.y, r.width, r.height].map(function (v) {
      return Math.round(v * 100) / 100;
    });
    out.styles[sel] = el.getAttribute("style") || "";
  });
  return out;
}
"""

HERO_SELECTORS = ["#coronal", ".logo-orbit", ".wordmark-text", ".tagline",
                  ".site-header", ".rail"]


def start_server():
    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):  # keep test output focused on assertions
            pass

    handler = lambda *a, **kw: QuietHandler(*a, directory=str(REPO), **kw)
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


class MobileChromeResizeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd, cls.port = start_server()
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch()
        cls.ctx = cls.browser.new_context(
            viewport={"width": 390, "height": 750},
            device_scale_factor=3,
            is_mobile=True,
            has_touch=True,
            user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
        )
        cls.page = cls.ctx.new_page()
        cls.console = []
        cls.page.on("console", lambda m: cls.console.append(f"{m.type}: {m.text}")
                    if m.type in ("error", "warning") else None)
        cls.page.on("pageerror", lambda e: cls.console.append(f"pageerror: {e}"))
        cls.page.add_init_script(PROBE_JS)
        cls.page.goto(f"http://127.0.0.1:{cls.port}/index.html", wait_until="load")
        # Wait until hero placement has run (placeLogo writes inline width on .logo-orbit).
        cls.page.wait_for_function(
            "() => { var o = document.querySelector('.logo-orbit'); return o && o.style.width; }",
            timeout=20000)
        cls.page.evaluate("() => document.fonts && document.fonts.ready")
        cls.page.wait_for_timeout(800)
        # Requirement 1: phone-width viewport, page scrolled at least partially.
        cls.page.evaluate("() => document.getElementById('page').scrollTo({ top: 520, behavior: 'instant' })")
        cls.page.wait_for_timeout(1200)  # let reveals/observers settle
        cls.page.evaluate(PIN_JS)
        cls.page.wait_for_timeout(100)
        cls.scroll_y = cls.page.evaluate("() => document.getElementById('page').scrollTop")
        cls.baseline = cls.page.evaluate(SNAP_JS)
        # Requirement 2: slide-out of BOTH panes — top URL bar, then bottom
        # toolbar. Width constant, height grows (750 -> 797 -> 844).
        cls.page.set_viewport_size({"width": 390, "height": 797})
        cls.page.wait_for_timeout(150)
        cls.page.set_viewport_size({"width": 390, "height": 844})
        cls.page.wait_for_timeout(350)
        cls.after = cls.page.evaluate(SNAP_JS)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def test_chrome_slide_out_fires_resize_without_motion_jerk(self):
        before, after = self.baseline, self.after
        d_resize = after["resize"] - before["resize"]
        d_vv = after["vvResize"] - before["vvResize"]
        d_io = after["io"] - before["io"]
        print(f"\n  scrollY={self.scroll_y}  resize_events={d_resize}  "
              f"visualViewport_resizes={d_vv}  io_rebuilds={d_io}")
        problems = []
        for sel, n in sorted(after["styleMutations"].items()):
            d = n - before["styleMutations"].get(sel, 0)
            if d:
                print(f"  style_mutations[{sel}]={d}")

        # Requirement 3: the height-only slide-out must fire resize events.
        if d_resize < 1:
            problems.append(
                "height-only viewport change (both iOS panes sliding out) must fire "
                f"a window resize event; got {d_resize}")
        # The page must actually have been scrolled before the resize.
        if self.scroll_y <= 0:
            problems.append("page must be scrolled at least partially before the chrome resize")

        # No IntersectionObserver may be torn down and rebuilt: rebuilding on
        # height-only resizes re-fires isIntersecting and flickers hero state.
        if d_io != 0:
            problems.append(
                f"IntersectionObserver rebuilt during chrome resize (delta={d_io}); "
                "resize handlers must ignore height-only browser-chrome resizes")

        # No inline style may be rewritten (including the omarchy demo minHeight,
        # whose rewrite changes section height = the "extra space" jerk).
        for sel, n in sorted(after["styleMutations"].items()):
            d = n - before["styleMutations"].get(sel, 0)
            if d:
                problems.append(
                    f"inline style rewritten on {sel} during chrome resize (delta={d})")

        # Fixed hero elements must keep their position and styles.
        for sel in HERO_SELECTORS:
            if after["boxes"][sel] != before["boxes"][sel]:
                problems.append(
                    f"{sel} bounding box moved during chrome resize: "
                    f"{before['boxes'][sel]} -> {after['boxes'][sel]}")
            if after["styles"][sel] != before["styles"][sel]:
                problems.append(
                    f"{sel} inline style changed during chrome resize:\n"
                    f"    before: {before['styles'][sel]}\n"
                    f"    after:  {after['styles'][sel]}")

        # Scroll position must not drift from handler work.
        if after["scrollY"] != before["scrollY"]:
            problems.append("page scroll position changed during the resize simulation")

        if self.console:
            print("  console notes:")
            for line in self.console:
                print(f"    {line}")

        if problems:
            self.fail("\n  ".join(
                ["motion jerk reproduced — chrome resize caused:"] + problems))


if __name__ == "__main__":
    unittest.main(verbosity=2)
