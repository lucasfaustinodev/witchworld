import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Box3, InstancedMesh, Raycaster, Vector3 } from 'three'
import { buildCabinLayout } from '../src/scenes/cabin/buildCabinLayout.ts'
import { createCabinEditorStore } from '../src/editor/editorStore.ts'
import { CabinEditorRuntime } from '../src/editor/editorRuntime.ts'
import { defaultLayout, parseLayout, serializeLayout, resolveDefinitions } from '../src/editor/layoutModel.ts'
import { expandBatchInstances } from '../src/editor/instanceCopies.ts'
import { createPaintedBatchGeometry } from '../src/scenes/cabin/cabinPaintedUv.ts'
import { syncGizmoVisibility } from '../src/editor/gizmoAdapter.ts'

test('window and all five lanterns are editable groups; window moon and bed dots are removed',()=>{
  const m=buildCabinLayout()
  try {
    const ids=new Set(m.objects.map(o=>o.id))
    for(const id of ['window','lamp-library','lamp-study','lamp-hearth','lamp-entry-left','lamp-entry-right'])assert.ok(ids.has(id),id)
    assert.equal(m.objects.find(o=>o.id==='curtains')?.parentId,'window')
    assert.equal(m.batches.filter(b=>b.m.name==='windowMoon').length,0)
    for(const batch of m.batches)if(batch.m.name==='stitch')assert.ok(!batch.ownerIds.includes('bed'))
    for(const batch of m.batches)if(batch.category==='architecture')assert.ok(batch.ownerIds.every(id=>id===null))
  }finally{m.dispose()}
})

test('duplicate a resized furniture group including props/GLB; history, JSON and reset keep complete copies',()=>{
  const m=buildCabinLayout(),store=createCabinEditorStore(),s=()=>store.getState()
  try {
    s().initialize(m.objects);s().setEnabled(true)
    const runtime=new CabinEditorRuntime(m,store)
    s().updateObject('bookshelf',{position:[-2.6,.7,-2.4],rotationY:.8,scale:1.4})
    const before=structuredClone(s().layout),beforeBounds=runtime.selectionBounds('bookshelf',new Box3()).getSize(new Vector3())
    const id=s().duplicateObject('bookshelf')!
    assert.equal(s().selectedId,id)
    const all=resolveDefinitions(m.objects,s().layout),copies=all.filter(o=>s().layout[o.id].copy)
    assert.ok(copies.length>15)
    const skull=copies.find(o=>s().layout[o.id].copy?.sourceId==='library-skull')!
    assert.equal(skull.parentId,id)
    assert.ok(runtime.selectionBounds(id,new Box3()).getSize(new Vector3()).distanceTo(beforeBounds)<1e-9)
    const expected=new Vector3(...s().layout[skull.id].position).applyMatrix4(runtime.get(id).matrix)
    assert.ok(runtime.get(skull.id).position.distanceTo(expected)<1e-10)
    assert.ok(runtime.get(id).position.distanceTo(runtime.get('bookshelf').position)>.1)
    s().updateObject(skull.id,{deleted:true})
    const exported=serializeLayout(s().layout,m.objects)
    assert.equal(JSON.parse(exported).version,3)
    assert.deepEqual(parseLayout(exported,m.objects),s().layout)
    const complete=structuredClone(s().layout)
    s().resetLayout();assert.deepEqual(s().layout,defaultLayout(m.objects))
    // The selected copy disappeared on reset: gizmo checks must stay safe.
    assert.doesNotThrow(()=>syncGizmoVisibility(runtime,{visible:true}))
    s().undo();assert.deepEqual(s().layout,complete)
    s().resetLayout();s().importLayout(exported);assert.deepEqual(s().layout,complete)
    s().updateObject(id,{deleted:true});assert.equal(runtime.get(skull.id).visible,false)
    s().undo();s().updateObject(skull.id,{deleted:false});assert.equal(runtime.get(skull.id).visible,true)
    const second=s().duplicateObject(id)!
    assert.notEqual(second,id)
    assert.equal(s().layout[second].copy?.sourceId,'bookshelf')
    s().undo();assert.ok(!s().layout[second]);s().redo();assert.ok(s().layout[second])
  }finally{m.dispose()}
})

test('instanced copies preserve painted crops, raycast owners and transformed geometry',()=>{
  const m=buildCabinLayout(),store=createCabinEditorStore(),s=()=>store.getState()
  try {
    s().initialize(m.objects)
    const id=s().duplicateObject('window')!,runtime=new CabinEditorRuntime(m,store)
    s().updateObject(id,{position:[-2,2,1],scale:.8,rotationY:.4})
    let count=0
    for(const batch of m.batches){
      const entries=expandBatchInstances(batch,resolveDefinitions(m.objects,s().layout)),g=createPaintedBatchGeometry(batch,entries.map(e=>e.sourceIndex))
      try {
        assert.equal(g.getAttribute('cabinPaintCrop').count,entries.length)
        for(let i=0;i<entries.length;i++){
          const entry=entries[i]
          if(entry.ownerId!==id)continue
          count++
          const original=entries.findIndex(e=>e.sourceIndex===entry.sourceIndex&&e.ownerId==='window')
          for(let j=0;j<4;j++)assert.equal(g.getAttribute('cabinPaintCrop').array[i*4+j],g.getAttribute('cabinPaintCrop').array[original*4+j])
          const originalPoint=new Vector3().setFromMatrixPosition(batch.matrices[entry.sourceIndex])
          assert.ok(originalPoint.applyMatrix4(runtime.get(id).delta).toArray().every(Number.isFinite))
        }
      }finally{g.dispose()}
    }
    assert.ok(count>=5)
  }finally{m.dispose()}
})

