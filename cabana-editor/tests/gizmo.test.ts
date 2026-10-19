import test from 'node:test'
import assert from 'node:assert/strict'
import { Object3D, OrthographicCamera, Quaternion, Vector3 } from 'three'
import { TransformControls } from 'three-stdlib'
import { createCabinEditorStore } from '../src/editor/editorStore.ts'
import { CabinEditorRuntime } from '../src/editor/editorRuntime.ts'
import { buildCabinLayout } from '../src/scenes/cabin/buildCabinLayout.ts'
import { syncGizmoVisibility, quaternionYaw } from '../src/editor/gizmoAdapter.ts'

test('real TransformControls root is hidden outside editing and for hidden/deleted parents', () => {
  const model=buildCabinLayout(), store=createCabinEditorStore(), proxy=new Object3D()
  const controls=new TransformControls(new OrthographicCamera(),undefined)
  try {
    store.getState().initialize(model.objects)
    const runtime=new CabinEditorRuntime(model,store)
    controls.attach(proxy)
    syncGizmoVisibility(runtime,controls);assert.equal(controls.visible,false)
    store.getState().setEnabled(true)
    store.getState().select('library-skull')
    syncGizmoVisibility(runtime,controls);assert.equal(controls.visible,true)
    store.getState().updateObject('bookshelf',{deleted:true})
    syncGizmoVisibility(runtime,controls);assert.equal(controls.visible,false)
    store.getState().undo()
    syncGizmoVisibility(runtime,controls);assert.equal(controls.visible,true)
    store.getState().setEnabled(false)
    syncGizmoVisibility(runtime,controls);assert.equal(controls.visible,false)
  } finally {controls.dispose();model.dispose()}
})

test('vertical gizmo rotation does not fold at 90 degrees and retains multiple turns', () => {
  const q=new Quaternion(), up=new Vector3(0,1,0)
  for(const [degrees,reference] of [[120,119],[240,239],[-150,-149],[780,779],[-780,-779]]) {
    q.setFromAxisAngle(up,degrees*Math.PI/180)
    assert.ok(Math.abs(quaternionYaw(q,reference*Math.PI/180)-degrees*Math.PI/180)<1e-10)
  }
})
