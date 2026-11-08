/** Foreground-only deadline; the shell disposes it on ready, background or retry. */
export function watchDomReadiness(onTimeout:()=>void,timeoutMs=30000):()=>void {
  const timer=setTimeout(onTimeout,timeoutMs);
  return()=>clearTimeout(timer);
}
