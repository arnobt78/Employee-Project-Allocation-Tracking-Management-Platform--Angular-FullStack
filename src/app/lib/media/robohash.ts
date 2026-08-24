/** Stable robot avatar; same seed → same robot (Robohash set1). */
export function robohashUrl(seed: string, size = 80): string {
  const normalized = encodeURIComponent(seed.trim().toLowerCase());
  const px = Math.max(40, Math.min(size, 256));
  return `https://robohash.org/${normalized}?set=set1&size=${px}x${px}`;
}
