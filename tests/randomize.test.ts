import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PARAM_IDS, PARAM_SPECS, getDefaultParams } from '../src/synth/paramDefs';
import { randomizeParams } from '../src/synth/parameters';

const RUNS = 300;

test(`randomizeParams (${RUNS} runs) keeps every value inside its parameter range`, () => {
  const offenders = new Set<string>();
  for (let run = 0; run < RUNS; run++) {
    const next = randomizeParams(getDefaultParams());
    for (const id of ALL_PARAM_IDS) {
      const spec = PARAM_SPECS[id];
      const value = next[id];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < spec.min || value > spec.max) {
        offenders.add(`${id}=${value} outside [${spec.min}, ${spec.max}]`);
      }
    }
  }
  assert.deepEqual([...offenders], []);
});

test(`randomizeParams (${RUNS} runs) only emits whole steps for discrete parameters`, () => {
  const offenders = new Set<string>();
  for (let run = 0; run < RUNS; run++) {
    const next = randomizeParams(getDefaultParams());
    for (const id of ALL_PARAM_IDS) {
      if (PARAM_SPECS[id].step !== 1) continue;
      const value = next[id];
      if (Math.abs(value - Math.round(value)) > 1e-9) offenders.add(`${id}=${value}`);
    }
  }
  assert.deepEqual([...offenders], []);
});

test('randomizeParams never mutates the patch it was given', () => {
  const before = getDefaultParams();
  const snapshot = { ...before };
  randomizeParams(before);
  assert.deepEqual(before, snapshot);
});

test('randomizeParams returns a complete patch', () => {
  const next = randomizeParams(getDefaultParams());
  for (const id of ALL_PARAM_IDS) {
    assert.equal(typeof next[id], 'number', `missing ${id}`);
  }
});
