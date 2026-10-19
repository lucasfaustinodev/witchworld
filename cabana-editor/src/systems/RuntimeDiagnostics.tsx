import { useEffect, useRef } from 'react'
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber'
import { useLabStore } from '../stores/labStore.ts'

export function RuntimeDiagnostics() {
  const { gl, scene, size, viewport } = useThree()
  const tally = useRef({ time: 0, frames: 0, last: 0 })
  useEffect(() => {
    useLabStore.setState({ status: 'mounted' })
    const previousReset = gl.info.autoReset
    gl.info.autoReset = false
    const lost = (event: Event) => {
      event.preventDefault()
      useLabStore.setState({ status: 'lost', error: 'Contexto WebGL interrompido. Recarregue o laboratório.' })
    }
    gl.domElement.addEventListener('webglcontextlost', lost)
    const unsubscribe = addAfterEffect(() => {
      const time = performance.now()
      const accumulator = tally.current
      if (!accumulator.last) accumulator.last = time
      accumulator.time += time - accumulator.last
      accumulator.last = time
      accumulator.frames += 1
      if (gl.info.render.calls > 0 && useLabStore.getState().status === 'mounted') useLabStore.setState({ status: 'rendered' })
      if (accumulator.time < 1000 || gl.info.render.calls === 0) return
      let lights = 0
      const materials = new Set()
      scene.traverse((object) => {
        if ('isLight' in object) lights += 1
        if ('material' in object) {
          const material = object.material
          for (const m of Array.isArray(material) ? material : [material]) materials.add(m)
        }
      })
      const context = gl.getContext()
      useLabStore.setState({ metrics: {
        calls: gl.info.render.calls, triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0, lights, materials: materials.size,
        // Read actual composer topology. Internal bloom/SMAA draws also count above.
        composerPasses: useLabStore.getState().pipelinePassNames.length,
        passNames: useLabStore.getState().pipelinePassNames,
        frameIntervalMs: accumulator.time / accumulator.frames,
        width: size.width, height: size.height, dpr: viewport.dpr,
        renderer: String(context.getParameter(context.RENDERER)),
      } })
      accumulator.time = 0
      accumulator.frames = 0
    })
    return () => {
      unsubscribe()
      gl.domElement.removeEventListener('webglcontextlost', lost)
      gl.info.autoReset = previousReset
    }
  }, [gl, scene, size.width, size.height, viewport.dpr])
  // This reset runs before shadow/normal/AO/bloom/composer work. All render calls count.
  useFrame(() => gl.info.reset(), -1000)
  return null
}
