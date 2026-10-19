import test from 'node:test'
import assert from 'node:assert/strict'
import { Box3, Matrix4, OrthographicCamera, Vector3 } from 'three'
import { buildCabinLayout } from '../src/scenes/cabin/buildCabinLayout.ts'
import { fitIsometricCamera } from '../src/systems/camera.ts'
import { prepareCabinMaterials } from '../src/scenes/cabin/cabinMaterials.ts'

test('cabana completa possui buffers finitos, instancing e volumes válidos', () => {
  const layout = buildCabinLayout()
  try {
    // The material pass adds real bevels, masonry and curved joinery within a 50k geometry budget.
    assert.ok(layout.metrics.triangles > 19000 && layout.metrics.triangles < 50000)
    assert.ok(layout.metrics.meshes < 115)
    assert.ok(layout.metrics.instances > 960)
    assert.ok(layout.batches.some((batch) => batch.category === 'architecture'))
    assert.ok(layout.batches.some((batch) => batch.category === 'furniture'))
    for (const batch of layout.batches) {
      for (const attribute of Object.values(batch.g.attributes)) assert.ok(Array.from(attribute.array).every(Number.isFinite))
      for (const matrix of batch.matrices) { assert.ok(matrix.elements.every(Number.isFinite)); assert.notEqual(matrix.determinant(), 0) }
      if (batch.g.index) assert.ok(Array.from(batch.g.index.array).every((index) => index < batch.g.attributes.position.count))
    }
    for (const name of ['bed', 'bookshelf', 'study-desk', 'hearth', 'storage', 'chest', 'reading-chair']) {
      assert.ok(layout.obstacles.some((obstacle) => obstacle.name === name), name)
    }
  } finally { layout.dispose() }
})

test('corredor da entrada e centro permanecem livres dos móveis sólidos', () => {
  const layout = buildCabinLayout()
  try {
    for (const [x, z] of [[0,3.5],[0,2.8],[0,1.8],[0,.36],[0,-1.2],[1.7,-1.0],[-1.65,.3],[2.0,.5]]) {
      for (const obstacle of layout.obstacles) {
        const blocked = Math.abs(x-obstacle.position[0]) < obstacle.size[0]/2+.25 && Math.abs(z-obstacle.position[2]) < obstacle.size[2]/2+.25
        assert.equal(blocked, false, `${x},${z}: ${obstacle.name}`)
      }
    }
  } finally { layout.dispose() }
})

test('geometria completa cabe no enquadramento desktop e mobile', () => {
  const layout = buildCabinLayout(), point = new Vector3(), camera = new OrthographicCamera()
  try {
    for (const [width, height] of [[1440,900],[390,524],[844,390]]) {
      fitIsometricCamera(camera,width,height)
      for (const batch of layout.batches) {
        batch.g.computeBoundingBox()
        const box = batch.g.boundingBox!
        for (const matrix of batch.matrices) {
          const world = new Box3().copy(box).applyMatrix4(matrix)
          for (const x of [world.min.x,world.max.x]) for (const y of [world.min.y,world.max.y]) for (const z of [world.min.z,world.max.z]) {
            point.set(x,y,z).project(camera)
            assert.ok(Math.abs(point.x)<=1 && Math.abs(point.y)<=1 && Math.abs(point.z)<=1,`crop em ${width}×${height}`)
          }
        }
      }
    }
  } finally { layout.dispose() }
})

test('materiais reusam um único relógio e não criam recursos por frame', () => {
  const layout = buildCabinLayout()
  try {
    const clock = prepareCabinMaterials(layout.materials)
    const shader = {uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <emissivemap_fragment>'}
    layout.materials.potion.onBeforeCompile(shader as never, {} as never)
    assert.equal((shader.uniforms as Record<string,unknown>).uCabinTime,clock)
    assert.ok(shader.vertexShader.includes('USE_INSTANCING'))
    assert.ok(shader.fragmentShader.includes('vec2 p=vCabinPotionPlane'),'the cauldron rim shading follows its local surface when moved')
  } finally { layout.dispose() }
})
