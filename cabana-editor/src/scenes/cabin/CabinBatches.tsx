import { useLayoutEffect, useMemo, useRef } from 'react'
import { Matrix4 } from 'three'
import type { InstancedMesh } from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { CabinEditorRuntime } from '../../editor/editorRuntime.ts'
import type { CabinBatch } from './buildCabinLayout.ts'
import { createPaintedBatchGeometry } from './cabinPaintedUv.ts'
import { useCabinEditor } from '../../editor/editorStore.ts'
import { resolveDefinitions } from '../../editor/layoutModel.ts'
import type { CabinObjectDefinition } from '../../editor/layoutModel.ts'
import { expandBatchInstances } from '../../editor/instanceCopies.ts'

function Batch({ batch, editor,definitions }: { batch: CabinBatch;editor:CabinEditorRuntime;definitions:readonly CabinObjectDefinition[] }) {
  const ref = useRef<InstancedMesh>(null)
  const last=useRef(-1), matrix=useMemo(()=>new Matrix4(),[]), hidden=useMemo(()=>new Matrix4().makeScale(0,0,0),[])
  const gl=useThree(state=>state.gl)
  const entries=useMemo(()=>expandBatchInstances(batch,definitions),[batch,definitions])
  const geometry = useMemo(() => createPaintedBatchGeometry(batch,entries.map(e=>e.sourceIndex)), [batch,entries])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    entries.forEach((entry,index)=>mesh.setMatrixAt(index,batch.matrices[entry.sourceIndex]))
    last.current=-1
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingBox()
    mesh.computeBoundingSphere()
    return () => { mesh.dispose(); geometry.dispose() }
  }, [batch, geometry,entries])
  useFrame(()=>{
    const mesh=ref.current, stamp=editor.store.getState().getRevision()
    if(!mesh||last.current===stamp||batch.category==='architecture')return
    last.current=stamp
    entries.forEach((entry,i)=>{
      const original=batch.matrices[entry.sourceIndex],id=entry.ownerId
      if(!id){mesh.setMatrixAt(i,original);return}
      if(!editor.store.getState().getLiveLayout()[id]){mesh.setMatrixAt(i,hidden);return}
      const world=editor.get(id)
      mesh.setMatrixAt(i,world.visible?matrix.multiplyMatrices(world.delta,original):hidden)
    })
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();gl.shadowMap.needsUpdate=true
  },-20)
  return <instancedMesh ref={ref} name={`cabin-${batch.category}-${batch.m.name || batch.key}`}
    userData={{ownerIds:entries.map(e=>e.ownerId)}} args={[geometry, batch.m, entries.length]} castShadow={batch.shadow} receiveShadow dispose={null} />
}

export function CabinBatches({ batches,editor }: { batches: CabinBatch[];editor:CabinEditorRuntime }) {
  const topology=useCabinEditor(s=>Object.keys(s.layout).filter(id=>s.layout[id].copy).join('|'))
  const definitions=useMemo(()=>resolveDefinitions(editor.store.getState().definitions,editor.store.getState().layout),[editor,topology])
  return <>{batches.map((batch) => <Batch key={batch.key} batch={batch} editor={editor} definitions={definitions} />)}</>
}
