/* Match the shorter copy column's travel to the taller evidence column. */
(function (root) {
  "use strict";
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function scrollState(copyHeight, panelHeight, distance) {
    var gap = panelHeight - copyHeight;
    if (copyHeight <= 0 || panelHeight <= 0 || gap <= 1) {
      return { enabled: false, speed: 1, translation: 0 };
    }
    return {
      enabled: true,
      speed: copyHeight / panelHeight,
      translation: gap * clamp(distance / panelHeight, 0, 1)
    };
  }

  function fadeStops(height, screenTop, inset, viewportHeight, fadeSize) {
    var top = clamp(inset - screenTop, 0, height);
    var bottom = clamp(viewportHeight - screenTop, 0, height);
    if (bottom <= top) return null;
    var feather = Math.min(fadeSize, (bottom - top) / 2);
    return [top, top + (top > 0 ? feather : 0),
      bottom - (bottom < height ? feather : 0), bottom];
  }

  var api = { scrollState: scrollState, fadeStops: fadeStops };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (!root.document || typeof root.afterFirstPaint !== "function") return;

  root.afterFirstPaint(function () {
    var wide = root.matchMedia("(min-width: 861px)");
    var reduce = root.matchMedia("(prefers-reduced-motion: reduce)");
    // The page scrolls inside #page, not the document (see index.html).
    var scroller = document.getElementById("page") || document.scrollingElement;
    var entries = [];
    var frame = 0, needsMeasure = true, viewportHeight = 0, inset = 0;
    document.querySelectorAll("main section:not(.hero) > .split").forEach(function (split) {
      if (split.children.length !== 2) return;
      var copy = split.children[0], panel = split.children[1];
      var pane = document.createElement("div");
      pane.className = "scroll-copy-pane";
      split.insertBefore(pane, copy);
      pane.appendChild(copy);
      copy.classList.add("scroll-copy");
      entries.push({ split: split, pane: pane, copy: copy, panel: panel,
        enabled: false, top: 0, copyHeight: 0, panelHeight: 0, transform: "", mask: "" });
    });

    function schedule(measure) {
      if (measure === true) needsMeasure = true;
      if (!frame) frame = requestAnimationFrame(update);
    }
    function measure() {
      needsMeasure = false;
      viewportHeight = root.innerHeight;
      inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-height")) || 76;
      var allowed = wide.matches && !reduce.matches;
      // Read natural sizes before changing any grid alignment. offsetHeight excludes
      // the existing entrance transforms, which must not affect eligibility.
      entries.forEach(function (entry) {
        entry.copyHeight = entry.copy.offsetHeight;
        entry.panelHeight = entry.panel.offsetHeight;
        entry.enabled = allowed && scrollState(entry.copyHeight, entry.panelHeight, 0).enabled;
      });
      entries.forEach(function (entry) {
        entry.split.classList.toggle("dual-scroll", entry.enabled);
      });
      // Geometry is cached only on layout changes; scroll frames read no DOM bounds.
      entries.forEach(function (entry) {
        if (entry.enabled) entry.top = entry.pane.getBoundingClientRect().top + scroller.scrollTop;
      });
    }
    function update() {
      frame = 0;
      if (needsMeasure) measure();
      var scrollY = scroller.scrollTop;
      entries.forEach(function (entry) {
        var transform = "", mask = "";
        if (entry.enabled) {
          var state = scrollState(entry.copyHeight, entry.panelHeight, scrollY + inset - entry.top);
          transform = "translateY(" + state.translation.toFixed(3) + "px)";
          if (entry.split.dataset.scrollFade !== "false" && !entry.copy.contains(document.activeElement)) {
            var stops = fadeStops(entry.copyHeight, entry.top - scrollY + state.translation,
              inset, viewportHeight, 28);
            if (!stops) mask = "linear-gradient(transparent, transparent)";
            else if (stops[0] > 0 || stops[3] < entry.copyHeight) {
              mask = "linear-gradient(to bottom, transparent " + stops[0].toFixed(2) + "px, " +
                "#000 " + stops[1].toFixed(2) + "px, #000 " + stops[2].toFixed(2) + "px, " +
                "transparent " + stops[3].toFixed(2) + "px)";
            }
          }
        }
        if (entry.transform !== transform) {
          entry.copy.style.transform = transform;
          entry.transform = transform;
        }
        if (entry.mask !== mask) {
          entry.copy.style.maskImage = mask;
          entry.copy.style.webkitMaskImage = mask;
          entry.mask = mask;
        }
      });
    }
    scroller.addEventListener("scroll", function () { schedule(false); }, { passive: true });
    // The column layout is width-driven; a chrome-only height change (iOS URL
    // bar/toolbars sliding during scroll) needs no re-measure or mask rebuild.
    var resizeMetrics = root.ViewportChrome.current();
    root.addEventListener("resize", function () {
      if (!root.ViewportChrome.chromeResize(resizeMetrics)) schedule(true);
    });
    root.addEventListener("pageshow", function () { schedule(true); });
    wide.addEventListener("change", function () { schedule(true); });
    reduce.addEventListener("change", function () { schedule(true); });
    document.addEventListener("focusin", function () { schedule(false); });
    document.addEventListener("focusout", function () { schedule(false); });
    if (typeof ResizeObserver !== "undefined") {
      var observer = new ResizeObserver(function () { schedule(true); });
      entries.forEach(function (entry) {
        observer.observe(entry.split);
        observer.observe(entry.copy);
        observer.observe(entry.panel);
      });
    }
    if (typeof IntersectionObserver !== "undefined") {
      // content-visibility may postpone offscreen layout and ResizeObserver delivery.
      // Refresh before a section enters the viewport so its cached geometry is current.
      var nearby = new IntersectionObserver(function () { schedule(true); }, { rootMargin: "100% 0px" });
      entries.forEach(function (entry) { nearby.observe(entry.split.parentElement); });
    }
    // Section reveals/content-visibility and late font loads may change cached positions.
    if (typeof MutationObserver !== "undefined") {
      var mutations = new MutationObserver(function () { schedule(true); });
      entries.forEach(function (entry) {
        mutations.observe(entry.split.parentElement, { attributes: true, attributeFilter: ["class"] });
        mutations.observe(entry.split, { attributes: true, attributeFilter: ["data-scroll-fade"] });
      });
    }
    if (document.fonts) document.fonts.ready.then(function () { schedule(true); });
    schedule(true);
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
