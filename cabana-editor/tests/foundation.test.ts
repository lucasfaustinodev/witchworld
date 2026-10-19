import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { OrthographicCamera, Vector3, Box3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { fitIsometricCamera, LAB_BOUNDS } from '../src/systems/camera.ts'
import { QUALITY, isQuality } from '../src/systems/quality.ts'
import { createLabEnvironment } from '../src/assets/labEnvironment.ts'
import { useLabStore } from '../src/stores/labStore.ts'
import { cabinMigrationSpec } from '../src/scenes/cabin/migrationSpec.ts'

for (const [width, height] of [[1440, 900], [390, 844], [844, 390], [320, 340]]) {
  test(`câmera preserva bounds e proporção em ${width}×${height}`, () => {
    const camera = new OrthographicCamera()
    fitIsometricCamera(camera, width, height)
    assert.ok(Math.abs((camera.right - camera.left) / (camera.top - camera.bottom) - width / height) < 1e-10)
    for (const x of [LAB_BOUNDS.min[0], LAB_BOUNDS.max[0]])
      for (const y of [LAB_BOUNDS.min[1], LAB_BOUNDS.max[1]])
        for (const z of [LAB_BOUNDS.min[2], LAB_BOUNDS.max[2]]) {
          const ndc = new Vector3(x, y, z).project(camera)
          assert.ok(Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && Math.abs(ndc.z) <= 1)
        }
  })
}

test('HIGH / MEDIUM / LOW possuem orçamento e fallback explícitos', () => {
  assert.ok(QUALITY.HIGH.dpr > QUALITY.MEDIUM.dpr && QUALITY.MEDIUM.dpr > QUALITY.LOW.dpr)
  assert.equal(QUALITY.HIGH.ao, true)
  assert.equal(QUALITY.MEDIUM.ao, false)
  assert.equal(QUALITY.LOW.post, false)
  assert.equal(isQuality('invalid'), false)
  assert.equal(isQuality('HIGH'), true)
})

test('Zustand limita parâmetros e mantém alteração local, sem persistência externa', () => {
  const initial = useLabStore.getState()
  initial.setExposure(50); initial.setWarm(-10); initial.setMoon(100)
  assert.equal(useLabStore.getState().exposure, 1.6)
  assert.equal(useLabStore.getState().warm, 0)
  assert.equal(useLabStore.getState().moon, 5)
  initial.setQuality('LOW')
  assert.equal(useLabStore.getState().metrics, null)
  useLabStore.setState(initial, true)
})

test('Environment local contém dados HDR lineares finitos, sem download remoto', () => {
  const texture = createLabEnvironment()
  assert.equal(texture.image.width, 64)
  assert.equal(texture.image.height, 32)
  const data = texture.image.data as Float32Array
  assert.ok(data.every(Number.isFinite))
  assert.ok(data.some((value, index) => index % 4 !== 3 && value > 1))
  texture.dispose()
})

test('GLB local carrega com GLTFLoader real e preserva bytes do original', async () => {
  const bytes = await readFile(new URL('../public/assets/ritual-skull.glb', import.meta.url))
  const original = await readFile(new URL('../reference/vanilla-v44/dist/assets/ritual-skull.glb', import.meta.url))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), createHash('sha256').update(original).digest('hex'))
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const gltf = await new GLTFLoader().parseAsync(data, '')
  const box = new Box3().setFromObject(gltf.scene)
  assert.equal(box.isEmpty(), false)
  let meshes = 0, triangles = 0
  gltf.scene.traverse((object) => {
    if ('isMesh' in object && object.isMesh && 'geometry' in object) {
      const geometry = object.geometry as import('three').BufferGeometry
      meshes += 1
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3
      geometry.dispose()
    }
  })
  assert.ok(meshes > 0 && triangles > 0)
})

test('cabana preparada usa dimensões e fonte v44, sem iniciar cena ou navegação', () => {
  assert.equal(cabinMigrationSpec.sourceVersion, 44)
  assert.equal(cabinMigrationSpec.floor.width, 10.4)
  assert.equal(cabinMigrationSpec.floor.depth, 8.4)
  assert.equal(cabinMigrationSpec.zones.length, 6)
})
