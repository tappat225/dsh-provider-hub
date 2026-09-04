'use strict';
/**
 * Minimal React shim for render-smoke tests: createElement plus the hook
 * subset the page component uses, backed by an array that survives across
 * manual re-renders (a fresh mount = __reset() + call the component again).
 * Not a React implementation — just enough to execute component bodies and
 * walk the produced element tree.
 */
let store = [];
let cursor = 0;
const trace = [];

const useState = (init) => {
  const i = cursor++;
  if (store[i] === undefined) store[i] = typeof init === 'function' ? init() : init;
  const set = (value) => {
    const next = typeof value === 'function' ? value(store[i]) : value;
    trace.push({ index: i, kind: typeof next, at: 'set' });
    store[i] = next;
  };
  return [store[i], set];
};

const shim = {
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  Fragment: Symbol.for('phub.react-shim.fragment'),
  useState,
  // deps ignored: identity is irrelevant without a real scheduler
  useCallback: (fn) => fn,
  // effects run inline (refresh() is async; the test flushes microtasks)
  useEffect: (fn) => { void (typeof fn === 'function' ? fn() : undefined); },
  useRef: (value) => ({ current: value }),
  __reset: () => { store = []; cursor = 0; trace.length = 0; },
  // React resets its hook cursor at the start of every render of a fiber;
  // the test harness must call this before each component invocation.
  __beginRender: () => { cursor = 0; },
  __store: () => store,
  __trace: () => trace,
};
shim.default = shim;
module.exports = shim;
