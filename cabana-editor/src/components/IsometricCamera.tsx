import { useLayoutEffect, useRef } from 'react'
import { OrthographicCamera } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { OrthographicCamera as ThreeCamera } from 'three'
import { fitIsometricCamera, ISO_POSITION } from '../systems/camera.ts'

export function IsometricCamera() {
  const ref = useRef<ThreeCamera>(null)
  const { width, height } = useThree((state) => state.size)
  useLayoutEffect(() => {
    if (ref.current) fitIsometricCamera(ref.current, width, height)
  }, [width, height])
  return <OrthographicCamera ref={ref} makeDefault manual position={[...ISO_POSITION]} near={0.1} far={80} />
}
