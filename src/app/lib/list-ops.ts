/** Replace the item with the same `prop` value, or append it. Never mutates. */
export function upsertBy<T, P extends keyof T>(list: readonly T[], prop: P, item: T): T[] {
  const index = list.findIndex((entry) => entry[prop] === item[prop]);
  if (index === -1) {
    return [...list, item];
  }
  const next = [...list];
  next[index] = item;
  return next;
}

export function removeBy<T, P extends keyof T>(
  list: readonly T[],
  prop: P,
  value: T[P]
): T[] {
  return list.filter((entry) => entry[prop] !== value);
}
