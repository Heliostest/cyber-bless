import * as THREE from 'three';

const DEFAULT_WIND_DIRECTION = new THREE.Vector2(-0.8, 0.6).normalize();
const DEFAULT_WIND_STRENGTH = 0.5;
const DEFAULT_GUST_DECAY_SECONDS = 1.6;
const MAX_GUST_STRENGTH = 2.0;

/**
 * Shared world-space coherent wind field exposed on `scene.userData.environmentWind`.
 * Foreground props, hanging paper rigs, and background atmosphere can all sample
 * the same travelling breeze and transient gusts without allocating per call.
 */
export interface EnvironmentWindField {
  readonly time: number;
  readonly direction: THREE.Vector2;
  readonly strength: number;
  readonly gust: number;
  sample(x: number, y: number, z: number, out?: THREE.Vector3): THREE.Vector3;
  triggerGust(strength?: number): void;
}

export interface EnvironmentWindOptions {
  direction?: THREE.Vector2 | readonly [number, number];
  strength?: number;
  gustDecaySeconds?: number;
}

export interface EnvironmentWindController extends EnvironmentWindField {
  /** Advance (or zero under reduced motion) the shared wind clock and gust decay. */
  update(time: number, dt?: number, reducedMotion?: boolean): void;
  /** Reset wind clock, reduced-motion state, and active gust back to calm defaults. */
  reset(): void;
}

function normalizeDirection(input?: THREE.Vector2 | readonly [number, number]): THREE.Vector2 {
  const dir = new THREE.Vector2();
  if (input instanceof THREE.Vector2) {
    dir.copy(input);
  } else if (Array.isArray(input) && input.length >= 2) {
    dir.set(Number(input[0]) || 0, Number(input[1]) || 0);
  }
  if (!Number.isFinite(dir.x) || !Number.isFinite(dir.y) || dir.lengthSq() < 1e-8) {
    dir.copy(DEFAULT_WIND_DIRECTION);
  } else {
    dir.normalize();
  }
  return dir;
}

/**
 * Create a coherent travelling-wave wind field modeled after *The Tea Ride*'s `Wind.at`:
 * a directional travelling wave plus subtle multi-frequency cross-breeze flutter and
 * smooth exponential gust decay.
 */
export function createEnvironmentWind(options: EnvironmentWindOptions = {}): EnvironmentWindController {
  const dir = normalizeDirection(options.direction);
  const baseStrength =
    options.strength !== undefined && Number.isFinite(options.strength)
      ? Math.max(0, options.strength)
      : DEFAULT_WIND_STRENGTH;
  const decaySeconds =
    options.gustDecaySeconds !== undefined &&
    Number.isFinite(options.gustDecaySeconds) &&
    options.gustDecaySeconds > 1e-3
      ? options.gustDecaySeconds
      : DEFAULT_GUST_DECAY_SECONDS;

  let currentTime = 0;
  let gustValue = 0;
  let reduced = false;

  return {
    get time() {
      return currentTime;
    },
    get direction() {
      return dir;
    },
    get strength() {
      return reduced ? 0 : baseStrength;
    },
    get gust() {
      return gustValue;
    },
    sample(x: number, y: number, z: number, out?: THREE.Vector3): THREE.Vector3 {
      const target = out ?? new THREE.Vector3();
      const effStrength = reduced ? 0 : baseStrength;
      if (effStrength <= 0) return target.set(0, 0, 0);

      const dx = dir.x;
      const dz = dir.y;
      const t = currentTime;
      const wave =
        0.55 +
        0.45 * Math.sin((x * dx + z * dz) * -0.22 + t * 1.1 + 2.0 * Math.sin(z * 0.07 + t * 0.31));
      const flutter =
        Math.sin(x * 1.7 + y * 0.9 + z * 1.3 + t * 3.1) * 0.35 +
        Math.sin(x * 3.1 + y * 2.3 + z * 2.7 + t * 5.3) * 0.18;
      const amplitude = effStrength * (1 + gustValue * 1.35);
      const along = amplitude * (wave * 0.8 + flutter * 0.38);
      const cross = amplitude * flutter * 0.42;
      const lift = amplitude * (0.35 * flutter * 0.5 + gustValue * 0.08 * wave);
      return target.set(
        dx * along - dz * cross,
        lift,
        dz * along + dx * cross,
      );
    },
    triggerGust(strength = 0.85) {
      if (reduced || baseStrength <= 0) return;
      if (!Number.isFinite(strength) || strength <= 0) return;
      gustValue = Math.min(MAX_GUST_STRENGTH, gustValue + strength);
    },
    update(time: number, dt = 0, reducedMotion = false) {
      if (reducedMotion) {
        reduced = true;
        currentTime = 0;
        gustValue = 0;
        return;
      }
      reduced = false;
      currentTime = Number.isFinite(time) ? Math.max(0, time) : 0;
      if (Number.isFinite(dt) && dt > 0 && gustValue > 0) {
        gustValue *= Math.exp(-dt / decaySeconds);
        if (gustValue < 1e-4) gustValue = 0;
      }
    },
    reset() {
      currentTime = 0;
      gustValue = 0;
      reduced = false;
    },
  };
}

/**
 * Look up the active `EnvironmentWindField` mounted on a scene (or any ancestor of an Object3D).
 */
export function readEnvironmentWind(scene: THREE.Object3D | null | undefined): EnvironmentWindField | undefined {
  for (let node: THREE.Object3D | null | undefined = scene; node; node = node.parent) {
    const candidate = node.userData?.environmentWind as Partial<EnvironmentWindField> | undefined;
    if (
      candidate &&
      typeof candidate === 'object' &&
      typeof candidate.sample === 'function' &&
      typeof candidate.triggerGust === 'function' &&
      candidate.direction instanceof THREE.Vector2
    ) {
      return candidate as EnvironmentWindField;
    }
  }
  return undefined;
}
