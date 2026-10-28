import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createOrigamiSheet, SHEET_HALF } from './origami-sheet'

describe('origami sheet (three.js view)', () => {
  it('measures bounds as turned, so the flat square frames by its diagonal', () => {
    const sheet = createOrigamiSheet()
    const own = sheet.bounds().getSize(new THREE.Vector3())
    expect(own.x).toBeCloseTo(2 * SHEET_HALF, 9)
    expect(own.y).toBeCloseTo(2 * SHEET_HALF, 9)
    const diamond = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 4)
    const turned = sheet.bounds(new THREE.Box3(), diamond).getSize(new THREE.Vector3())
    expect(turned.x).toBeCloseTo(2 * SHEET_HALF * Math.SQRT2, 9)
    expect(turned.y).toBeCloseTo(2 * SHEET_HALF * Math.SQRT2, 9)
    sheet.dispose()
  })

  it('moves the finished wing surfaces, normals and ink together and restores every buffer exactly', () => {
    const sheet = createOrigamiSheet()
    sheet.pose(4, 1)
    const buffers = () => sheet.object.children.map((child) => {
      const geometry = (child as THREE.Mesh).geometry
      return {
        position: Array.from(geometry.getAttribute('position').array),
        normal: geometry.getAttribute('normal') ? Array.from(geometry.getAttribute('normal').array) : undefined,
        drawCount: geometry.drawRange.count,
      }
    })
    const rest = buffers()
    const transform = sheet.object.matrix.clone()
    sheet.poseWingFlap(1)
    const moved = buffers()
    for (let i = 0; i < rest.length; i++) expect(moved[i].position).not.toEqual(rest[i].position)
    expect(moved[0].normal).not.toEqual(rest[0].normal)
    expect(sheet.object.matrix).toEqual(transform)
    sheet.poseWingFlap(0)
    expect(buffers()).toEqual(rest)
    sheet.dispose()
  })
})
