import { useEffect, useMemo } from 'react'
import { Environment } from '@react-three/drei'
import { useLabStore } from '../stores/labStore.ts'
import { QUALITY } from '../systems/quality.ts'
import { createLabEnvironment } from '../assets/labEnvironment.ts'

export function LabLighting() {
  const quality = useLabStore((state) => state.quality)
  const warm = useLabStore((state) => state.warm)
  const moon = useLabStore((state) => state.moon)
  const environment = useMemo(createLabEnvironment, [])
  useEffect(() => () => environment.dispose(), [environment])
  return <>
    <hemisphereLight args={['#aab8dc', '#30202c', 0.65]} />
    <directionalLight position={[-3, 6, -3]} intensity={moon} color="#9cb6e8"
      castShadow={QUALITY[quality].shadows}
      shadow-mapSize={[QUALITY[quality].shadowSize, QUALITY[quality].shadowSize]}
      shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6}
      shadow-camera-near={0.1} shadow-camera-far={20} shadow-normalBias={0.035} />
    <pointLight position={[2.5, 2.5, 1.6]} color="#ffbd79" intensity={warm} distance={9} decay={2} />
    <Environment map={environment} background={false} environmentIntensity={0.24} />
  </>
}
