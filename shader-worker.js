/* The transferred canvas, shader passes and cached GPU textures live here.
 * No per-frame pixels or messages cross back to the main thread. */
var assetVersion = self.location ? self.location.search : "";
importScripts("coronal-shader.js" + assetVersion, "coronal-webgpu.js" + assetVersion, "shader-timing.js" + assetVersion);

var canvas, gl, gpu, webgl2, config, layout, active = false;
var shaderProgram, displayProgram, triangle, shaderUniforms, displayUniforms;
var caches = [], current = 0, hasPrevious = false, dirty = true, lost = false;
var quality = 1, clock = 0, lastNow = null, shaderDeadline = null, displayDeadline = null;
var currentTime = 0, previousTime = 0, raf = null, lastReady = -1;
var timer, queries = [], gpuAverage = 0, lagAverage = 0, samples = 0, nextQualityCheck = 0;
// Small counters are available in the worker's DevTools context for profiling.
var stats = { shaderFrames: 0, displayFrames: 0, cacheBytes: 0, pixels: 0, quality: 1, gpuMs: 0 };
var usingRaf = typeof self.requestAnimationFrame === "function";

function fail(error) {
  stop(); active = false;
  self.postMessage({ type: "fallback", reason: String(error.message || error) });
}
function compile(type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    var message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message);
  }
  return shader;
}
function program(fragment, textured) {
  var header = webgl2 ? "#version 300 es\n" : "";
  var vertex = header + (webgl2 ? "in" : "attribute") + " vec2 aPosition;\n"
    + (textured ? (webgl2 ? "out" : "varying") + " vec2 vUv;\n" : "")
    + "void main(){gl_Position=vec4(aPosition,0.,1.);"
    + (textured ? "vUv=aPosition*.5+.5;" : "") + "}";
  var prefix = header + "precision highp float;\n" + (webgl2 ? "out vec4 outputColor;\n" : "");
  if (webgl2) fragment = fragment.replace(/gl_FragColor/g, "outputColor");
  var vs = compile(gl.VERTEX_SHADER, vertex), fs;
  try { fs = compile(gl.FRAGMENT_SHADER, prefix + fragment); }
  catch (error) { gl.deleteShader(vs); throw error; }
  var result = gl.createProgram();
  gl.attachShader(result, vs); gl.attachShader(result, fs);
  gl.bindAttribLocation(result, 0, "aPosition"); gl.linkProgram(result);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) {
    var message = gl.getProgramInfoLog(result); gl.deleteProgram(result); throw new Error(message);
  }
  return result;
}
function uniforms(p, names) {
  var result = {};
  names.forEach(function (name) { result[name] = gl.getUniformLocation(p, name); });
  return result;
}
function clearQueries() {
  queries.forEach(function (q) { gl.deleteQuery(q); }); queries = [];
}
function deleteCaches() {
  caches.forEach(function (cache) { gl.deleteFramebuffer(cache.framebuffer); gl.deleteTexture(cache.texture); });
  caches = []; clearQueries();
}
function createCache(width, height) {
  var texture = gl.createTexture(), framebuffer = gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(framebuffer); gl.deleteTexture(texture); throw new Error("Shader cache framebuffer unavailable");
  }
  return { texture: texture, framebuffer: framebuffer };
}
function initializeGL() {
  stats.hdrOutput = false;
  var options = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false };
  gl = canvas.getContext("webgl2", options); webgl2 = !!gl;
  if (!gl) gl = canvas.getContext("webgl", options);
  if (!gl) throw new Error("Worker WebGL unavailable");
  stats.backend = webgl2 ? "webgl2" : "webgl";
  shaderProgram = program(self.CoronalShader, false);
  var sample = webgl2 ? "texture" : "texture2D";
  displayProgram = program((webgl2 ? "in" : "varying") + " vec2 vUv;\n"
    + "uniform sampler2D uPrevious,uCurrent; uniform float uBlend;\n"
    + "void main(){gl_FragColor=mix(" + sample + "(uPrevious,vUv)," + sample + "(uCurrent,vUv),uBlend);}", true);
  shaderUniforms = uniforms(shaderProgram, ["uCenter", "uSurfaceSize", "uBufferSize", "uDiameter", "uTime"]);
  displayUniforms = uniforms(displayProgram, ["uPrevious", "uCurrent", "uBlend"]);
  triangle = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
  timer = webgl2 && gl.getExtension("EXT_disjoint_timer_query_webgl2");
  caches = []; queries = []; gpuAverage = 0; samples = 0;
  // Capability limits are queried once, not on every frame.
  stats.maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
  dirty = true; configure();
}
function initializeBackend() {
  if (self.navigator && self.navigator.gpu) {
    CoronalWebGPU.create(canvas, stats, function () {
      lost = true; stop(); self.postMessage({ type: "lost" });
      gpu = null; caches = []; lastReady = -1; initializeBackend();
    }).then(function (result) {
      try {
        lost = false;
        if (result) { gpu = result; stats.backend = "webgpu"; stats.maxSize = gpu.maxSize; configure(); }
        else initializeGL();
        schedule();
      } catch (error) { fail(error); }
    }).catch(function () {
      try { lost = false; initializeGL(); schedule(); } catch (error) { fail(error); }
    });
  } else { initializeGL(); schedule(); }
}
function rates() {
  return {
    shader: layout.mobile ? config.mobileShaderFps : config.heroShaderFps,
    display: config.heroFps
  };
}
function configure() {
  if ((!gl && !gpu) || lost || !layout) return;
  var budget = layout.mobile ? config.mobileMaxPixels : config.desktopMaxPixels;
  var ratio = Math.min(layout.pixelRatio, config.maxPixelRatio,
    Math.sqrt(budget / (layout.width * layout.height)),
    stats.maxSize / Math.max(layout.width, layout.height)) * quality;
  var width = Math.max(1, Math.floor(layout.width * ratio));
  var height = Math.max(1, Math.floor(layout.height * ratio));
  if (gpu) {
    var resized = canvas.width !== width || canvas.height !== height || caches.length !== 2;
    gpu.configure(layout, width, height); caches = gpu.textures;
    if (resized) { current = 0; hasPrevious = false; }
  } else {
    if (canvas.width !== width || canvas.height !== height || caches.length !== 2) {
      deleteCaches(); canvas.width = width; canvas.height = height;
      width = gl.drawingBufferWidth; height = gl.drawingBufferHeight;
      caches.push(createCache(width, height)); caches.push(createCache(width, height));
      current = 0; hasPrevious = false;
      stats.pixels = width * height; stats.cacheBytes = width * height * 4 * 2;
    }
    gl.useProgram(shaderProgram);
    gl.uniform2f(shaderUniforms.uSurfaceSize, layout.width, layout.height);
    gl.uniform2f(shaderUniforms.uBufferSize, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(shaderUniforms.uCenter, layout.centerX, layout.centerY);
    gl.uniform1f(shaderUniforms.uDiameter, layout.diameter);
  }
  stats.quality = quality; stats.revision = layout.revision;
  dirty = true; shaderDeadline = null; displayDeadline = null; lastReady = -1;
}
function updateCache() {
  if (!dirty) { current = 1 - current; previousTime = currentTime; hasPrevious = true; }
  else hasPrevious = false;
  currentTime = clock;
  if (gpu) gpu.sample(current, 6 + clock / 1000);
  else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, caches[current].framebuffer);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(shaderProgram); gl.uniform1f(shaderUniforms.uTime, 6 + clock / 1000);
    var query = timer && gl.createQuery();
    if (query) gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (query) { gl.endQuery(timer.TIME_ELAPSED_EXT); queries.push(query); }
  }
  dirty = false; stats.shaderFrames++;
}
function present() {
  var amount = hasPrevious ? ShaderTiming.blend(clock, previousTime, currentTime) : 1;
  if (gpu) gpu.present(hasPrevious ? 1 - current : current, current, amount);
  else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.useProgram(displayProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, caches[hasPrevious ? 1 - current : current].texture);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, caches[current].texture);
    gl.uniform1i(displayUniforms.uPrevious, 0); gl.uniform1i(displayUniforms.uCurrent, 1);
    gl.uniform1f(displayUniforms.uBlend, hasPrevious ? ShaderTiming.blend(clock, previousTime, currentTime) : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  stats.displayFrames++;
  if (lastReady !== layout.revision) {
    lastReady = layout.revision;
    self.postMessage({ type: "ready", revision: layout.revision, pixels: stats.pixels, cacheBytes: stats.cacheBytes, backend: stats.backend, hdrOutput: !!stats.hdrOutput });
  }
}
function pollTiming() {
  if (gpu || !timer) return;
  while (queries.length && gl.getQueryParameter(queries[0], gl.QUERY_RESULT_AVAILABLE)) {
    var query = queries.shift();
    if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) {
      stats.gpuMs = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1000000;
      gpuAverage = samples ? gpuAverage * .8 + stats.gpuMs * .2 : stats.gpuMs; samples++;
    }
    gl.deleteQuery(query);
  }
}
function adapt(now, interval) {
  if (now < nextQualityCheck) return;
  // Leave display/compositor headroom even when shader samples are infrequent.
  var budget = Math.min(interval * .65, 1000 / rates().display * .75);
  var timed = gpu ? gpu.hasTimer : timer;
  var count = gpu ? gpu.samples : samples, duration = gpu ? gpu.average : gpuAverage;
  var overloaded = timed ? count >= 8 && duration > budget : lagAverage > interval * 1.25;
  if (overloaded && quality > config.minQuality) {
    quality = Math.max(config.minQuality, quality * .8); configure();
    nextQualityCheck = now + 1500;
  }
}
function schedule() {
  if (raf !== null || !active || lost || (!gl && !gpu)) return;
  raf = usingRaf ? self.requestAnimationFrame(frame) : setTimeout(function () { frame(performance.now()); }, 1000 / rates().display);
}
function stop() {
  if (raf !== null) { usingRaf ? self.cancelAnimationFrame(raf) : clearTimeout(raf); raf = null; }
  lastNow = null;
}
function frame(now) {
  raf = null;
  if (!active || lost) return;
  try {
    if (lastNow !== null) {
      var delta = Math.max(0, now - lastNow); clock += delta;
      lagAverage = lagAverage ? lagAverage * .9 + delta * .1 : delta;
    }
    lastNow = now;
    var rate = rates(), shaderInterval = 1000 / rate.shader, displayInterval = 1000 / rate.display;
    pollTiming(); adapt(now, shaderInterval);
    // Bound queued expensive passes when the GPU falls behind.
    if (dirty || ((shaderDeadline === null || clock + .5 >= shaderDeadline) && (gpu ? gpu.pending : queries.length) < 2)) {
      updateCache(); shaderDeadline = ShaderTiming.nextDeadline(clock, shaderDeadline, shaderInterval);
    }
    if (displayDeadline === null || clock + .5 >= displayDeadline) {
      present(); displayDeadline = ShaderTiming.nextDeadline(clock, displayDeadline, displayInterval);
    }
    schedule();
  } catch (error) { fail(error); }
}
self.onmessage = function (event) {
  var message = event.data;
  try {
    if (message.type === "init") {
      if (canvas || message.renderer !== "coronal") throw new Error("Unsupported shader worker initialization");
      canvas = message.canvas; config = message.rendering; layout = message.layout;
      active = message.active;
      canvas.addEventListener("webglcontextlost", function (event) {
        event.preventDefault(); lost = true; stop(); self.postMessage({ type: "lost" });
      });
      canvas.addEventListener("webglcontextrestored", function () {
        try { lost = false; lastReady = -1; initializeGL(); schedule(); }
        catch (error) { fail(error); }
      });
      initializeBackend();
    } else if (message.type === "resize") {
      layout = message.layout; configure(); schedule();
    } else if (message.type === "state") {
      var wasActive = active;
      active = message.active;
      if (active && !wasActive) { lastReady = -1; displayDeadline = null; }
      if (active) schedule(); else stop();
    }
  } catch (error) { fail(error); }
};
