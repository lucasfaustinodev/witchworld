import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { DataTexture, RGBAFormat, UnsignedByteType } from 'three'
import type { CabinEditorRuntime } from '../../editor/editorRuntime.ts'
import type { PointLight, SpotLight } from 'three'
import { createLabEnvironment } from '../../assets/labEnvironment.ts'
import { useLabStore } from '../../stores/labStore.ts'
import { QUALITY } from '../../systems/quality.ts'
import { EditableFixtureLights } from './EditableFixtureLights.tsx'

function createWindowMask() {
  const size = 64, data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const edge = Math.min(x, y, size - 1 - x, size - 1 - y)
    const bar = Math.abs(x - 31.5) < 2 || Math.abs(y - 31.5) < 2
    const value = bar ? 16 : Math.min(255, Math.max(0, edge - 4) * 45)
    const i = (y * size + x) * 4
    data.set([value, value, value, 255], i)
  }
  const map = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  map.needsUpdate = true
  return map
}

export function CabinLighting({editor,candleLights}:{editor?:CabinEditorRuntime;candleLights?:readonly import('./cabinFixtures.ts').CandleLightSource[]}) {
  const quality = useLabStore((state) => state.quality)
  const warm = useLabStore((state) => state.warm)
  const environment = useMemo(createLabEnvironment, [])
  const windowMask = useMemo(createWindowMask, [])
  const key = useRef<SpotLight>(null), hearth = useRef<PointLight>(null)
  const time = useRef(0)
  useEffect(() => () => { environment.dispose(); windowMask.dispose() }, [environment, windowMask])
  useEffect(() => {
    if (key.current) { key.current.target.position.set(-.9, 0, 1.1); key.current.target.updateMatrixWorld() }
  }, [])
  useFrame((_, delta) => {
    if (useLabStore.getState().animate) time.current += Math.min(delta, 0.1)
    const t = time.current, scale = warm / 15
    if (key.current) key.current.intensity = 38 * scale
    if (hearth.current) hearth.current.intensity = 18 * scale * (1 + .035 * Math.sin(t * 1.8 + 4.3))
  })
  return <>
    <hemisphereLight args={['#a3b2d0', '#3a2634', .30]} />
    <spotLight ref={key} position={[-2.6, 5.4, 4.1]} color="#ffd0a0" intensity={38 * warm / 15}
      distance={16} angle={0.90} penumbra={0.82} decay={2} castShadow={QUALITY[quality].shadows}
      shadow-mapSize={[QUALITY[quality].shadowSize, QUALITY[quality].shadowSize]}
      shadow-camera-near={0.5} shadow-camera-far={18} shadow-normalBias={0.035} shadow-bias={-0.00015} />
    <EditableFixtureLights editor={editor} map={windowMask} candleLights={candleLights} />
    <pointLight ref={hearth} position={[4.05, .8, -2.31]} color="#ff9d51" intensity={18 * warm / 15} distance={4.3} decay={2} />
    <Environment map={environment} background={false} environmentIntensity={0.15} />
  </>
}
