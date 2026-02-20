import {
  signal,
  computed,
  effect,
  startBatch,
  endBatch,
  getActiveSub,
  setActiveSub
} from "alien-signals";

export { signal, computed, effect };

export function batch(fn) {
  startBatch();
  try {
    return fn();
  } finally {
    endBatch();
  }
}

export function untracked(fn) {
  const previous = getActiveSub();
  setActiveSub(undefined);
  try {
    return fn();
  } finally {
    setActiveSub(previous);
  }
}
