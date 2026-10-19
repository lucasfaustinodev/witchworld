import { Vector3 } from 'three'
import type { Quaternion } from 'three'
import type { Object3D } from 'three'
import type { CabinEditorRuntime } from './editorRuntime.ts'
import { MIN_OBJECT_SCALE, MAX_OBJECT_SCALE } from './layoutModel.ts'

export function syncGizmoVisibility(editor:CabinEditorRuntime,control:{visible:boolean}|null) {
  const s=editor.store.getState()
  const visible=!!(s.enabled&&s.selectedId&&s.layout[s.selectedId]&&editor.get(s.selectedId).visible)
  if(control)control.visible=visible
  return visible
}
/** XYZ Euler yaw folds beyond ±90°. Read the quaternion and unwrap near the live turn. */
export function quaternionYaw(rotation:Quaternion,reference:number) {
  const forward=new Vector3(0,0,1).applyQuaternion(rotation)
  const yaw=Math.atan2(forward.x,forward.z)
  return reference+Math.atan2(Math.sin(yaw-reference),Math.cos(yaw-reference))
}

export function applyGizmoTransform(editor:CabinEditorRuntime,proxy:Object3D,axis:string|null) {
  const s=editor.store.getState(),id=s.selectedId
  if(!s.dragging||!id)return
  if(s.mode==='scale') {
    // All axis handles resize proportionally; no stretched furniture or sheared children.
    const world=axis?.includes('X')?proxy.scale.x:axis?.includes('Y')?proxy.scale.y:axis?.includes('Z')?proxy.scale.z:proxy.scale.x
    const scale=Math.max(MIN_OBJECT_SCALE,Math.min(MAX_OBJECT_SCALE,editor.localScale(id,world)))
    s.previewTransform(id,{scale})
  } else {
    const yaw=quaternionYaw(proxy.quaternion,editor.get(id).rotationY)
    s.previewTransform(id,editor.toLocal(id,proxy.position,yaw))
  }
}
