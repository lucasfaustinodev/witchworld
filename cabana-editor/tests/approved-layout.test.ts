import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildCabinLayout } from '../src/scenes/cabin/buildCabinLayout.ts'
import { createCabinEditorStore } from '../src/editor/editorStore.ts'
import { parseLayout, serializeLayout } from '../src/editor/layoutModel.ts'

test('published baseline preserves all 149 user-exported objects, copies and deletions',async()=>{
  const bytes=await readFile(new URL('../src/scenes/cabin/approved-cabin-layout-v3.json',import.meta.url)),doc=JSON.parse(bytes.toString()),model=buildCabinLayout()
  try{
    const approved=parseLayout(bytes.toString(),model.objects)
    assert.equal(doc.objects.length,149);assert.equal(Object.keys(approved).length,149)
    assert.equal(Object.values(approved).filter(o=>o.deleted).length,11)
    assert.equal(Object.values(approved).filter(o=>o.copy).length,9)
    for(const {id,parentId,...value}of doc.objects){
      assert.deepEqual(approved[id],value,id)
      if(!value.copy)assert.equal(model.objects.find(o=>o.id===id)!.parentId,parentId)
    }
    assert.deepEqual(approved['floor-cauldron'].position,[4.360999226845104,0,3.530333924740119])
    const store=createCabinEditorStore(),s=()=>store.getState();s().initialize(model.objects,approved)
    const saved=structuredClone(s().layout)
    assert.deepEqual(saved,approved)
    s().updateObject('central-rug',{position:[-2,1,1],scale:.7})
    s().updateObject('lamp-library~copy-0001',{deleted:true})
    const changed=structuredClone(s().layout)
    s().resetLayout();assert.deepEqual(s().layout,saved)
    s().undo();assert.deepEqual(s().layout,changed)
    s().redo();assert.deepEqual(s().layout,saved)
    assert.deepEqual(parseLayout(serializeLayout(s().layout,model.objects),model.objects),saved)
    approved['bed'].position[0]=99
    s().resetLayout();assert.deepEqual(s().layout,saved,'initial state is cloned, never shared or mutated')
  }finally{model.dispose()}
})