test('previous v2 layout imports with new fixtures defaulted, preserving the old curtains world transform',()=>{
  const m=buildCabinLayout(),store=createCabinEditorStore(),s=()=>store.getState()
  try {
    s().initialize(m.objects)
    const old=JSON.parse(readFileSync(new URL('./fixtures/cabin-layout-v2.json',import.meta.url),'utf8'))
    const curtain=old.objects.find((o:any)=>o.id==='curtains');curtain.position=[-4.2,2.4,.6];curtain.rotationY=.37;curtain.scale=.8
    s().importLayout(JSON.stringify(old))
    const runtime=new CabinEditorRuntime(m,store)
    assert.ok(runtime.get('curtains').position.distanceTo(new Vector3(...curtain.position))<1e-10)
    assert.equal(runtime.get('curtains').rotationY,.37)
    assert.equal(runtime.get('curtains').scale,.8)
    assert.equal(runtime.get('window').visible,true)
    assert.equal(runtime.get('lamp-study').visible,true)
    assert.deepEqual(parseLayout(serializeLayout(s().layout,m.objects),m.objects),s().layout)
  }finally{m.dispose()}
})

test('raycasting transformed duplicate instances returns the copy rather than its source',()=>{
  const m=buildCabinLayout(),store=createCabinEditorStore(),s=()=>store.getState()
  try {
    s().initialize(m.objects)
    const id=s().duplicateObject('window')!,runtime=new CabinEditorRuntime(m,store)
    s().updateObject(id,{position:[2,2,1],scale:.8,rotationY:.4})
    const batch=m.batches.find(b=>b.m.name==='window')!,entries=expandBatchInstances(batch,runtime.definitions)
    const geometry=createPaintedBatchGeometry(batch,entries.map(e=>e.sourceIndex)),mesh=new InstancedMesh(geometry,batch.m,entries.length)
    try {
      for(let i=0;i<entries.length;i++){const e=entries[i];mesh.setMatrixAt(i,batch.matrices[e.sourceIndex].clone().premultiply(runtime.get(e.ownerId!).delta))}
      mesh.updateMatrixWorld(true);mesh.computeBoundingSphere()
      const copyIndex=entries.findIndex(e=>e.ownerId===id),center=new Vector3().setFromMatrixPosition(batch.matrices[entries[copyIndex].sourceIndex]).applyMatrix4(runtime.get(id).delta)
      const direction=new Vector3(1,0,0).transformDirection(runtime.get(id).matrix)
      const hits=new Raycaster(center.clone().addScaledVector(direction,.5),direction.clone().negate(),0,1).intersectObject(mesh)
      assert.ok(hits.length>0)
      assert.equal(entries[hits[0].instanceId!].ownerId,id)
    }finally{mesh.dispose();geometry.dispose()}
  }finally{m.dispose()}
})

test('copy import rejects cycles, unknown templates, missing originals and parent forgery atomically',()=>{
  const m=buildCabinLayout(),store=createCabinEditorStore(),s=()=>store.getState()
  try {
    s().initialize(m.objects)
    const id=s().duplicateObject('bed')!,baseline=structuredClone(s().layout),doc=JSON.parse(serializeLayout(baseline,m.objects))
    for(const mutate of [
      (d:any)=>d.objects.find((o:any)=>o.id===id).copy.sourceId='wall',
      (d:any)=>d.objects.find((o:any)=>o.id===id).parentId=id,
      (d:any)=>d.objects.find((o:any)=>o.id===id).copy.parentId=id,
      (d:any)=>d.objects.splice(0,1),
      (d:any)=>d.objects.find((o:any)=>o.id===id).copy.sourceId='__proto__',
    ]){
      const bad=structuredClone(doc);mutate(bad)
      assert.throws(()=>s().importLayout(JSON.stringify(bad)))
      assert.deepEqual(s().layout,baseline)
    }
    s().updateObject(id,{deleted:true});assert.throws(()=>s().duplicateObject(id))
  }finally{m.dispose()}
})

test('duplicating at the position limit still exports a valid reproducible layout',()=>{
  const m=buildCabinLayout(),store=createCabinEditorStore(),s=()=>store.getState()
  try {
    s().initialize(m.objects);s().updateObject('bed',{position:[10000,0,10000]})
    const id=s().duplicateObject('bed')!
    assert.ok(s().layout[id].position.every(n=>Math.abs(n)<=10000))
    assert.deepEqual(parseLayout(serializeLayout(s().layout,m.objects),m.objects),s().layout)
  }finally{m.dispose()}
})
