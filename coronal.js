/* DOM placement and OffscreenCanvas lifecycle for the shader-backed O.
 * Shader source and GPU resources live in shader-worker.js. */
afterFirstPaint(async function () {
  var canvas = document.getElementById("coronal");
  var orbit = document.querySelector(".logo-orbit");
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!orbit || !canvas) return;
  // The hero fades with scroll instead of flipping at a threshold, so the
  // wordmark leaves as the next section arrives at every viewport height.
  // Distances are fractions of a height cached across iOS chrome churn. This runs
  // before the profile fetch so the fade works even if the shader never loads.
  var scroller = document.getElementById("page") || document.scrollingElement;
  var fadeRaf = 0, lastFade = -1, fadeMetrics = ViewportChrome.current();
  function heroFade() {
    fadeRaf = 0;
    var h = fadeMetrics.h;
    var f = Math.min(1, Math.max(0, (scroller.scrollTop - h * .08) / (h * .42)));
    f = Math.round(f * 100) / 100;
    if (f === lastFade) return;
    lastFade = f;
    root.style.setProperty("--hero-fade", f);
  }
  // Browsers with scroll-driven animations fade the hero in CSS, in the same frame
  // as the scroll; a listener here would trail it by a frame.
  var cssScrollFade = window.CSS && CSS.supports && CSS.supports("animation-timeline: --page")
    && CSS.supports("timeline-scope: --page");
  if (!cssScrollFade) {
    scroller.addEventListener("scroll", function () { if (!fadeRaf) fadeRaf = requestAnimationFrame(heroFade); }, { passive: true });
    window.addEventListener("resize", function () { if (!ViewportChrome.chromeResize(fadeMetrics)) heroFade(); });
    heroFade();
  }
  var logoFontReady = Promise.all([
    document.fonts.load('800 140px "Lexend"', "mnix"),
    document.fonts.load('500 20px "JetBrains Mono"', "A NixOS-fork compatible with Omarchy and friends")
  ]);
  function revealWordmark() { root.classList.add("wordmark-ready"); }
  var registry, profile;
  try {
    var response = await fetch(canvas.dataset.shaderProfile);
    if (!response.ok) throw new Error("Shader profile unavailable");
    registry = await response.json();
    if (registry.version !== 2) throw new Error("Unsupported shader profile");
    var shaderEnum = canvas.dataset.shader || registry.activeShader;
    profile = registry.shaders[shaderEnum];
    if (!profile || profile.geometry.ring.character !== "O") throw new Error("Unsupported logo geometry");
    await logoFontReady;
  } catch (e) { logoFontReady.then(revealWordmark).catch(function () {}); return; }
  var geometry = profile.geometry, rendering = registry.rendering;
  var wordmark = document.querySelector(".wordmark"), suffix = document.querySelector(".wordmark-text");
  var tagline = document.querySelector(".tagline");
  suffix.textContent = registry.layout.suffix.text;
  var suffixWidthPerPixel = null;
  var hero = document.getElementById("top");
  // Document offset from layout, not getBoundingClientRect() + scrollY: iOS can
  // report those out of step while its toolbars animate, which moved the shader.
  function documentTop(el) {
    var top = 0;
    for (; el; el = el.offsetParent) top += el.offsetTop;
    return top;
  }
  function placeLogo() {
    var W = document.documentElement.clientWidth;
    // Browser chrome changes innerHeight during mobile scrolling; svh stays stable.
    var H = W <= 860 ? parseFloat(getComputedStyle(hero).minHeight) : window.innerHeight;
    H = H || window.innerHeight;
    var mode = W <= registry.layout.mobile.maxViewportWidth ? registry.layout.mobile : registry.layout.desktop;
    // Read geometry together before touching any styles.
    var box = wordmark.getBoundingClientRect();
    var measuredFontSize = parseFloat(getComputedStyle(suffix).fontSize);
    if (suffixWidthPerPixel === null) suffixWidthPerPixel = suffix.getBoundingClientRect().width / measuredFontSize;
    var widthPerPixel = suffixWidthPerPixel;
    var rightGutter = W > registry.layout.mobile.maxViewportWidth ? 48 : 16;
    var suffixWidth = Math.min(W * registry.layout.suffix.widthViewport, W - 16 - rightGutter);
    var fontSize = widthPerPixel > 0 ? suffixWidth / widthPerPixel : measuredFontSize;
    // Treat the O as a letter beside mnix, with a balanced, centered wordmark.
    var maxArtworkSize = (W - suffixWidth - 16 - rightGutter) / (geometry.ring.radius * 2 + mode.suffixGapToArtworkSize);
    // Phones have height to spare, so the O grows past the desktop letter ratio
    // instead of leaving the hero slack. The width cap still bounds it.
    var ringRatio = mode.ringDiameterToFontSize || registry.layout.suffix.ringDiameterToFontSize;
    var size = Math.min(W * mode.sizeViewportWidth, H * mode.sizeViewportHeight, maxArtworkSize,
      fontSize * ringRatio / (geometry.ring.radius * 2));
    var ringRadius = geometry.ring.radius * size;
    var groupWidth = ringRadius * 2 + mode.suffixGapToArtworkSize * size + suffixWidth;
    var groupLeft = Math.max(16, Math.min((W - groupWidth) / 2, W - groupWidth - rightGutter));
    var centerX = groupLeft + ringRadius;
    var wordmarkTop = documentTop(wordmark);
    var centerY = wordmarkTop + wordmark.offsetHeight / 2;
    var left = centerX - geometry.ring.center.x * size;
    var top = centerY - geometry.ring.center.y * size;
    orbit.style.transform = "none";
    orbit.style.left = (left - box.left) + "px";
    orbit.style.top = (top - wordmarkTop) + "px";
    orbit.style.width = orbit.style.height = size + "px";
    orbit.style.setProperty("--rim-left", ((geometry.ring.center.x - geometry.ring.radius) * 100) + "%");
    orbit.style.setProperty("--rim-top", ((geometry.ring.center.y - geometry.ring.radius) * 100) + "%");
    orbit.style.setProperty("--rim-size", (geometry.ring.radius * 200) + "%");
    var anchor = ShaderLayout.ringAnchor(geometry.ring, { left: left, top: top, size: size }, mode.suffixGapToArtworkSize);
    var suffixLeft = anchor.x;
    suffix.style.left = suffixLeft + "px";
    suffix.style.top = anchor.y + "px";
    suffix.style.fontSize = fontSize + "px";
    suffix.style.color = registry.layout.suffix.color;
    var taglineWidth = Math.min(W - suffixLeft - rightGutter, 640);
    tagline.style.setProperty("--tagline-left", suffixLeft + "px");
    var taglineTop = anchor.y + Math.max(anchor.radius, fontSize / 2) + 28;
    tagline.style.setProperty("--tagline-top", taglineTop + "px");
    tagline.style.setProperty("--tagline-width", taglineWidth + "px");
    if (reduce.matches) revealWordmark();
    return { width: W, height: H, size: size, left: left, top: top, mode: mode };
  }
  // The main thread owns DOM placement only. Rendering and cached textures
  // belong to the worker after the canvas is transferred exactly once.
  var worker = null, failed = false, suspended = false, revision = 0, resizeRaf = 0;
  var lastLayout = null, sentLayout = null;
  var startupTimer = 0;
  canvas.dataset.backend = "pending";
  rendering = Object.assign({ heroShaderFps: 20, mobileShaderFps: 15 }, rendering);
  function isActive() { return !document.hidden && !reduce.matches && !suspended; }
  function fallback() {
    failed = true; clearTimeout(startupTimer);
    if (worker) { worker.terminate(); worker = null; }
    root.classList.remove("shader-ready"); canvas.dataset.backend = "unavailable";
    revealWordmark();
  }
  function surface() {
    var placement = placeLogo(), geometry = profile.geometry;
    var diameter = placement.size, W = placement.width, H = placement.height;
    var originX = placement.left + geometry.shaderOrigin.x * diameter;
    var originY = placement.top + geometry.shaderOrigin.y * diameter;
    var left = Math.max(0, Math.floor(placement.left + geometry.effectBounds.left * diameter));
    var top = Math.max(0, Math.floor(placement.top + geometry.effectBounds.top * diameter));
    var right = Math.min(W, Math.ceil(placement.left + geometry.effectBounds.right * diameter));
    var bottom = Math.min(H, Math.ceil(placement.top + geometry.effectBounds.bottom * diameter));
    var width = Math.max(1, right - left), height = Math.max(1, bottom - top);
    canvas.style.inset = "auto";
    canvas.style.left = left + "px"; canvas.style.top = top + "px";
    canvas.style.width = width + "px"; canvas.style.height = height + "px";
    var next = { width: width, height: height, centerX: originX - left,
      centerY: height - (originY - top), diameter: diameter,
      pixelRatio: window.devicePixelRatio || 1,
      mobile: W <= registry.layout.mobile.maxViewportWidth };
    if (lastLayout && Object.keys(next).every(function (key) { return next[key] === lastLayout[key]; })) return lastLayout;
    next.revision = ++revision;
    return lastLayout = next;
  }
  function start(layout) {
    if (worker || failed || !isActive()) return;
    if (profile.renderer !== "coronal" || typeof Worker === "undefined"
      || typeof canvas.transferControlToOffscreen !== "function") { fallback(); return; }
    try {
      layout = layout || surface();
      worker = new Worker("shader-worker.js?v=" + encodeURIComponent(canvas.dataset.shaderVersion));
      worker.onerror = function (event) { event.preventDefault(); fallback(); };
      worker.onmessageerror = fallback;
      worker.onmessage = function (event) {
        if (failed) return;
        var message = event.data;
        if (message.type === "ready" && message.revision === revision) {
          clearTimeout(startupTimer);
          canvas.dataset.backend = "worker";
          canvas.dataset.graphicsBackend = message.backend;
          canvas.dataset.hdrOutput = String(message.hdrOutput);
          canvas.dataset.renderPixels = message.pixels;
          canvas.dataset.cacheBytes = message.cacheBytes;
          if (!reduce.matches) root.classList.add("shader-ready", "wordmark-ready");
        } else if (message.type === "lost") {
          root.classList.remove("shader-ready");
          clearTimeout(startupTimer);
          if (isActive()) startupTimer = setTimeout(fallback, 8000);
        } else if (message.type === "fallback") fallback();
      };
      var offscreen = canvas.transferControlToOffscreen();
      worker.postMessage({ type: "init", canvas: offscreen, renderer: profile.renderer,
        rendering: rendering, layout: layout, active: isActive() }, [offscreen]);
      sentLayout = layout;
      startupTimer = setTimeout(fallback, 8000);
    } catch (error) { fallback(); }
  }
  function resize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(function () {
      resizeRaf = 0;
      var layout = surface();
      if (worker && layout !== sentLayout) {
        worker.postMessage({ type: "resize", layout: layout }); sentLayout = layout;
      } else if (!worker) start(layout);
    });
  }
  function state() {
    clearTimeout(startupTimer);
    if (worker && isActive() && !root.classList.contains("shader-ready")) startupTimer = setTimeout(fallback, 8000);
    if (reduce.matches) { root.classList.remove("shader-ready"); revealWordmark(); }
    if (worker) worker.postMessage({ type: "state", active: isActive() });
    else start();
  }
  document.addEventListener("visibilitychange", state);
  reduce.addEventListener("change", state);
  window.addEventListener("pagehide", function (event) {
    suspended = true;
    if (event.persisted) state();
    else { clearTimeout(startupTimer); if (worker) worker.terminate(); worker = null; }
  });
  window.addEventListener("pageshow", function () { suspended = false; state(); resize(); });
  // iOS Safari slides its URL bar/toolbars in and out while scrolling: window
  // height wobbles by up to the chrome height while width holds, and the svh
  // layout below does not change with it. Re-running placement or rebuilding
  // observers on that churn rewrites the fixed hero styles mid-scroll (jerk).
  var viewportMetrics = ViewportChrome.current();
  function chromeResize() { return ViewportChrome.chromeResize(viewportMetrics); }
  if (document.fonts) document.fonts.ready.then(resize);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(document.querySelector(".hero-inner"));
  window.addEventListener("resize", function () { if (!chromeResize()) resize(); });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", function () { if (!chromeResize()) resize(); });
  resize();
});
