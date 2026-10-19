import test from 'node:test'
import assert from 'node:assert/strict'
import { Box3, Object3D, Vector3 } from 'three'
import { createCabinEditorStore } from '../src/editor/editorStore.ts'
import { CabinEditorRuntime } from '../src/editor/editorRuntime.ts'
import { buildCabinLayout } from '../src/scenes/cabin/buildCabinLayout.ts'
import { parseLayout, serializeLayout } from '../src/editor/layoutModel.ts'
import { applyGizmoTransform } from '../src/editor/gizmoAdapter.ts'

test('height and proportional size affect geometry, child props and selection bounds', () => {
  const model=buildCabinLayout(), store=createCabinEditorStore()
  try {
    store.getState().initialize(model.objects)
    const runtime=new CabinEditorRuntime(model,store), before=runtime.selectionBounds('study-desk',new Box3()).getSize(new Vector3())
    store.getState().updateObject('study-desk',{position:[.7,.6,-3.05],scale:2})
    assert.equal(runtime.get('study-desk').position.y,.6)
    assert.equal(runtime.get('study-desk').scale,2)
    const child=model.objects.find(o=>o.id.startsWith('study-desk/bottle-'))!
    const expected=new Vector3(...store.getState().layout[child.id].position).applyMatrix4(runtime.get('study-desk').matrix)
    assert.ok(runtime.get(child.id).position.distanceTo(expected)<1e-10)
    assert.equal(runtime.get(child.id).scale,2)
    const after=runtime.selectionBounds('study-desk',new Box3()).getSize(new Vector3())
    assert.ok(after.distanceTo(before.multiplyScalar(2))<1e-10)
    store.getState().undo();assert.equal(runtime.get('study-desk').scale,1)
    store.getState().redo();assert.equal(runtime.get('study-desk').scale,2)
  } finally {model.dispose()}
})

test('new JSON retains height and scale; existing v1 layouts import at original size', () => {
  const model=buildCabinLayout(), store=createCabinEditorStore()
  try {
    const s=()=>store.getState();s().initialize(model.objects)
    s().updateObject('bed',{position:[-3.7,.25,-1.08],scale:.73})
    const exported=serializeLayout(s().layout,model.objects)
    assert.equal(JSON.parse(exported).version,3)
    assert.deepEqual(parseLayout(exported,model.objects),s().layout)
    const legacy=JSON.parse(exported);legacy.version=1
    for(const o of legacy.objects)delete o.scale
    const imported=parseLayout(JSON.stringify(legacy),model.objects)
    assert.equal(imported.bed.scale,1)
    assert.equal(imported.bed.position[1],.25)
  } finally {model.dispose()}
})

test('invalid sizes are rejected without changing layout or history', () => {
  const model=buildCabinLayout(), store=createCabinEditorStore()
  try {
    const s=()=>store.getState();s().initialize(model.objects)
    const before=structuredClone(s().layout)
    for(const scale of [0,-1,Infinity,NaN,.001,11])assert.throws(()=>s().updateObject('bed',{scale}))
    const doc=JSON.parse(serializeLayout(s().layout,model.objects))
    for(const scale of [0,-1,'big',null,11]) {
      const bad=structuredClone(doc);bad.objects[0].scale=scale
      assert.throws(()=>s().importLayout(JSON.stringify(bad)))
    }
    assert.deepEqual(s().layout,before);assert.equal(s().undoStack.length,0)
  } finally {model.dispose()}
})

test('size gizmo uses the active axis uniformly and accounts for a resized parent', () => {
  const model=buildCabinLayout(),store=createCabinEditorStore(),proxy=new Object3D()
  try {
    const s=()=>store.getState();s().initialize(model.objects)
    const runtime=new CabinEditorRuntime(model,store)
    s().updateObject('study-desk',{scale:2})
    const child=model.objects.find(o=>o.id.startsWith('study-desk/bottle-'))!
    s().setMode('scale');s().beginGesture(child.id)
    proxy.scale.set(2,3,2)
    applyGizmoTransform(runtime,proxy,'Y')
    s().commitGesture()
    assert.equal(s().layout[child.id].scale,1.5)
    assert.equal(runtime.get(child.id).scale,3)
    s().undo();assert.equal(runtime.get(child.id).scale,2)
    s().redo();assert.equal(runtime.get(child.id).scale,3)
  } finally {model.dispose()}
})

test('height gizmo preserves size and the other coordinates through a full gesture', () => {
  const model=buildCabinLayout(),store=createCabinEditorStore(),proxy=new Object3D()
  try {
    const s=()=>store.getState();s().initialize(model.objects)
    const runtime=new CabinEditorRuntime(model,store)
    s().updateObject('bed',{scale:1.3})
    s().setMode('height');s().beginGesture('bed')
    proxy.position.copy(runtime.get('bed').position);proxy.position.y+=.8
    proxy.rotation.set(0,runtime.get('bed').rotationY,0)
    applyGizmoTransform(runtime,proxy,'Y');s().commitGesture()
    assert.equal(s().layout.bed.position[1],.8)
    assert.equal(s().layout.bed.scale,1.3)
    assert.equal(s().layout.bed.position[0],-3.7)
    assert.equal(s().layout.bed.position[2],-1.08)
  } finally {model.dispose()}
})
