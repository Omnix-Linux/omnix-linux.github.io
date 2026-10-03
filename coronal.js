/* Coronal by @Xor: https://fragcoord.xyz/s/3otcb9tt
 * Derived from 3D Fire: https://fragcoord.xyz/s/3zoe0vgo
 * Expanded from the source's Golf syntax into GLSL. No audio input is needed.
 */
afterFirstPaint(function () {
  var canvas = document.getElementById("coronal");
  var orbit = document.querySelector(".logo-orbit");
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!orbit || typeof THREE === "undefined" || reduce.matches) return;
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false }); }
  catch (e) { return; } // Keep the pre-rendered O when WebGL is unavailable.
  var uniforms = { uCenter: { value: new THREE.Vector2() }, uDiameter: { value: 600 }, uTime: { value: 6 } };
  var material = new THREE.ShaderMaterial({
    uniforms: uniforms, depthTest: false, depthWrite: false,
    vertexShader: "void main() { gl_Position = vec4(position.xy, 0., 1.); }",
    fragmentShader: [
      "uniform vec2 uCenter; uniform float uDiameter, uTime;",
      "void main() {",
      "  vec2 uv = 2. * (gl_FragCoord.xy - uCenter) / uDiameter;",
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
  // Render a full-page backdrop, skipping pixels beyond the large O.
  var scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.45;
  var visible = true, raf = 0, last = 0, slow = 0;
  function draw() {
    renderer.render(scene, camera);
    root.classList.add("shader-ready");
  }
  function resize() {
    var rect = orbit.getBoundingClientRect();
    var W = window.innerWidth, H = window.innerHeight;
    renderer.setPixelRatio(scale); renderer.setSize(W, H, false);
    var buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
    // Keep the O anchored to its initial hero position as the page scrolls.
    var centerY = rect.top + window.scrollY + rect.height / 2;
    uniforms.uCenter.value.set((rect.left + rect.width / 2) * buffer.x / W, (H - centerY) * buffer.y / H);
    uniforms.uDiameter.value = rect.width * buffer.x / W;
    draw();
  }
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden || reduce.matches) return;
    // A modest 30fps cap also leaves time for the lettering's particle animation.
    if (now - last >= 1000 / 30) {
      if (last && now - last > 70) slow++; else slow = Math.max(0, slow - 1);
      uniforms.uTime.value = now / 1000 + 6;
      if (slow > 12 && scale > 0.35) { scale = Math.max(0.35, scale * 0.8); resize(); slow = 0; }
      draw(); last = now;
    }
    raf = requestAnimationFrame(frame);
  }
  function play() { if (!raf && visible && !document.hidden && !reduce.matches) { last = 0; raf = requestAnimationFrame(frame); } }
  function pause() { cancelAnimationFrame(raf); raf = 0; }
  canvas.addEventListener("webglcontextlost", function (event) { event.preventDefault(); pause(); root.classList.remove("shader-ready"); });
  canvas.addEventListener("webglcontextrestored", function () { resize(); play(); });
  document.addEventListener("visibilitychange", function () { document.hidden ? pause() : play(); });
  reduce.addEventListener("change", function () {
    if (reduce.matches) { pause(); root.classList.remove("shader-ready"); }
    else { draw(); play(); }
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      root.classList.toggle("hero-past", entries[0].intersectionRatio < 0.35);
    }, { threshold: [0, 0.35] }).observe(document.getElementById("top"));
  }
  if (document.fonts) document.fonts.ready.then(resize);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(orbit);
  window.addEventListener("resize", resize);
  resize(); play();
});
