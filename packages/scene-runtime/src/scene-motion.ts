type MotionState = { active: boolean; reducedMotion: boolean };
const scopes = new WeakMap<HTMLElement, () => MotionState>();

/** A mounted scene shares motion preferences with its decorative environment. */
export function bindSceneMotion(host: HTMLElement, read: () => MotionState) {
  scopes.set(host, read);
  return () => { if (scopes.get(host) === read) scopes.delete(host); };
}

export function readSceneMotion(element?: HTMLElement): MotionState {
  for (let node: HTMLElement | null | undefined = element; node; node = node.parentElement) {
    const read = scopes.get(node);
    if (read) return read();
  }
  // Standalone renderers remain still until an owner opts into motion.
  return { active: true, reducedMotion: true };
}
