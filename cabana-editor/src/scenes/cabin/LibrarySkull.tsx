import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Box3, Group, Mesh, Vector3 } from 'three'
import type { CabinEditorRuntime } from '../../editor/editorRuntime.ts'
import { useLabStore } from '../../stores/labStore.ts'
import { useCabinEditor } from '../../editor/editorStore.ts'

export function LibrarySkulls({editor}:{editor:CabinEditorRuntime}) {
  const layout=useCabinEditor(s=>s.layout)
  const ids=['library-skull',...Object.keys(layout).filter(id=>layout[id].copy?.sourceId==='library-skull')]
  return <>{ids.map(id=><LibrarySkull key={id} editor={editor} id={id} />)}</>
}

function LibrarySkull({editor,id}:{editor:CabinEditorRuntime;id:string}) {
  const container=useRef<Group>(null)
  const gltf = useGLTF(`${import.meta.env.BASE_URL}assets/ritual-skull.glb`, false, false)
  const model = useMemo(() => {
    const root = gltf.scene.clone(true)
    // The original asset includes a helper Cube. Keep both actual skull meshes.
    root.getObjectByName('Cube')?.removeFromParent()
    root.traverse((object) => { if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true } })
    const bounds = new Box3().setFromObject(root), size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3())
    const scale = .29 / Math.max(size.x, size.y, size.z)
    return { root, scale, offset: [-center.x * scale, -bounds.min.y * scale, -center.z * scale] as [number, number, number] }
  }, [gltf.scene])
  useEffect(() => { useLabStore.setState({ assetStatus: 'loaded' }) }, [])
  useFrame(()=>{if(container.current){if(!editor.store.getState().getLiveLayout()[id]){container.current.visible=false;return}const world=editor.get(id);container.current.matrix.copy(world.delta);container.current.matrixWorldNeedsUpdate=true;container.current.visible=world.visible}},-20)
  return <group ref={container} matrixAutoUpdate={false} userData={{editorOwner:id}}><group position={[-2.12, 1.30, -3.38]} rotation={[0, .12, 0]}>
    <group position={model.offset} scale={model.scale}><primitive object={model.root} dispose={null} /></group>
  </group></group>
}
