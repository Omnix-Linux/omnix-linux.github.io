const test = require('node:test');
const assert = require('node:assert/strict');
const {nextDeadline, blend} = require('../shader-timing.js');

test('30fps remains 30fps on a 60Hz clock with timestamp jitter', () => {
  let deadline = null, draws = 0;
  for (let frame = 0; frame < 360; frame++) {
    const now = frame * 1000 / 60 + (frame % 2 ? -.1 : .1);
    if (deadline === null || now + .5 >= deadline) {
      draws++;
      deadline = nextDeadline(now, deadline, 1000 / 30);
    }
  }
  assert.equal(draws, 180);
});

test('a long stall skips missed deadlines without submitting a burst of frames', () => {
  assert.equal(nextDeadline(1000, 50, 50), 1050);
  assert.equal(nextDeadline(99.8, 100, 50), 150);
  assert.equal(nextDeadline(0, null, 50), 50);
});

test('cached frames crossfade with one sample of latency and hold at the limits', () => {
  assert.equal(blend(50, 0, 50), 0);
  assert.equal(blend(75, 0, 50), .5);
  assert.equal(blend(100, 0, 50), 1);
  assert.equal(blend(300, 0, 50), 1);
  assert.equal(blend(0, 0, 0), 1);
});
