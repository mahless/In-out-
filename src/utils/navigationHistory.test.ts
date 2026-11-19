import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialTabState,
  getActiveTab,
  getTabDepth,
  popTabState,
  transitionTab,
} from './navigationHistory';

test('الرجوع بين التبويبات يرجع بالترتيب حتى يصل إلى الرئيسية (today)', () => {
  let state = createInitialTabState();
  assert.equal(getActiveTab(state), 'today');
  assert.equal(getTabDepth(state), 0);

  const step1 = transitionTab(state, 'log');
  assert.equal(step1.historyDelta, 1);
  state = step1.nextState;
  assert.equal(getActiveTab(state), 'log');
  assert.equal(getTabDepth(state), 1);

  const step2 = transitionTab(state, 'reports');
  assert.equal(step2.historyDelta, 1);
  state = step2.nextState;
  assert.equal(getActiveTab(state), 'reports');
  assert.equal(getTabDepth(state), 2);

  // Back 1: reports -> log
  state = popTabState(state);
  assert.equal(getActiveTab(state), 'log');
  assert.equal(getTabDepth(state), 1);

  // Back 2: log -> today (Home)
  state = popTabState(state);
  assert.equal(getActiveTab(state), 'today');
  assert.equal(getTabDepth(state), 0);

  // Back 3 at Home: remains at today without crashing
  state = popTabState(state);
  assert.equal(getActiveTab(state), 'today');
  assert.equal(getTabDepth(state), 0);
});

test('الانتقال المباشر إلى الرئيسية يزيل سجل التبويبات السابقة بشكل صحيح', () => {
  let state = createInitialTabState();
  state = transitionTab(state, 'log').nextState;
  state = transitionTab(state, 'reports').nextState;
  assert.equal(getTabDepth(state), 2);

  const backHome = transitionTab(state, 'today');
  assert.equal(backHome.historyDelta, -2);
  assert.equal(getActiveTab(backHome.nextState), 'today');
  assert.equal(getTabDepth(backHome.nextState), 0);
});
