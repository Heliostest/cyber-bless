import * as THREE from 'three'
import { expect, it } from 'vitest'
import { createCueBackdrop } from './cue-backdrop'

it('reuses one framebuffer texture, replaces it on resize and releases it on teardown',()=>{
  const backdrop=createCueBackdrop(), copies: THREE.FramebufferTexture[]=[]
  let width=640,height=800
  const renderer={
    getDrawingBufferSize:(out: THREE.Vector2)=>out.set(width,height),
    getPixelRatio:()=>2,
    getContext:()=>({TEXTURE0:33984}),
    state:{activeTexture(){}},
    copyFramebufferToTexture:(texture: THREE.FramebufferTexture)=>copies.push(texture),
  } as unknown as THREE.WebGLRenderer
  backdrop.capture(renderer); backdrop.capture(renderer)
  expect(copies[0]).toBe(copies[1])
  expect(copies[0].image).toEqual({width:640,height:800})
  let disposed=0; copies[0].addEventListener('dispose',()=>disposed++)
  width=800; height=600; backdrop.capture(renderer)
  expect(disposed).toBe(1)
  expect(copies[2]).not.toBe(copies[0])
  expect(copies[2].image).toEqual({width:800,height:600})
  let finalDisposed=0; copies[2].addEventListener('dispose',()=>finalDisposed++)
  backdrop.dispose(); backdrop.dispose()
  expect(finalDisposed).toBe(1)
})
