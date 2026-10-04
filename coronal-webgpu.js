/* WebGPU port of Coronal by @Xor: https://fragcoord.xyz/s/3otcb9tt
 * Same raymarch, geometry and premultiplied fade as coronal-shader.js. */
self.CoronalWebGPU = (function () {
  var vertex = `struct Vertex { @builtin(position) position: vec4f, @location(0) uv: vec2f }
@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> Vertex {
  let points = array<vec2f, 3>(vec2f(-1., -1.), vec2f(3., -1.), vec2f(-1., 3.));
  var result: Vertex;
  result.position = vec4f(points[index], 0., 1.);
  result.uv = vec2f(points[index].x * .5 + .5, .5 - points[index].y * .5);
  return result;
}`;
  var shader = vertex + `
struct Params { center: vec2f, surface: vec2f, buffer: vec2f, diameter: f32, time: f32 }
@group(0) @binding(0) var<uniform> params: Params;
@fragment fn fragmentMain(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let pixel = vec2f(position.x, params.buffer.y - position.y) / params.buffer * params.surface;
  let uv = 2. * (pixel - params.center) / params.diameter;
  if (length(uv) > 1.5) { return vec4f(0.); }
  let ray = normalize(vec3f(uv, -1.));
  var glow = vec3f(0.);
  var z = 2.;
  for (var i = 0; i < 40; i++) {
    var p = z * ray;
    let original = p;
    var frequency = 2.;
    for (var j = 0; j < 6; j++) {
      frequency *= 2.;
      p += sin(p.zxy * frequency + vec3f(z - params.time)) / frequency;
    }
    z += abs(1. - length(p.xy)) / 3.;
    glow += (vec3f(1.1) - cos(p)) / (z * z * max(abs(length(original.xy) - 1.), .001));
  }
  var color = vec3f(1.) - vec3f(2.) / (exp(2. * min(glow / 30., vec3f(10.))) + vec3f(1.));
  // Keep the core white at 1.5x SDR white; only the thin rim uses HDR.
  let rimDistance = abs(length(uv) - 0.57857143);
  let rimWidth = max(0.0035, 1.4 * max(params.surface.x / params.buffer.x,
    params.surface.y / params.buffer.y) / params.diameter);
  let core = exp(-pow(rimDistance / rimWidth, 2.));
  let halo = 0.06 * exp(-pow(rimDistance / 0.025, 2.));
  color = mix(color, vec3f(1.5), core) + vec3f(halo * (1. - core));
  var alpha = 1. - smoothstep(1.1, 1.5, length(uv));
  // Match the transparent crop-edge feather in the WebGL renderer.
  let edge = min(pixel, params.surface - pixel);
  let edgeStart = max(1., max(params.surface.x / params.buffer.x, params.surface.y / params.buffer.y));
  let feather = max(edgeStart + 1., clamp(params.diameter * 0.08, 12., 48.));
  alpha *= smoothstep(edgeStart, feather, edge.x) * smoothstep(edgeStart, feather, edge.y);
  return vec4f(color * alpha, alpha);
}`;
  var display = vertex + `
@group(0) @binding(0) var imageSampler: sampler;
@group(0) @binding(1) var previous: texture_2d<f32>;
@group(0) @binding(2) var current: texture_2d<f32>;
@group(0) @binding(3) var<uniform> blend: f32;
@fragment fn fragmentMain(input: Vertex) -> @location(0) vec4f {
  return mix(textureSample(previous, imageSampler, input.uv), textureSample(current, imageSampler, input.uv), blend);
}`;
  async function create(canvas, stats, onLost) {
    if (!self.navigator || !self.navigator.gpu) return null;
    var adapter = await self.navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) return null;
    var hasTimer = adapter.features.has("timestamp-query");
    var device = await adapter.requestDevice({ requiredFeatures: hasTimer ? ["timestamp-query"] : [] });
    var context, disposed = false, textures = [], groups = [], readings = [], samples = 0, average = 0;
    var params = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    var blend = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    var format = "rgba16float", hdrOutput = false;
    var cacheFormat = "rgba16float";
    async function pipeline(code, target) {
      var module = device.createShaderModule({ code: code });
      return device.createRenderPipelineAsync({ layout: "auto", vertex: { module: module, entryPoint: "vertexMain" },
        fragment: { module: module, entryPoint: "fragmentMain", targets: [{ format: target }] }, primitive: { topology: "triangle-list" } });
    }
    var shaderPipeline, displayPipeline;
    try {
      // Compile before acquiring the canvas context, allowing a GL fallback if
      // adapter/device/pipeline initialization fails.
      shaderPipeline = await pipeline(shader, cacheFormat); displayPipeline = await pipeline(display, format);
      context = canvas.getContext("webgpu");
      if (!context) { device.destroy(); return null; }
      // Older browsers can reject the float canvas or ignore extended mode.
      device.pushErrorScope("validation");
      var hdrError = null;
      try {
        context.configure({ device: device, format: format, alphaMode: "premultiplied",
          toneMapping: { mode: "extended" } });
      } catch (error) { hdrError = error; }
      hdrError = await device.popErrorScope() || hdrError;
      var actual = context.getConfiguration && context.getConfiguration();
      hdrOutput = !hdrError && !!actual && !!actual.toneMapping && actual.toneMapping.mode === "extended";
      if (!hdrOutput) {
        format = self.navigator.gpu.getPreferredCanvasFormat();
        displayPipeline = await pipeline(display, format);
        context.configure({ device: device, format: format, alphaMode: "premultiplied" });
      }
      stats.hdrOutput = hdrOutput;
    } catch (error) { device.destroy(); throw error; }
    var shaderGroup = device.createBindGroup({ layout: shaderPipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: params } }] });
    var sampler = device.createSampler({ minFilter: "linear", magFilter: "linear" });
    var querySet = hasTimer && device.createQuerySet({ type: "timestamp", count: 2 });
    if (hasTimer) for (var i = 0; i < 2; i++) readings.push({ busy: false,
      resolve: device.createBuffer({ size: 256, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }),
      read: device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }) });
    var values = new Float32Array(8);
    function configure(layout, width, height) {
      if (canvas.width !== width || canvas.height !== height || textures.length !== 2) {
        textures.forEach(function (texture) { texture.destroy(); });
        canvas.width = width; canvas.height = height;
        textures = [0, 1].map(function () { return device.createTexture({ size: [width, height], format: cacheFormat, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING }); });
        groups = [];
        for (var p = 0; p < 2; p++) for (var c = 0; c < 2; c++) groups.push(device.createBindGroup({ layout: displayPipeline.getBindGroupLayout(0), entries: [
          { binding: 0, resource: sampler }, { binding: 1, resource: textures[p].createView() },
          { binding: 2, resource: textures[c].createView() }, { binding: 3, resource: { buffer: blend } }
        ] }));
      }
      values.set([layout.centerX, layout.centerY, layout.width, layout.height, width, height, layout.diameter, 6]);
      stats.pixels = width * height; stats.cacheBytes = width * height * 16;
    }
    function sample(index, time) {
      values[7] = time; device.queue.writeBuffer(params, 0, values);
      var encoder = device.createCommandEncoder(), slot = readings.find(function (r) { return !r.busy; });
      var descriptor = { colorAttachments: [{ view: textures[index].createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] };
      if (slot) descriptor.timestampWrites = { querySet: querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 };
      var pass = encoder.beginRenderPass(descriptor);
      pass.setPipeline(shaderPipeline); pass.setBindGroup(0, shaderGroup); pass.draw(3); pass.end();
      if (slot) { encoder.resolveQuerySet(querySet, 0, 2, slot.resolve, 0); encoder.copyBufferToBuffer(slot.resolve, 0, slot.read, 0, 16); slot.busy = true; }
      device.queue.submit([encoder.finish()]);
      if (slot) slot.read.mapAsync(GPUMapMode.READ).then(function () {
        var times = new BigUint64Array(slot.read.getMappedRange());
        if (!disposed) { stats.gpuMs = Number(times[1] - times[0]) / 1000000; average = samples ? average * .8 + stats.gpuMs * .2 : stats.gpuMs; samples++; }
        slot.read.unmap(); slot.busy = false;
      }).catch(function () { slot.busy = false; });
    }
    function present(previous, current, amount) {
      device.queue.writeBuffer(blend, 0, new Float32Array([amount, 0, 0, 0]));
      var encoder = device.createCommandEncoder(), pass = encoder.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
      pass.setPipeline(displayPipeline); pass.setBindGroup(0, groups[previous * 2 + current]); pass.draw(3); pass.end();
      device.queue.submit([encoder.finish()]);
    }
    device.lost.then(function () { if (!disposed) { disposed = true; onLost(); } });
    return { configure: configure, sample: sample, present: present, hasTimer: hasTimer,
      get samples() { return samples; }, get average() { return average; },
      get pending() { return readings.filter(function (r) { return r.busy; }).length; },
      get textures() { return textures; }, device: device, maxSize: device.limits.maxTextureDimension2D };
  }
  return { create: create };
})();
