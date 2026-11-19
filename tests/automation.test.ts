import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_AUTOMATION_MAPPING,
  automationLabel,
  parseAutomation,
} from '../src/synth/automation';

test('parseAutomation accepts JSON strings', () => {
  const m = parseAutomation('{"cc":74,"min":0.2,"max":0.8,"slew":25}');
  assert.deepEqual(m, { cc: 74, min: 0.2, max: 0.8, slew: 25 });
});

test('parseAutomation clamps out-of-range values', () => {
  const m = parseAutomation({ cc: 999, min: -3, max: 9, slew: 90000 });
  assert.equal(m.cc, 127);
  assert.equal(m.min, 0);
  assert.equal(m.max, 1);
  assert.equal(m.slew, 2000);
});

test('parseAutomation swaps inverted min/max', () => {
  const m = parseAutomation({ cc: 1, min: 0.9, max: 0.1 });
  assert.equal(m.min, 0.1);
  assert.equal(m.max, 0.9);
});

test('parseAutomation degrades malformed input to empty mapping', () => {
  assert.deepEqual(parseAutomation('not json'), EMPTY_AUTOMATION_MAPPING);
  assert.deepEqual(parseAutomation(null), EMPTY_AUTOMATION_MAPPING);
  assert.deepEqual(parseAutomation(undefined), EMPTY_AUTOMATION_MAPPING);
});

test('automationLabel distinguishes mapped and unmapped', () => {
  assert.equal(automationLabel(EMPTY_AUTOMATION_MAPPING), 'Unmapped');
  assert.equal(
    automationLabel({ cc: 74, min: 0, max: 1, slew: 20 }),
    'CC 74 · 0–100% · 20 ms',
  );
});
