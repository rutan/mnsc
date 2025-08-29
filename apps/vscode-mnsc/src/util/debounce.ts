export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout> | undefined;
  // biome-ignore lint/suspicious/noExplicitAny: typing Parameters from generic T
  return ((...args: any[]) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...(args as Parameters<T>)), ms);
  }) as T;
}
