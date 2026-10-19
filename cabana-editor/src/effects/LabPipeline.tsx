import { useContext, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, EffectComposerContext, SMAA, SSAO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { ACESFilmicToneMapping, NoToneMapping } from 'three'
import { QUALITY } from '../systems/quality.ts'
import { useLabStore } from '../stores/labStore.ts'

function ComposerTopology() {
  const context = useContext(EffectComposerContext)
  useEffect(() => {
    useLabStore.setState({ pipelinePassNames: context.composer.passes.filter((pass) => pass.enabled).map((pass) => pass.name) })
  }, [context])
  return null
}

export function LabPipeline() {
  const quality = useLabStore((state) => state.quality)
  const settings = QUALITY[quality]
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    gl.shadowMap.enabled = settings.shadows
    gl.shadowMap.needsUpdate = true
    if (!settings.post) useLabStore.setState({ pipelinePassNames: ['DirectRender'] })
  }, [gl, settings.shadows, settings.post])
  // React Postprocessing owns rendering when enabled. LOW uses R3F's direct render.
  // Keep tone mapping at exactly one stage, including after quality switches.
  useFrame(() => {
    gl.toneMapping = settings.post ? NoToneMapping : ACESFilmicToneMapping
    gl.toneMappingExposure = useLabStore.getState().exposure
  }, -200)
  if (!settings.post) return null
  return (
    <EffectComposer key={quality} multisampling={0} enableNormalPass={settings.ao}>
      {settings.ao ? <SSAO samples={12} rings={4} radius={0.18} intensity={1.1} luminanceInfluence={0.6} /> : <></>}
      <Bloom intensity={0.16} luminanceThreshold={1.1} luminanceSmoothing={0.35} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
      <ComposerTopology />
    </EffectComposer>
  )
}
