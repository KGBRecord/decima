// Minimal React fiber typings used when walking __reactFiber* keys on DOM elements.

export interface ReactFiberLike {
  memoizedProps?: unknown;
  return?: ReactFiberLike | null;
}

export type FiberHost = Element & Record<string, unknown>;
