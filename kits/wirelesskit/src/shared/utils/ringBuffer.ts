export function pushRing<T>(arr: T[], item: T, max: number): T[] {
  const next = arr.length >= max ? arr.slice(arr.length - (max - 1)) : arr.slice();
  next.push(item);
  return next;
}

