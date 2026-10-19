import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'
import { useLabStore } from '../stores/labStore.ts'

export const SKULL_URL = `${import.meta.env.BASE_URL}assets/ritual-skull.glb`

// One archived asset proves the local glTF loading seam, not character migration.
export function AssetProbe() {
  const gltf = useGLTF(SKULL_URL, false, false)
  const placement = useMemo(() => {
    const box = new Box3().setFromObject(gltf.scene)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const scale = 1.25 / Math.max(size.x, size.y, size.z)
    return { scale, position: [-center.x * scale, -box.min.y * scale, -center.z * scale] as [number, number, number] }
  }, [gltf.scene])
  useEffect(() => { useLabStore.setState({ assetStatus: 'loaded' }) }, [])
  return <group position={[2.2, 0.62, 0.25]}>
    <group scale={placement.scale} position={placement.position}><primitive object={gltf.scene} /></group>
  </group>
}
