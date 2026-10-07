// Issue #8 browser acceptance checks. Serve the repo first, then run with
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/apps-browser-check.cjs.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.APPS_BASE_URL || 'http://127.0.0.1:4187';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  try {
    for (const width of [1440, 900, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => {
        window.copied = [];
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => window.copied.push(text) } });
      });
      await page.goto(base + '/apps/', { waitUntil: 'networkidle' });
      const expected = await page.locator('#apps-data').evaluate(el => JSON.parse(el.textContent));
      assert.equal(await page.locator('article.app').count(), expected.apps.length);
      assert.equal(await page.locator('.evidence-fold[open]').count(), 0);
      assert.equal(await page.locator('#nodejs .validation-preview').count(), 0);
      const app = page.locator('#brave');
      const neighbor = page.locator('#telegram');
      await app.scrollIntoViewIfNeeded();
      const closed = await app.boundingBox();
      assert(closed.height <= (width > 640 ? 90 : 126), `closed row too tall at ${width}: ${closed.height}`);
      assert.equal(await app.locator('.app-desc').isVisible(), false);
      const oldWidth = (await neighbor.boundingBox()).width;
      await app.locator('.more > summary').click();
      assert(await app.locator('.app-desc').isVisible());
      assert.equal((await app.boundingBox()).width, closed.width);
      assert.equal((await neighbor.boundingBox()).width, oldWidth);
      assert.equal(await app.locator('.steps').isVisible(), false);
      for (const label of ['Install', 'Verified workflow', 'Validation details', 'Package source']) {
        const fold = app.locator('.evidence-fold').filter({ has: page.locator('summary', { hasText: label }) }).first();
        await fold.locator(':scope > summary').click();
        assert.equal(await fold.getAttribute('open'), '');
        if (label === 'Install') {
          await fold.locator('.copy').click();
          assert.equal(await page.evaluate(() => window.copied[0]), await fold.locator('pre').textContent());
        }
        await fold.locator(':scope > summary').click();
      }
      const button = app.locator('.validation-preview');
      const window = page.locator('#validation-window');
      await button.hover();
      await window.waitFor({ state: 'visible' });
      assert.match(await window.locator('h3').textContent(), /Automated test run — Brave/);
      assert.match(await window.locator('.preview-context').textContent(), /Passing · 2026-10-06/);
      assert.match(await window.locator('figcaption').textContent(), /automated test.*Omnix virtual machine/);
      const trigger = await button.boundingBox();
      const popup = await window.boundingBox();
      assert(popup.x >= 0 && popup.x + popup.width <= width + 1 && popup.y >= 0 && popup.y + popup.height <= 901);
      assert(popup.y + popup.height <= trigger.y + 1 || popup.y >= trigger.y + trigger.height - 1, 'preview covers trigger');
      const box = await window.locator('h3').boundingBox();
      await page.mouse.move(box.x + 5, box.y + 5, { steps: 8 });
      await page.waitForTimeout(220);
      assert(await window.isVisible(), 'preview closes while pointer enters it');
      await page.keyboard.press('Escape');
      assert.equal(await window.isVisible(), false);
      await page.waitForTimeout(220);
      assert.equal(await window.isVisible(), false, 'Escape must not immediately reopen the preview');
      await page.mouse.move(0, 880);
      await button.focus();
      assert(await window.isVisible(), 'keyboard focus opens preview');
      await page.keyboard.press('Enter');
      await page.mouse.move(0, 880);
      assert(await window.isVisible(), 'activated preview stays open');
      await page.keyboard.press('Escape');
      assert.equal(await window.isVisible(), false);
      assert.equal(await page.evaluate(() => document.activeElement.className), 'validation-preview');
      await app.locator('.more > summary').focus();
      await button.focus();
      assert(await window.isVisible(), 'refocusing a dismissed preview works');
      await page.keyboard.press('Escape');
      await button.click();
      assert(await window.isVisible());
      await page.mouse.click(1, 880);
      assert.equal(await window.isVisible(), false, 'outside click dismisses pinned preview');
      // Every long evidence block must remain usable at this viewport width.
      await page.locator('article .more, article .evidence-fold, article .run-log').evaluateAll(nodes => nodes.forEach(node => { node.open = true; }));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      console.log(JSON.stringify({ width, closedHeight: closed.height, downwardDetails: true, hover: true, keyboard: true, copy: true, overflow: false }));
      await page.close();
    }
    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await touch.goto(base + '/apps/', { waitUntil: 'networkidle' });
    await touch.locator('#brave').scrollIntoViewIfNeeded();
    await touch.locator('#brave .validation-preview').tap();
    assert(await touch.locator('#validation-window').isVisible());
    await touch.locator('.preview-close').tap();
    assert.equal(await touch.locator('#validation-window').isVisible(), false);
    await touch.close();
    const nojs = await browser.newPage({ javaScriptEnabled: false });
    await nojs.goto(base + '/apps/', { waitUntil: 'networkidle' });
    assert.equal(await nojs.locator('.validation-preview:visible').count(), 0);
    await nojs.locator('#brave .more > summary').click();
    await nojs.locator('#brave .evidence-fold > summary', { hasText: 'Validation details' }).click();
    assert(await nojs.locator('#brave .validation-caption a').isVisible());
    await nojs.close();
    const fallback = await browser.newPage();
    await fallback.addInitScript(() => { HTMLElement.prototype.showPopover = undefined; });
    await fallback.goto(base + '/apps/', { waitUntil: 'networkidle' });
    await fallback.locator('#brave').scrollIntoViewIfNeeded();
    await fallback.locator('#brave .validation-preview').hover();
    assert(await fallback.locator('#validation-window').isVisible());
    await fallback.keyboard.press('Escape');
    assert.equal(await fallback.locator('#validation-window').isVisible(), false);
    await fallback.close();
    console.log(JSON.stringify({ touch: true, withoutJavaScript: true, withoutPopoverAPI: true }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
