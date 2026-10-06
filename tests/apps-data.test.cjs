// Shape of the app registry and the generated Apps page (scripts/build_apps.py).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const reg = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'registry.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'apps', 'index.html'), 'utf8');
const STATUSES = ['passing', 'known-gap', 'failing', 'untested'];

test('registry documents its schema and has apps', () => {
  assert.equal(typeof reg._schema, 'object');
  assert.ok(reg.apps.length >= 4);
});

test('every app has the required fields and an existing icon', () => {
  const ids = new Set();
  for (const a of reg.apps) {
    for (const k of ['id', 'name', 'icon', 'category', 'kind', 'description']) assert.equal(typeof a[k], 'string', `${a.id}.${k}`);
    assert.ok(!ids.has(a.id)); ids.add(a.id);
    assert.ok(Array.isArray(a.workflow) && a.workflow.length > 0, a.id);
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
  const cands = html.slice(html.indexOf('<ul class="cands">'), html.indexOf('</ul>', html.indexOf('<ul class="cands">')));
  assert.equal((cands.match(/<li class="cand">/g) || []).length, reg.candidates.length);
  assert.doesNotMatch(cands, /badge-(passing|known-gap|failing)/);
});

test('page renders one card per app, inlines the registry and links each test', () => {
  assert.ok(!html.includes('/*__APPS_DATA__*/') && !html.includes('<!--__'));
  assert.equal((html.match(/<article class="app"/g) || []).length, reg.apps.length);
  for (const a of reg.apps) if (a.test) assert.ok(html.includes(`href="${a.test.url}"`), a.id);
  const unverified = reg.apps.filter(a => !a.verification).length;
  assert.equal((html.match(/<span class="badge badge-awaiting">Awaiting verification<\/span>\n/g) || []).length, unverified);
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
