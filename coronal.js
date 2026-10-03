/* Coronal by @Xor: https://fragcoord.xyz/s/3otcb9tt
 * Derived from 3D Fire: https://fragcoord.xyz/s/3zoe0vgo
 * Expanded from the source's Golf syntax into GLSL. No audio input is needed.
 */
afterFirstPaint(function () {
  var canvas = document.getElementById("coronal");
  var orbit = canvas && canvas.parentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!orbit || typeof THREE === "undefined" || reduce.matches) return;
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false }); }
  catch (e) { return; } // Keep the pre-rendered O when WebGL is unavailable.
  var uniforms = { uResolution: { value: new THREE.Vector2() }, uTime: { value: 6 } };
  var material = new THREE.ShaderMaterial({
    uniforms: uniforms, depthTest: false, depthWrite: false,
    vertexShader: "void main() { gl_Position = vec4(position.xy, 0., 1.); }",
    fragmentShader: [
      "uniform vec2 uResolution; uniform float uTime;",
      "void main() {",
      "  vec3 ray = normalize(vec3(2. * gl_FragCoord.xy - uResolution, -uResolution.y));",
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
      "  gl_FragColor = vec4(color, 1.);",
      "}"
    ].join("\n")
  });
  var scene = new THREE.Scene(), camera = new THREE.Camera();
  var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false; scene.add(quad);
  // Bound the expensive 40 × 6 raymarch to the O, never the full viewport.
  var scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.65;
  var visible = false, raf = 0, last = 0, slow = 0;
  function draw() {
    renderer.render(scene, camera);
    orbit.classList.add("shader-ready");
  }
  function resize() {
    var size = Math.max(1, orbit.getBoundingClientRect().width);
    renderer.setPixelRatio(scale); renderer.setSize(size, size, false);
    renderer.getDrawingBufferSize(uniforms.uResolution.value);
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
  canvas.addEventListener("webglcontextlost", function (event) { event.preventDefault(); pause(); orbit.classList.remove("shader-ready"); });
  canvas.addEventListener("webglcontextrestored", function () { resize(); play(); });
  document.addEventListener("visibilitychange", function () { document.hidden ? pause() : play(); });
  reduce.addEventListener("change", function () {
    if (reduce.matches) { pause(); orbit.classList.remove("shader-ready"); }
    else { draw(); play(); }
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; visible ? play() : pause(); }).observe(orbit);
  } else { visible = true; }
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(orbit);
  window.addEventListener("resize", resize);
  resize(); play();
});
