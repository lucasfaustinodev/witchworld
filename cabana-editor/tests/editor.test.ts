import test from 'node:test'
import assert from 'node:assert/strict'
import { Matrix4, Vector3 } from 'three'
import { buildCabinLayout } from '../src/scenes/cabin/buildCabinLayout.ts'
import { createCabinEditorStore } from '../src/editor/editorStore.ts'
import { parseLayout, serializeLayout } from '../src/editor/layoutModel.ts'
import { CabinEditorRuntime } from '../src/editor/editorRuntime.ts'

test('every loose instance has a stable semantic owner; architecture has none', () => {
  const a = buildCabinLayout(), b = buildCabinLayout()
  try {
    assert.deepEqual(a.objects, b.objects)
    assert.equal(new Set(a.objects.map(o => o.id)).size, a.objects.length)
    assert.ok(a.objects.length > 70, 'small props must be represented, not only large zones')
    const ids = new Set(a.objects.map(o => o.id))
    for (const batch of a.batches) {
      assert.equal(batch.ownerIds.length, batch.matrices.length)
      for (const owner of batch.ownerIds) {
        if (batch.category === 'architecture') assert.equal(owner, null)
        else assert.ok(owner && ids.has(owner), 'editable furniture cannot have unowned fragments')
      }
    }
    for (const id of ['bed', 'bed-rug', 'bookshelf', 'library-skull', 'study-desk', 'study-chair', 'banner-left', 'banner-right', 'cauldron', 'central-rug', 'storage', 'chest', 'reading-chair']) assert.ok(ids.has(id), id)
    assert.equal(a.objects.find(o => o.id === 'library-skull')?.parentId, 'bookshelf')
    assert.ok(a.objects.some(o => o.id.startsWith('study-desk/bottle-')))
    assert.ok(a.objects.some(o => o.id.startsWith('bookshelf/book-')))
  } finally { a.dispose(); b.dispose() }
})

test('drag previews produce one undo step; undo, redo and a new branch restore exact data', () => {
  const model = buildCabinLayout(), store = createCabinEditorStore()
  try {
    store.getState().initialize(model.objects)
    const original = structuredClone(store.getState().layout)
    store.getState().beginGesture('bed')
    for (let i=0;i<40;i++) store.getState().previewTransform('bed', {position:[i/10, .04, -1.08], rotationY:.3})
    assert.equal(store.getState().undoStack.length, 0)
    assert.deepEqual(store.getState().layout, original, 'transient frames must not mutate history')
    store.getState().commitGesture()
    assert.equal(store.getState().undoStack.length, 1)
    const moved = structuredClone(store.getState().layout)
    store.getState().undo(); assert.deepEqual(store.getState().layout, original)
    store.getState().redo(); assert.deepEqual(store.getState().layout, moved)
    store.getState().undo()
    store.getState().updateObject('bed', {visible:false})
    assert.equal(store.getState().redoStack.length, 0)
  } finally { model.dispose() }
})

test('JSON round trip includes every transform, hidden object and reversible deletion', () => {
  const model = buildCabinLayout(), store = createCabinEditorStore()
  try {
    const s = () => store.getState()
    s().initialize(model.objects)
    s().updateObject('study-desk', {position:[.123456789, .17, 2.32456789], rotationY:7.123456789})
    s().updateObject('bed', {visible:false})
    s().updateObject('chest', {deleted:true})
    const text = serializeLayout(s().layout, model.objects)
    const parsed = parseLayout(text, model.objects)
    assert.deepEqual(parsed, s().layout)
    s().resetLayout(); const reset = structuredClone(s().layout)
    s().importLayout(text); assert.deepEqual(s().layout, parsed)
    s().undo(); assert.deepEqual(s().layout, reset)
    s().redo(); assert.deepEqual(s().layout, parsed)
    s().updateObject('chest', {deleted:false})
    assert.equal(s().layout.chest.deleted, false)
  } finally { model.dispose() }
})

test('invalid imports are rejected atomically, including unknown IDs and forged parents', () => {
  const model = buildCabinLayout(), store = createCabinEditorStore()
  try {
    const s = () => store.getState()
    s().initialize(model.objects)
    const baseline = structuredClone(s().layout)
    const doc = JSON.parse(serializeLayout(baseline, model.objects))
    const mutations = [
      (d:any) => d.objects[0].id='wall',
      (d:any) => d.objects[0].parentId='bed',
      (d:any) => d.objects.splice(0,1),
      (d:any) => d.objects[0].position=[null,0,0],
      (d:any) => d.objects[0].rotationY='bad',
      (d:any) => d.objects[0].deleted='yes',
      (d:any) => d.objects.push(d.objects[0]),
      (d:any) => d.version=99,
    ]
    for (const mutate of mutations) {
      const bad=structuredClone(doc); mutate(bad)
      assert.throws(()=>s().importLayout(JSON.stringify(bad)))
      assert.deepEqual(s().layout, baseline)
      assert.equal(s().undoStack.length, 0)
    }
    assert.throws(()=>s().importLayout('{'))
    assert.throws(()=>s().updateObject('wall',{position:[1,2,3]}))
    assert.throws(()=>s().updateObject('bed',{position:[Infinity,0,0]}))
  } finally { model.dispose() }
})

test('children follow the furniture, move in parent coordinates, and inherit deletion', () => {
  const model=buildCabinLayout(), store=createCabinEditorStore()
  try {
    store.getState().initialize(model.objects)
    const runtime=new CabinEditorRuntime(model,store)
    for (const object of model.objects) {
      const delta=runtime.get(object.id).delta
      assert.ok(delta.elements.every((n,i)=>Math.abs(n-new Matrix4().elements[i])<1e-10))
    }
    const child=model.objects.find(o=>o.id.startsWith('study-desk/bottle-'))!
    const before=runtime.get(child.id).position.clone()
    store.getState().updateObject('study-desk',{position:[1.7,.2,-2.05],rotationY:Math.PI/2})
    const parent=runtime.get('study-desk'), after=runtime.get(child.id)
    const expected=new Vector3(...store.getState().layout[child.id].position).applyMatrix4(parent.matrix)
    assert.ok(after.position.distanceTo(expected)<1e-10)
    assert.ok(after.position.distanceTo(before)>.1)
    const local=runtime.toLocal(child.id,after.position,after.rotationY)
    assert.ok(new Vector3(...local.position).distanceTo(new Vector3(...store.getState().layout[child.id].position))<1e-10)
    store.getState().updateObject('study-desk',{deleted:true})
    assert.equal(runtime.get(child.id).visible,false)
    store.getState().undo(); assert.equal(runtime.get(child.id).visible,true)
  } finally { model.dispose() }
})

test('cancelled gestures and unchanged clicks do not create history', () => {
  const model=buildCabinLayout(), store=createCabinEditorStore()
  try {
    const s=()=>store.getState(); s().initialize(model.objects)
    const original=structuredClone(s().layout)
    s().beginGesture('bed'); s().commitGesture()
    assert.equal(s().undoStack.length,0)
    s().beginGesture('bed'); s().previewTransform('bed',{position:[2,0,2]}); s().cancelGesture()
    assert.deepEqual(s().getLiveLayout(),original)
    assert.equal(s().undoStack.length,0)
  } finally { model.dispose() }
})
