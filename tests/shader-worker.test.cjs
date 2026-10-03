const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../shader-profile.json').rendering;

// A controlled worker clock and GL command recorder test cache ownership and
// scheduling. Real pixels, driver errors and thread isolation are browser-tested.
function worker() {
  const events = {}, callbacks = new Map(), messages = [], calls = [];
  let id = 0, framebuffer = null, currentProgram = null, texture = null;
  const canvas = {width: 300, height: 150, addEventListener: (type, fn) => {events[type] = fn;}};
  const gl = new Proxy({
    get drawingBufferWidth() {return canvas.width;},
    get drawingBufferHeight() {return canvas.height;},
    createShader: () => ({}), createProgram: () => ({}), createBuffer: () => ({}),
    createTexture: () => ({id: ++id}), createFramebuffer: () => ({id: ++id}),
    getShaderParameter: () => true, getProgramParameter: () => true,
    getUniformLocation: (_, name) => name, getParameter: () => 32768,
    getExtension: () => null, checkFramebufferStatus: () => 'FRAMEBUFFER_COMPLETE',
    useProgram: p => {currentProgram = p;}, bindFramebuffer: (_, f) => {framebuffer = f;},
    bindTexture: (_, t) => {texture = t;},
    framebufferTexture2D: () => {framebuffer.texture = texture;},
    uniform1f: (name, value) => {currentProgram[name] = value;},
    drawArrays: () => calls.push({type: framebuffer ? 'shader' : 'display', framebuffer, time: currentProgram.uTime, blend: currentProgram.uBlend}),
    deleteTexture: t => calls.push({type: 'deleteTexture', texture: t}),
    deleteFramebuffer: f => calls.push({type: 'deleteFramebuffer', framebuffer: f}),
  }, {get(target, key) {return key in target ? target[key] : /^[A-Z_0-9]+$/.test(key) ? key : () => {};}});
  canvas.getContext = () => gl;
  const scope = {console, performance: {now: () => 0},
    postMessage: m => messages.push(m), requestAnimationFrame: fn => {const key = ++id; callbacks.set(key, fn); return key;},
    cancelAnimationFrame: key => callbacks.delete(key)};
  scope.self = scope;
  const context = vm.createContext(scope);
  scope.importScripts = (...files) => files.forEach(file => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context));
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'shader-worker.js'), 'utf8'), context);
  const layout = {width: 1881, height: 1046, centerX: 700, centerY: 500, diameter: 1150, pixelRatio: 2, mobile: false, revision: 1};
  const send = message => scope.onmessage({data: message});
  const tick = now => {const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(fn => fn(now));};
  send({type: 'init', canvas, renderer: 'coronal', rendering: config, layout, active: true, background: false});
  return {canvas, scope, calls, messages, events, callbacks, layout, send, tick};
}

test('two GPU textures are reused across multiple cheap display frames', () => {
  const w = worker();
  for (let i = 0; i < 60; i++) w.tick(i * 1000 / 60);
  const shader = w.calls.filter(c => c.type === 'shader');
  const display = w.calls.filter(c => c.type === 'display');
  assert.equal(new Set(shader.map(c => c.framebuffer)).size, 2);
  assert.equal(shader.length, 20);
  assert.equal(display.length, 60);
  assert(display.some(c => c.blend > 0 && c.blend < 1));
  assert(w.canvas.width * w.canvas.height <= config.desktopMaxPixels);
  assert.equal(w.messages.filter(m => m.type === 'ready').length, 1);
  assert.equal(w.calls.filter(c => c.type === 'deleteTexture').length, 0);
});

test('pause retains the cache and resume preserves animation time', () => {
  const w = worker();
  for (let i = 0; i < 10; i++) w.tick(i * 1000 / 60);
  const clock = w.scope.clock, count = w.calls.length;
  w.send({type: 'state', active: false, background: false});
  assert.equal(w.callbacks.size, 0);
  w.tick(9000); assert.equal(w.calls.length, count);
  w.send({type: 'state', active: true, background: false}); w.tick(10000);
  assert.equal(w.scope.clock, clock);
  assert.equal(w.messages.filter(m => m.type === 'ready').length, 2);
  assert.equal(w.calls.filter(c => c.type === 'deleteTexture').length, 0);
});

test('resize replaces both cached textures and respects the mobile pixel budget', () => {
  const w = worker(); w.tick(0);
  w.send({type: 'resize', layout: {...w.layout, width: 390, height: 581, mobile: true, revision: 2}}); w.tick(17);
  assert.equal(w.calls.filter(c => c.type === 'deleteTexture').length, 2);
  assert.equal(w.calls.filter(c => c.type === 'deleteFramebuffer').length, 2);
  assert.equal(w.scope.caches.length, 2);
  assert(w.canvas.width * w.canvas.height <= config.mobileMaxPixels);
  assert.equal(w.messages.at(-1).revision, 2);
  assert.equal(w.calls.at(-1).blend, 1);
});

test('context loss stops rendering, then recovery rebuilds both caches', () => {
  const w = worker(); w.tick(0);
  let prevented = false;
  w.events.webglcontextlost({preventDefault: () => {prevented = true;}});
  assert(prevented); assert.equal(w.callbacks.size, 0);
  assert.equal(w.messages.at(-1).type, 'lost');
  const count = w.calls.length; w.tick(100); assert.equal(w.calls.length, count);
  w.events.webglcontextrestored(); w.tick(200);
  assert.equal(w.scope.caches.length, 2);
  assert.equal(w.messages.at(-1).type, 'ready');
});
