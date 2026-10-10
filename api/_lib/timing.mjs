const enabled = process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1";

/** Logs a precomputed duration outside production. */
export function logTiming(label, ms) {
  if (enabled) {
    console.info(`[Timing] ${label} ${Math.round(ms)}ms`);
  }
}

/** Runs `task` and, outside production, logs `[Timing] <label> <ms>ms`. */
export async function timed(label, task) {
  if (!enabled) {
    return task();
  }
  const started = performance.now();
  try {
    return await task();
  } finally {
    logTiming(label, performance.now() - started);
  }
}
