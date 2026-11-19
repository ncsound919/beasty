import test from 'node:test';
import assert from 'node:assert/strict';
import { AutomationHost } from '../src/synth/automationHost';

test('learn binds the next CC to the armed parameter', () => {
  const host = new AutomationHost();
  host.learn('cutoff');
  assert.equal(host.isLearning('cutoff'), true);
  host.onCc(74, 0.5);
  assert.equal(host.isLearning('cutoff'), false);
  assert.equal(host.get('cutoff').cc, 74);
});

test('mapped CC drives the normalised parameter range', () => {
  const host = new AutomationHost({ tickMs: 10 });
  host.set('cutoff', { cc: 74, min: 0.2, max: 0.8, slew: 0 });
  const [u] = host.onCc(74, 1);
  assert.equal(u.id, 'cutoff');
  assert.equal(u.value, 0.8);
  const [d] = host.onCc(74, 0);
  assert.equal(d.value, 0.2);
});

test('unmapped CCs are ignored', () => {
  const host = new AutomationHost();
  assert.deepEqual(host.onCc(10, 0.5), []);
});

test('slew ramps instead of jumping', () => {
  const host = new AutomationHost({ tickMs: 16 });
  host.set('pan', { cc: 7, min: 0, max: 1, slew: 160 });
  host.onCc(7, 1);               // initial seed: value is placed at target
  const retarget = host.onCc(7, 0);
  assert.equal(retarget.length, 0, 'slewed retarget must wait for ticks');
  let last = 1;
  for (let i = 0; i < 20; i++) {
    for (const u of host.tick()) last = u.value;
  }
  assert.ok(last < 0.15, `ramp should approach the target (got ${last})`);
});

test('unlearning clears the mapping', () => {
  const host = new AutomationHost();
  host.set('drive', { cc: 42, min: 0, max: 1, slew: 0 });
  host.set('drive', { cc: -1, min: 0, max: 1, slew: 0 });
  assert.equal(host.get('drive').cc, -1);
  assert.deepEqual(host.onCc(42, 0.5), []);
});
