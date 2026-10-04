/* DOM placement and OffscreenCanvas lifecycle for the shader-backed O.
 * Shader source and GPU resources live in shader-worker.js. */
afterFirstPaint(async function () {
  var canvas = document.getElementById("coronal");
  var orbit = document.querySelector(".logo-orbit");
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!orbit || !canvas) return;
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
  function placeLogo() {
    var W = document.documentElement.clientWidth, H = window.innerHeight;
    var mode = W <= registry.layout.mobile.maxViewportWidth ? registry.layout.mobile : registry.layout.desktop;
    // Read geometry together before touching any styles.
    var box = wordmark.getBoundingClientRect();
    var suffixStyle = getComputedStyle(suffix);
    var measuredFontSize = parseFloat(suffixStyle.fontSize);
    var widthPerPixel = suffix.getBoundingClientRect().width / measuredFontSize;
    var rightGutter = W > registry.layout.mobile.maxViewportWidth ? 48 : 16;
    var suffixWidth = Math.min(W * registry.layout.suffix.widthViewport, W - 16 - rightGutter);
    // Reserve the requested text width and room for the complete O rim.
    var maxArtworkSize = (W - suffixWidth - 16 - rightGutter) / (geometry.ring.radius * 2 + mode.suffixGapToArtworkSize);
    var size = Math.min(W * mode.sizeViewportWidth, H * mode.sizeViewportHeight, maxArtworkSize);
    var centerX = Math.min(W * mode.centerXViewport,
      W - suffixWidth - rightGutter - (geometry.ring.radius + mode.suffixGapToArtworkSize) * size);
    var centerY = box.top + window.scrollY + box.height / 2;
    var left = centerX - geometry.ring.center.x * size;
    var top = centerY - geometry.ring.center.y * size;
    orbit.style.transform = "none";
    orbit.style.left = (left - box.left) + "px";
    orbit.style.top = (top - box.top - window.scrollY) + "px";
    orbit.style.width = orbit.style.height = size + "px";
    var anchor = ShaderLayout.ringAnchor(geometry.ring, { left: left, top: top, size: size }, mode.suffixGapToArtworkSize);
    var suffixLeft = anchor.x;
    suffix.style.left = suffixLeft + "px";
    suffix.style.top = anchor.y + "px";
    // Measure once, then size the four letters to the viewport width target.
    var available = Math.max(1, W - suffixLeft - rightGutter);
    var fontSize = widthPerPixel > 0 ? Math.min(suffixWidth, available) / widthPerPixel : measuredFontSize;
    suffix.style.fontSize = fontSize + "px";
    suffix.style.color = registry.layout.suffix.color;
    var mobileTagline = W <= registry.layout.mobile.maxViewportWidth;
    tagline.style.setProperty("--tagline-left", (mobileTagline ? 16 : suffixLeft) + "px");
    tagline.style.setProperty("--tagline-top", (mobileTagline ? anchor.y + anchor.radius + 24 : anchor.y + fontSize / 2 + Math.max(16, fontSize * .18)) + "px");
    tagline.style.setProperty("--tagline-width", (mobileTagline ? W - 32 : available) + "px");
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
      worker = new Worker("shader-worker.js");
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
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      var next = entries[0].intersectionRatio < .35;
      root.classList.toggle("hero-past", next);
    }, { threshold: [0, .35] }).observe(document.getElementById("top"));
  }
  if (document.fonts) document.fonts.ready.then(resize);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(document.querySelector(".hero-inner"));
  window.addEventListener("resize", resize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  resize();
});
