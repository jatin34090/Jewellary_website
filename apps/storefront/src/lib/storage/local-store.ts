// A small external store backed by localStorage, read through useSyncExternalStore.
// Bag and wishlist data is kept in this browser for guests. Signed-in customers also sync it with the server (see saved-items-sync).

export interface LocalStore<T> {
  /** Current value. Returns the same reference until the value changes, as useSyncExternalStore requires. */
  getSnapshot: () => T;
  /** Value used during server rendering and hydration. Always the empty state. */
  getServerSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
  update: (next: (previous: T) => T) => void;
}

interface Options<T> {
  key: string;
  empty: T;
  /** Validates whatever was stored. Anything malformed falls back to the empty value. */
  parse: (raw: unknown) => T;
}

export function createLocalStore<T>({ key, empty, parse }: Options<T>): LocalStore<T> {
  let cached: T | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (cached !== undefined) return cached;
    try {
      const raw = window.localStorage.getItem(key);
      cached = raw === null ? empty : parse(JSON.parse(raw) as unknown);
    } catch {
      // Private browsing, blocked storage or corrupt JSON: start empty rather than crash.
      cached = empty;
    }
    return cached;
  };

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  const onStorage = (event: StorageEvent): void => {
    if (event.key === key) {
      cached = undefined;
      notify();
    }
  };

  return {
    getSnapshot: read,
    getServerSnapshot: () => empty,
    subscribe: (listener) => {
      if (listeners.size === 0) window.addEventListener("storage", onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
      };
    },
    update: (next) => {
      const value = next(read());
      cached = value;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage full or disabled: the value still applies for this page view.
      }
      notify();
    },
  };
}
