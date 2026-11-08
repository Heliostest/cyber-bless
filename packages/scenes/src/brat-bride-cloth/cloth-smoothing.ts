import * as THREE from 'three'

/** A supported cloth height field. Pressure lowers local rest heights; coupled
 * damped springs relax the surface without letting its underside cross the sill. */
export function createClothSmoothing(nx: number, nz: number, write: (heights: Float64Array) => void) {
  const count = (nx + 1) * (nz + 1), heights = new Float64Array(count), velocity = new Float64Array(count)
  const coverage = new Float64Array(count), rest = new Float64Array(count)
  const index = (i: number, j: number) => j * (nx + 1) + i
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / nz
    rest[index(i,j)] = .12 * Math.sin(Math.PI*u)**2 * Math.sin(Math.PI*v)**2 * (.65 + .35*Math.cos(6*Math.PI*u))
  }
  return {
    begin() { heights.set(rest); velocity.fill(0); coverage.fill(0); write(heights) },
    stroke(from: THREE.Vector2, to: THREE.Vector2) {
      if (![...from,...to].every(Number.isFinite) || Math.abs(to.x-from.x) < .001 || Math.abs(to.x-from.x) < Math.abs(to.y-from.y)) return
      if ([from,to].some(p => Math.abs(p.x) > .825 || Math.abs(p.y) > .37)) return
      const dx=to.x-from.x, dz=to.y-from.y, length2=dx*dx+dz*dz
      for (let j=0;j<=nz;j++) for (let i=0;i<=nx;i++) {
        const x=(i/nx-.5)*1.65, z=(j/nz-.5)*.74
        const t=THREE.MathUtils.clamp(((x-from.x)*dx+(z-from.y)*dz)/length2,0,1)
        const distance=Math.hypot(x-from.x-dx*t,z-from.y-dz*t)
        const pressure=1-THREE.MathUtils.smoothstep(distance,.08,.22), k=index(i,j)
        coverage[k]=Math.max(coverage[k]!,pressure)
      }
    },
    progress() {
      let sum=0, samples=0
      for(let j=1;j<nz;j++)for(let i=1;i<nx;i++){sum+=coverage[index(i,j)]!;samples++}
      return sum/samples
    },
    finish() { coverage.fill(1) },
    update(dt: number, reduced: boolean) {
      if (!Number.isFinite(dt) || dt <= 0) return
      const steps=Math.ceil(Math.min(dt,.05)/.008), h=Math.min(dt,.05)/steps
      for(let step=0;step<steps;step++) {
        for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++) {
          const k=index(i,j), target=rest[k]!*(1-coverage[k]!)
          if (reduced || i===0 || j===0 || i===nx || j===nz) { heights[k]=target;velocity[k]=0;continue }
          const neighbors=(heights[k-1]!+heights[k+1]!+heights[k-nx-1]!+heights[k+nx+1]!)/4
          velocity[k]!+=(180*(target-heights[k]!)+35*(neighbors-heights[k]!)-22*velocity[k]!)*h
        }
        for(let k=0;k<count;k++) { heights[k]=THREE.MathUtils.clamp(heights[k]!+velocity[k]!*h,0,.15); if(heights[k]===0)velocity[k]=Math.max(0,velocity[k]!) }
      }
      write(heights)
    },
    snapshot: () => ({heights:heights.slice(),velocity:velocity.slice(),coverage:coverage.slice()}),
    restore(saved: {heights:Float64Array;velocity:Float64Array;coverage:Float64Array}) {
      heights.set(saved.heights);velocity.set(saved.velocity);coverage.set(saved.coverage);write(heights)
    },
  }
}
