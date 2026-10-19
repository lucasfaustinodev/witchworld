import { Suspense, useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import { buildCabinLayout } from './buildCabinLayout.ts'
import { CabinBatches } from './CabinBatches.tsx'
import { CabinLighting } from './CabinLighting.tsx'
import { LibrarySkulls } from './LibrarySkull.tsx'
import { prepareCabinMaterials } from './cabinMaterials.ts'
import { useLabStore } from '../../stores/labStore.ts'
import { PAINTED_ATLAS_PATHS } from './cabinSurfaceLibrary.ts'
import { cabinEditorStore } from '../../editor/editorStore.ts'
import { CabinEditorRuntime } from '../../editor/editorRuntime.ts'
import { CabinEditorLayer } from '../../editor/CabinEditorLayer.tsx'
import { CABIN_PROP_LIBRARY, replaceCabinAssets } from './cabinAssetReplacements.ts'
import approvedLayoutText from './approved-cabin-layout-v3.json?raw'
import { parseLayout } from '../../editor/layoutModel.ts'
import { prepareReferenceRug } from './cabinReferenceRug.ts'

type Layout = ReturnType<typeof replaceCabinAssets>

export function CabinScene() {
  const [wood, surfaces] = useTexture(PAINTED_ATLAS_PATHS.map((path) => `${import.meta.env.BASE_URL}${path}`))
  const assets=useGLTF(`${import.meta.env.BASE_URL}${CABIN_PROP_LIBRARY}`,false,false)
  const [prepared, setPrepared] = useState<{layout:Layout;editor:CabinEditorRuntime} | null>(null)
  const shaderTime = useRef<ReturnType<typeof prepareCabinMaterials> | null>(null)
  useEffect(() => {
    const next = replaceCabinAssets(buildCabinLayout(),assets.scene)
    shaderTime.current = prepareCabinMaterials(next.materials, { wood, surfaces })
    prepareReferenceRug(next.materials)
    useLabStore.setState({ sceneStats: next.metrics })
    cabinEditorStore.getState().initialize(next.objects,parseLayout(approvedLayoutText,next.objects))
    setPrepared({layout:next,editor:new CabinEditorRuntime(next,cabinEditorStore)})
    return () => { shaderTime.current?.dispose(); next.dispose(); shaderTime.current = null }
  }, [wood, surfaces,assets.scene])
  useFrame((_, delta) => {
    const clock=shaderTime.current,state=useLabStore.getState(),dt=Math.min(delta,.1)
    if(clock){if(state.animate)clock.value+=dt;if(state.boil)clock.boil.value+=dt}
  })
  return <group name="cabin-r3f-complete">
    <CabinLighting editor={prepared?.editor} candleLights={prepared?.layout.candleLights} />
    {prepared && <CabinEditorLayer editor={prepared.editor}>
      <group name="cabin-architecture"><CabinBatches editor={prepared.editor} batches={prepared.layout.batches.filter((batch) => batch.category === 'architecture')} /></group>
      <group name="cabin-furniture-and-zones"><CabinBatches editor={prepared.editor} batches={prepared.layout.batches.filter((batch) => batch.category === 'furniture')} /></group>
      <Suspense fallback={null}><LibrarySkulls editor={prepared.editor} /></Suspense>
    </CabinEditorLayer>}
  </group>
}
