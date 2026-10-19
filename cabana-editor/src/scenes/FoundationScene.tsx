import { Suspense, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { AssetProbe } from '../components/AssetProbe.tsx'
import { useLabStore } from '../stores/labStore.ts'

function MaterialSpecimen() {
  const mesh = useRef<Mesh>(null)
  const time = useRef(0)
  useFrame((_, delta) => {
    if (!mesh.current || !useLabStore.getState().animate) return
    time.current += Math.min(delta, 0.1)
    mesh.current.rotation.y = time.current * 0.24
    mesh.current.position.y = 1.28 + Math.sin(time.current * 0.9) * 0.045
  })
  return <mesh ref={mesh} position={[0, 1.28, 0]} castShadow>
    <icosahedronGeometry args={[0.7, 1]} />
    <meshStandardMaterial color="#71518d" roughness={0.34} metalness={0.32}
      emissive="#593777" emissiveIntensity={0.18} />
  </mesh>
}

export function FoundationScene() {
  return <group name="foundation-scene">
    <mesh position={[0, -0.13, 0]} receiveShadow><boxGeometry args={[8.8, 0.24, 6.4]} />
      <meshStandardMaterial color="#2b2734" roughness={0.91} />
    </mesh>
    <mesh position={[-2.25, 0.5, 0]} castShadow receiveShadow><boxGeometry args={[1.35, 1, 1.35]} />
      <meshStandardMaterial color="#50382e" roughness={0.8} />
    </mesh>
    <mesh position={[-2.25, 1.13, 0]} castShadow><torusGeometry args={[0.42, 0.11, 8, 32]} />
      <meshStandardMaterial color="#ac884b" roughness={0.35} metalness={0.78} />
    </mesh>
    <mesh position={[0, 0.19, 0]} castShadow receiveShadow><cylinderGeometry args={[1.05, 1.16, 0.36, 32]} />
      <meshStandardMaterial color="#42364d" roughness={0.72} />
    </mesh>
    <MaterialSpecimen />
    <mesh position={[2.2, 0.3, 0.25]} castShadow receiveShadow><cylinderGeometry args={[0.85, 0.94, 0.6, 24]} />
      <meshStandardMaterial color="#38303d" roughness={0.87} />
    </mesh>
    <Suspense fallback={null}><AssetProbe /></Suspense>
    <mesh position={[0, 0.4, -1.8]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.32, 0.045, 8, 32]} />
      <meshStandardMaterial color="#aa8ad0" emissive="#ae83e5" emissiveIntensity={2} roughness={0.5} />
    </mesh>
  </group>
}
