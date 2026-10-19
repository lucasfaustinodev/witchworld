import { Box3, Matrix4, Quaternion, Vector3 } from 'three'
import type { StoreApi } from 'zustand/vanilla'
import type { CabinEditorState } from './editorStore.ts'
import type { CabinObjectDefinition, Position } from './layoutModel.ts'
import { resolveDefinitions } from './layoutModel.ts'
import type { CabinBatch } from '../scenes/cabin/buildCabinLayout.ts'

interface WorldObject {matrix:Matrix4;delta:Matrix4;position:Vector3;rotationY:number;scale:number;visible:boolean}
const up=new Vector3(0,1,0), unit=new Vector3(1,1,1)
export class CabinEditorRuntime {
  store:StoreApi<CabinEditorState>
  private originals:readonly CabinObjectDefinition[]
  private resolved:readonly CabinObjectDefinition[]=[]
  private catalog:Map<string,CabinObjectDefinition>
  private defaults=new Map<string,Matrix4>()
  private worlds=new Map<string,WorldObject>()
  private bounds=new Map<string,Box3>()
  private revision=-1
  constructor(model:{objects:CabinObjectDefinition[];batches:CabinBatch[]},store:StoreApi<CabinEditorState>) {
    this.store=store;this.originals=model.objects;this.catalog=new Map(model.objects.map(o=>[o.id,o]))
    const initial=(id:string):Matrix4=>{
      if(this.defaults.has(id))return this.defaults.get(id)!
      const o=this.catalog.get(id)!, m=new Matrix4().compose(new Vector3(...o.position),new Quaternion().setFromAxisAngle(up,o.rotationY),unit)
      if(o.parentId)m.premultiply(initial(o.parentId))
      this.defaults.set(id,m);return m
    }
    for(const o of model.objects)initial(o.id)
    for(const batch of model.batches) {
      batch.g.computeBoundingBox()
      batch.ownerIds.forEach((id,i)=>{
        if(!id)return
        if(!this.bounds.has(id))this.bounds.set(id,new Box3())
        this.bounds.get(id)!.union(batch.g.boundingBox!.clone().applyMatrix4(batch.matrices[i]))
      })
    }
    // The existing GLB is loaded separately from the instanced scene.
    const skull=this.defaults.get('library-skull')
    if(skull)this.bounds.set('library-skull',new Box3(new Vector3(-.16,0,-.16),new Vector3(.16,.30,.16)).applyMatrix4(skull))
  }
  private refresh() {
    const state=this.store.getState(), stamp=state.getRevision()
    if(stamp===this.revision)return
    this.revision=stamp;this.worlds.clear()
    const layout=state.getLiveLayout()
    this.resolved=resolveDefinitions(this.originals,layout)
    this.catalog=new Map(this.resolved.map(o=>[o.id,o]))
    const build=(id:string):WorldObject=>{
      if(this.worlds.has(id))return this.worlds.get(id)!
      const definition=this.catalog.get(id)!, value=layout[id], parent=definition.parentId?build(definition.parentId):null
      const matrix=new Matrix4().compose(new Vector3(...value.position),new Quaternion().setFromAxisAngle(up,value.rotationY),new Vector3().setScalar(value.scale))
      if(parent)matrix.premultiply(parent.matrix)
      const result={matrix,delta:matrix.clone().multiply(this.defaults.get(definition.sourceId??id)!.clone().invert()),position:new Vector3().setFromMatrixPosition(matrix),rotationY:value.rotationY+(parent?.rotationY??0),scale:value.scale*(parent?.scale??1),visible:value.visible&&!value.deleted&&(parent?.visible??true)}
      this.worlds.set(id,result);return result
    }
    for(const o of this.resolved)build(o.id)
  }
  get definitions(){this.refresh();return this.resolved}
  get(id:string):WorldObject {this.refresh();const result=this.worlds.get(id);if(!result)throw new Error('Objeto desconhecido.');return result}
  localScale(id:string,worldScale:number) {
    this.refresh()
    const parentId=this.catalog.get(id)!.parentId
    return worldScale/(parentId?this.get(parentId).scale:1)
  }
  toLocal(id:string,position:Vector3,rotationY:number):{position:Position;rotationY:number} {
    this.refresh()
    const parentId=this.catalog.get(id)!.parentId, parent=parentId?this.get(parentId):null
    const local=position.clone()
    if(parent)local.applyMatrix4(parent.matrix.clone().invert())
    return {position:local.toArray() as Position,rotationY:rotationY-(parent?.rotationY??0)}
  }
  isDescendant(id:string,parentId:string):boolean {
    this.refresh()
    let current:string|null=id
    while(current){if(current===parentId)return true;current=this.catalog.get(current)?.parentId??null}
    return false
  }
  selectionBounds(id:string,target:Box3) {
    target.makeEmpty()
    for(const o of this.definitions){const bounds=this.bounds.get(o.sourceId??o.id);if(bounds&&this.isDescendant(o.id,id)&&this.get(o.id).visible)target.union(bounds.clone().applyMatrix4(this.get(o.id).delta))}
    return target
  }
}
