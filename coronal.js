/* Coronal by @Xor: https://fragcoord.xyz/s/3otcb9tt
 * Derived from 3D Fire: https://fragcoord.xyz/s/3zoe0vgo
 * Expanded from the source's Golf syntax into GLSL. No audio input is needed.
 */
afterFirstPaint(async function () {
  var canvas = document.getElementById("coronal");
  var orbit = document.querySelector(".logo-orbit");
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!orbit || !canvas) return;
  var profile;
  try {
    var response = await fetch(canvas.dataset.shaderProfile);
    if (!response.ok) return;
    profile = await response.json();
    if (profile.version !== 1 || profile.geometry.letter.character !== "O") return;
  } catch (e) { return; } // CSS and the poster supply the first-paint/offline fallback.
  var geometry = profile.geometry, rendering = profile.rendering;
  var wordmark = document.querySelector(".wordmark"), suffix = document.querySelector(".wordmark-text");
  function placeLogo() {
    var W = document.documentElement.clientWidth, H = window.innerHeight;
    var mode = W <= profile.layout.mobile.maxViewportWidth ? profile.layout.mobile : profile.layout.desktop;
    var box = wordmark.getBoundingClientRect();
    var size = Math.min(W * mode.sizeViewportWidth, H * mode.sizeViewportHeight);
    var centerX = W * mode.centerXViewport;
    var centerY = box.top + window.scrollY + box.height / 2;
    var left = centerX - geometry.letter.center.x * size;
    var top = centerY - geometry.letter.center.y * size;
    orbit.style.transform = "none";
    orbit.style.left = (left - box.left) + "px";
    orbit.style.top = (top - box.top - window.scrollY) + "px";
    orbit.style.width = orbit.style.height = size + "px";
    var letterHeight = (geometry.letter.bounds.bottom - geometry.letter.bounds.top) * size;
    var suffixLeft = left + geometry.letter.bounds.right * size + mode.suffixGapToArtworkSize * size;
    suffix.style.left = (suffixLeft - box.left) + "px";
    suffix.style.top = (box.height / 2) + "px";
    suffix.style.fontSize = Math.max(profile.layout.suffix.minFontSize,
      Math.min(profile.layout.suffix.maxFontSize, letterHeight * mode.suffixScaleToLetterHeight)) + "px";
    suffix.style.color = profile.layout.suffix.color;
    suffix.textContent = profile.layout.suffix.text;
    // Keep future profiles/longer suffixes inside a narrow viewport too.
    var suffixWidth = suffix.getBoundingClientRect().width;
    var available = Math.max(1, W - suffixLeft - 16);
    if (suffixWidth > available) suffix.style.fontSize = (parseFloat(suffix.style.fontSize) * available / suffixWidth) + "px";
    return { width: W, height: H, size: size, left: left, top: top, mode: mode };
  }
  document.querySelector(".logo-orbit img").src = profile.poster;
  placeLogo();
  if (typeof THREE === "undefined" || reduce.matches) {
    window.addEventListener("resize", placeLogo);
    if (document.fonts) document.fonts.ready.then(placeLogo);
    return;
  }
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false }); }
  catch (e) {
    window.addEventListener("resize", placeLogo);
    if (document.fonts) document.fonts.ready.then(placeLogo);
    return; // Keep the pre-rendered O when WebGL is unavailable.
  }
  var uniforms = {
    uCenter: { value: new THREE.Vector2() }, uDiameter: { value: 600 },
    uSurfaceSize: { value: new THREE.Vector2() }, uBufferSize: { value: new THREE.Vector2() },
    uTime: { value: 6 }
  };
  var material = new THREE.ShaderMaterial({
    uniforms: uniforms, depthTest: false, depthWrite: false,
    vertexShader: "void main() { gl_Position = vec4(position.xy, 0., 1.); }",
    fragmentShader: [
      "uniform vec2 uCenter, uSurfaceSize, uBufferSize; uniform float uDiameter, uTime;",
      "void main() {",
      "  vec2 pixel = gl_FragCoord.xy / uBufferSize * uSurfaceSize;",
      "  vec2 uv = 2. * (pixel - uCenter) / uDiameter;",
      "  if (length(uv) > 1.5) { gl_FragColor = vec4(0., 0., 0., 1.); return; }",
      "  vec3 ray = normalize(vec3(uv, -1.));",
      "  vec3 glow = vec3(0.);",
      "  float z = 2.;",
      "  for (int i = 0; i < 40; i++) {",
      "    vec3 p = z * ray, original = p;",
      "    float frequency = 2.;",
      "    for (int j = 0; j < 6; j++) {",
      "      frequency *= 2.;",
      "      p += sin(p.zxy * frequency + z - uTime) / frequency;",
      "    }",
      "    z += abs(1. - length(p.xy)) / 3.;",
      "    glow += (1.1 - cos(p)) / (z * z * max(abs(length(original.xy) - 1.), 0.001));",
      "  }",
      // Equivalent to tanh(glow / 30), with a bounded exponent for mobile GPUs.
      "  vec3 color = 1. - 2. / (exp(2. * min(glow / 30., vec3(10.))) + 1.);",
      "  gl_FragColor = vec4(color * (1. - smoothstep(1.1, 1.5, length(uv))), 1.);",
      "}"
    ].join("\n")
  });
  var scene = new THREE.Scene(), camera = new THREE.Camera();
  var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false; scene.add(quad);
  // Use CSS pixels for the shape and real drawing-buffer pixels for sampling.
  // Crop the GL surface to the visible glow and cap its total pixels independently of DPR.
  var quality = 1, raf = 0, resizeRaf = 0, last = 0, slow = 0, contextLost = false;
  var heroPast = false;
  function draw() {
    if (contextLost || reduce.matches) return;
    renderer.render(scene, camera);
    root.classList.add("shader-ready");
  }
  function layout() {
    var placement = placeLogo();
    var W = placement.width, H = placement.height, diameter = placement.size;
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
    var budget = (W <= profile.layout.mobile.maxViewportWidth ? rendering.mobileMaxPixels : rendering.desktopMaxPixels)
      * (heroPast ? rendering.backgroundPixelBudgetScale : 1);
    var ratio = Math.min(window.devicePixelRatio || 1, rendering.maxPixelRatio, Math.sqrt(budget / (width * height))) * quality;
    renderer.setPixelRatio(ratio); renderer.setSize(width, height, false);
    // Query WebGL itself: browser/GPU limits can differ from the requested buffer size.
    var gl = renderer.getContext(), surface = canvas.getBoundingClientRect();
    uniforms.uBufferSize.value.set(gl.drawingBufferWidth, gl.drawingBufferHeight);
    uniforms.uSurfaceSize.value.set(surface.width, surface.height);
    uniforms.uCenter.value.set(originX - surface.left, surface.height - (originY - surface.top));
    uniforms.uDiameter.value = diameter;
  }
  function resize() {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(function () { resizeRaf = 0; layout(); draw(); });
  }
  function frame(now) {
    raf = 0;
    if (document.hidden || reduce.matches || contextLost) return;
    var interval = 1000 / (heroPast ? rendering.backgroundFps : rendering.heroFps);
    if (!last || now - last >= interval) {
      if (last && now - last > interval * 1.8) slow++; else slow = Math.max(0, slow - 1);
      uniforms.uTime.value = now / 1000 + 6;
      if (slow > 6 && quality > rendering.minQuality) { quality = Math.max(rendering.minQuality, quality * 0.8); layout(); slow = 0; }
      draw(); last = now;
    }
    raf = requestAnimationFrame(frame);
  }
  function play() { if (!raf && !document.hidden && !reduce.matches && !contextLost) { last = 0; raf = requestAnimationFrame(frame); } }
  function pause() { cancelAnimationFrame(raf); raf = 0; }
  canvas.addEventListener("webglcontextlost", function (event) {
    event.preventDefault(); contextLost = true; pause(); root.classList.remove("shader-ready");
  });
  canvas.addEventListener("webglcontextrestored", function () { contextLost = false; resize(); play(); });
  document.addEventListener("visibilitychange", function () { document.hidden ? pause() : play(); });
  reduce.addEventListener("change", function () {
    if (reduce.matches) { pause(); root.classList.remove("shader-ready"); }
    else { resize(); play(); }
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      var next = entries[0].intersectionRatio < 0.35;
      root.classList.toggle("hero-past", next);
      if (heroPast !== next) { heroPast = next; last = 0; resize(); }
    }, { threshold: [0, 0.35] }).observe(document.getElementById("top"));
  }
  if (document.fonts) document.fonts.ready.then(resize);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(document.querySelector(".hero-inner"));
  window.addEventListener("resize", resize);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  resize(); play();
});
