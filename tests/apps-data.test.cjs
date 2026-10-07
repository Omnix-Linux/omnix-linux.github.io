// Shape of the app registry and the generated Apps page (scripts/build_apps.py).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const reg = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'registry.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'apps', 'index.html'), 'utf8');
const STATUSES = ['passing', 'patched', 'known-gap', 'failing', 'untested'];

test('registry documents its schema and has apps', () => {
  assert.equal(typeof reg._schema, 'object');
  assert.ok(reg.apps.length >= 4);
});

test('every app has the required fields and an existing icon', () => {
  const ids = new Set();
  for (const a of reg.apps) {
    for (const k of ['id', 'name', 'icon', 'category', 'kind', 'description']) assert.equal(typeof a[k], 'string', `${a.id}.${k}`);
    assert.ok(!ids.has(a.id)); ids.add(a.id);
    assert.ok(Array.isArray(a.workflow), a.id);
    if (['passing', 'patched', 'known-gap', 'failing'].includes(a.verification?.status)) assert.ok(a.workflow.length > 0, a.id);
    assert.ok(a.install && a.install.label && a.install.snippet, a.id);
    if (a.icon.startsWith('assets/')) assert.ok(fs.existsSync(path.join(root, a.icon)), a.icon);
  }
});

test('a tested status always has a test path and a verification date', () => {
  for (const a of reg.apps) {
    const v = a.verification;
    if (!v) continue;
    assert.ok(STATUSES.includes(v.status), `${a.id}: ${v.status}`);
    if (v.status !== 'untested') {
      assert.ok(a.test && a.test.path, a.id);
      assert.match(v.verified_at, /^\d{4}-\d\d-\d\d/);
    }
  }
});

test('candidates are never presented as tested', () => {
  for (const c of reg.candidates) {
    assert.equal(c.verification, undefined);
    assert.equal(c.test, undefined);
    assert.ok(fs.existsSync(path.join(root, c.icon)), c.icon);
  }
  const cands = [...html.matchAll(/<ul class="cands">[\s\S]*?<\/ul>/g)].map(m => m[0]).join('\n');
  assert.equal((cands.match(/<li class="app status-unknown cand"/g) || []).length, reg.candidates.length);
  assert.doesNotMatch(cands, /badge-(passing|known-gap|failing)/);
  assert.doesNotMatch(cands, /<details/, 'candidates have nothing to expand');
});

test('page renders one card per app, inlines the registry and links each test', () => {
  assert.ok(!html.includes('/*__APPS_DATA__*/') && !html.includes('<!--__'));
  assert.equal((html.match(/<article class="app status-/g) || []).length, reg.apps.length);
  // Each card collapses its evidence behind one Details toggle.
  assert.equal((html.match(/<details class="more">/g) || []).length, reg.apps.length);
  // Status colours: green, yellow, red, gray only.
  const used = new Set([...html.matchAll(/class="app status-([a-z-]+)/g)].map(m => m[1]));
  for (const s of used) assert.ok(['passing', 'patched', 'known-gap', 'failing', 'unknown'].includes(s), s);
  for (const a of reg.apps) if (a.test) assert.ok(html.includes(`href="${a.test.url}"`), a.id);
  const unverified = reg.apps.filter(a => !a.verification).length;
  assert.equal((html.match(/<article class="app status-unknown"/g) || []).length, unverified);
});

test('Apps nav item is on the left of all three pages and current on the Apps page', () => {
  assert.match(html, /class="nav-apps" href="\.\/" aria-current="page"/);
  const pages = {
    home: [fs.readFileSync(path.join(root, 'index.html'), 'utf8'), 'apps/'],
    models: [fs.readFileSync(path.join(root, 'benchmarks', 'index.html'), 'utf8'), '../apps/'],
    apps: [html, './'],
  };
  for (const [name, [page, href]] of Object.entries(pages)) {
    const start = page.indexOf('<div class="site-nav-start">');
    const models = page.indexOf('class="nav-leaderboard"');
    const apps = page.indexOf(`class="nav-apps" href="${href}"`);
    const links = page.indexOf('<div class="site-nav-links">');
    assert.ok(start !== -1 && start < models && models < apps && apps < links, name);
    assert.match(page, /<span>Apps<\/span>/, name);
  }
});


test('apps are grouped into the registry sections, in order, each app exactly once', () => {
  const ids = reg.sections.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const e of [...reg.apps, ...reg.candidates]) assert.ok(ids.includes(e.section), `${e.id}: ${e.section}`);
  const used = ids.filter(id => [...reg.apps, ...reg.candidates].some(e => e.section === id));
  const rendered = [...html.matchAll(/<section class="app-section" id="section-([a-z0-9-]+)"/g)].map(m => m[1]);
  assert.deepEqual(rendered, used, 'non-empty sections, in registry order');
  const chips = [...html.matchAll(/<a class="chip" href="#section-([a-z0-9-]+)">/g)].map(m => m[1]);
  assert.deepEqual(chips, used);
  assert.equal((html.match(/<div class="sec">/g) || []).length, used.length);
  for (const id of used) {
    const block = html.split(`id="section-${id}"`)[1].split('</section>')[0];
    const members = reg.apps.filter(a => a.section === id);
    for (const a of members) assert.ok(block.includes(`" id="${a.id}">`), a.id);
    const n = members.length + reg.candidates.filter(c => c.section === id).length;
    assert.match(block, new RegExp(`<span class="sec-summary">${n} apps? · `));
  }
  for (const a of reg.apps) assert.equal((html.match(new RegExp(`<article class="app status-[a-z-]+" id="${a.id}">`, 'g')) || []).length, 1, a.id);
});


test('dedicated terminal, browser and communication groups cover the requested lineup', () => {
  const groups = Object.fromEntries(reg.sections.map(section => [section.id, reg.apps.filter(app => app.section === section.id).map(app => app.id)]));
  assert.ok(groups.terminals.length >= 4 && groups.terminals.length <= 8);
  for (const id of ['kitty', 'tmux', 'wezterm']) assert.ok(groups.terminals.includes(id));
  for (const id of ['brave', 'chrome', 'chromium', 'helium', 'firefox']) assert.ok(groups.browsers.includes(id));
  for (const id of ['telegram', 'signal', 'slack', 'discord']) assert.ok(groups.communication.includes(id));
  assert.ok(!groups.developer.includes('kitty'));
  assert.ok(!groups.internet);
});
