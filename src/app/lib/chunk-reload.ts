const CHUNK_LOAD_ERROR =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/;

const RELOAD_STAMP_KEY = 'eh-chunk-reload-at';

/** Guards against a reload loop when the chunk is genuinely unavailable. */
const RELOAD_COOLDOWN_MS = 10_000;

export function isChunkLoadError(error: unknown): boolean {
  const text =
    error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return CHUNK_LOAD_ERROR.test(text);
}

/**
 * After a deploy, tabs still running the previous build request lazy chunks
 * that no longer exist. Reload once to the target URL so the new build loads.
 * Returns true when a reload was triggered.
 */
export function reloadForStaleChunk(
  error: unknown,
  targetUrl: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage,
  navigate: (url: string) => void = (url) => window.location.assign(url),
  now: number = Date.now()
): boolean {
  if (!isChunkLoadError(error)) {
    return false;
  }
  const lastReload = storage.getItem(RELOAD_STAMP_KEY);
  if (lastReload !== null && now - Number(lastReload) < RELOAD_COOLDOWN_MS) {
    return false;
  }
  storage.setItem(RELOAD_STAMP_KEY, String(now));
  navigate(targetUrl);
  return true;
}
