import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ColorManagement, SRGBColorSpace } from 'three'
import { IsometricCamera } from './components/IsometricCamera.tsx'
import { LabPanel } from './components/LabPanel.tsx'
import { RenderBoundary } from './components/RenderBoundary.tsx'
import { LabPipeline } from './effects/LabPipeline.tsx'
import { CabinScene } from './scenes/cabin/CabinScene.tsx'
import { RuntimeDiagnostics } from './systems/RuntimeDiagnostics.tsx'
import { useLabStore } from './stores/labStore.ts'
import { QUALITY } from './systems/quality.ts'

ColorManagement.enabled = true

export default function App() {
  const quality = useLabStore((state) => state.quality)
  return <main className="laboratory">
    <LabPanel />
    <section className="viewport" aria-label="Cabana completa R3F isométrica">
      <div className="viewport-caption"><span>A CASA DA BRUXA</span><p>Art Pass 1 · editor de composição isolado</p></div>
      <RenderBoundary>
        <Canvas orthographic flat dpr={[1, QUALITY[quality].dpr]} shadows="percentage"
          gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => { gl.outputColorSpace = SRGBColorSpace }}
          fallback={<div className="fallback"><h2>WebGL indisponível</h2><p>Abra em Chrome/Edge com WebGL 2 habilitado para avaliar o render.</p></div>}>
          <color attach="background" args={['#10192b']} />
          <IsometricCamera />
          <Suspense fallback={null}><CabinScene /></Suspense>
          <LabPipeline />
          <RuntimeDiagnostics />
        </Canvas>
      </RenderBoundary>
      <p className="viewport-note">Câmera ortográfica fixa · proporções preservadas no resize</p>
    </section>
  </main>
}
