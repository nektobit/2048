import {
  computed,
  effect,
  endBatch,
  getActiveSub,
  setActiveSub,
  signal,
  startBatch
} from "alien-signals";

export { computed, effect, signal };

export type WritableSignal<T> = {
  (): T;
  (value: T): void;
};

export function batch<T>(run: () => T): T {
  startBatch();
  try {
    return run();
  } finally {
    endBatch();
  }
}

export function untracked<T>(run: () => T): T {
  const previous = getActiveSub();
  setActiveSub(undefined);
  try {
    return run();
  } finally {
    setActiveSub(previous);
  }
}
