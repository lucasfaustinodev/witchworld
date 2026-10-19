import { OrthographicCamera, Vector3 } from 'three'

export const ISO_TARGET = [0, 1.05, 0.15] as const
export const ISO_POSITION = [10, 14.0, 20.15] as const
export const LAB_BOUNDS = { min: [-5.5, -0.55, -4.55], max: [5.5, 3.35, 5.1] } as const

/** Fit the same world bounds on landscape and portrait, without stretching. */
export function fitIsometricCamera(camera: OrthographicCamera, width: number, height: number) {
  const aspect = Math.max(width, 1) / Math.max(height, 1)
  camera.position.set(...ISO_POSITION)
  camera.lookAt(...ISO_TARGET)
  camera.updateMatrixWorld(true)
  let extentX = 0, extentY = 0
  const point = new Vector3()
  for (const x of [LAB_BOUNDS.min[0], LAB_BOUNDS.max[0]])
    for (const y of [LAB_BOUNDS.min[1], LAB_BOUNDS.max[1]])
      for (const z of [LAB_BOUNDS.min[2], LAB_BOUNDS.max[2]]) {
        point.set(x, y, z).applyMatrix4(camera.matrixWorldInverse)
        extentX = Math.max(extentX, Math.abs(point.x))
        extentY = Math.max(extentY, Math.abs(point.y))
      }
  const halfHeight = Math.max(extentY, extentX / aspect) * 1.055
  camera.left = -halfHeight * aspect
  camera.right = halfHeight * aspect
  camera.top = halfHeight
  camera.bottom = -halfHeight
  camera.near = 0.1
  camera.far = 80
  camera.zoom = 1
  camera.updateProjectionMatrix()
}
