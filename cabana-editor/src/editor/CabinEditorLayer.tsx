import { useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import { Box3, Box3Helper, Object3D, Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { TransformControls as TransformControlsImpl } from 'three-stdlib'
import { useCabinEditor } from './editorStore.ts'
import type { CabinEditorRuntime } from './editorRuntime.ts'
import { applyGizmoTransform, syncGizmoVisibility } from './gizmoAdapter.ts'

interface FloorDrag {id:string;pointerId:number;start:Vector3;origin:Vector3;rotationY:number}
export function CabinEditorLayer({editor,children}:{editor:CabinEditorRuntime;children:ReactNode}) {
  const {camera,gl}=useThree(), controls=useRef<TransformControlsImpl>(null), direct=useRef<FloorDrag|null>(null)
  const enabled=useCabinEditor(s=>s.enabled), selectedId=useCabinEditor(s=>s.selectedId)
  const mode=useCabinEditor(s=>s.mode), layout=useCabinEditor(s=>s.layout)
  const dragging=useCabinEditor(s=>s.dragging)
  const proxy=useMemo(()=>new Object3D(),[])
  const box=useMemo(()=>{
    const helper=new Box3Helper(new Box3(),0xd2ae7f)
    for(const material of Array.isArray(helper.material)?helper.material:[helper.material]){material.depthTest=false;material.depthWrite=false;material.toneMapped=false}
    helper.renderOrder=1000
    return helper
  },[])
  const plane=useMemo(()=>new Plane(new Vector3(0,1,0),0),[])
  const canTransform=enabled&&selectedId!==null&&!!layout[selectedId]&&editor.get(selectedId).visible
  useEffect(()=>{
    const control=controls.current
    control?.connect(gl.domElement)
    return ()=>{control?.dispose();box.geometry.dispose();for(const m of Array.isArray(box.material)?box.material:[box.material])m.dispose()}
  },[box,gl])
  useEffect(()=>{
    const raycaster=new Raycaster(),pointer=new Vector2(),hit=new Vector3()
    const release=()=>{const pointerId=direct.current?.pointerId;direct.current=null;if(pointerId!==undefined&&gl.domElement.hasPointerCapture(pointerId))gl.domElement.releasePointerCapture(pointerId)}
    const cancel=()=>{
      release();editor.store.getState().cancelGesture()
      // three-stdlib exposes these runtime fields through Drei's props/events,
      // although its declaration file marks them private.
      const control=controls.current as unknown as {dragging:boolean;axis:string|null}|null
      if(control){control.dragging=false;control.axis=null}
    }
    const move=(event:PointerEvent)=>{
      const drag=direct.current
      if(!drag||event.pointerId!==drag.pointerId)return
      event.preventDefault()
      const rect=gl.domElement.getBoundingClientRect()
      pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1)
      raycaster.setFromCamera(pointer,camera)
      if(!raycaster.ray.intersectPlane(plane,hit))return
      const world=drag.origin.clone().add(hit.clone().sub(drag.start));world.y=drag.origin.y
      editor.store.getState().previewTransform(drag.id,editor.toLocal(drag.id,world,drag.rotationY))
    }
    const up=(event:PointerEvent)=>{if(direct.current?.pointerId===event.pointerId){release();editor.store.getState().commitGesture()}}
    const lost=()=>{if(direct.current)cancel()}
    const keyboard=(event:KeyboardEvent)=>{
      const s=editor.store.getState(),target=event.target
      if(!s.enabled||target instanceof HTMLElement&&(target.isContentEditable||target.closest('input,textarea,select')))return
      const key=event.key.toLowerCase()
      if(key==='escape'){event.preventDefault();if(s.dragging)cancel();else s.select(null);return}
      if(s.dragging)return
      if((event.ctrlKey||event.metaKey)&&key==='z'){event.preventDefault();if(event.shiftKey)s.redo();else s.undo()}
      else if((event.ctrlKey||event.metaKey)&&key==='y'){event.preventDefault();s.redo()}
      else if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&key==='w')s.setMode('translate')
      else if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&key==='h')s.setMode('height')
      else if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&key==='r')s.setMode('rotate')
      else if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&key==='s')s.setMode('scale')
      else if((key==='delete'||key==='backspace')&&s.selectedId){event.preventDefault();s.updateObject(s.selectedId,{deleted:true})}
    }
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up)
    window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('keydown',keyboard)
    gl.domElement.addEventListener('lostpointercapture',lost)
    return ()=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)
      window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',keyboard)
      gl.domElement.removeEventListener('lostpointercapture',lost)
      if(editor.store.getState().dragging)cancel()
    }
  },[camera,gl,editor,plane])
  useFrame(()=>{
    const s=editor.store.getState(), id=s.selectedId
    box.visible=syncGizmoVisibility(editor,controls.current)
    if(!id||!s.enabled)return
    const world=editor.get(id)
    proxy.position.copy(world.position);proxy.rotation.set(0,world.rotationY,0);proxy.scale.setScalar(world.scale);proxy.updateMatrixWorld(true)
    if(box.visible){editor.selectionBounds(id,box.box);box.visible=!box.box.isEmpty()}
  },-10)
  function pointerDown(event:ThreeEvent<PointerEvent>) {
    const s=editor.store.getState()
    if(!s.enabled||s.dragging||event.button!==0||(controls.current as unknown as {dragging:boolean}|null)?.dragging)return
    let id:string|null=null,object:Object3D|null=event.object
    if(typeof event.instanceId==='number')id=(event.object.userData.ownerIds as (string|null)[]|undefined)?.[event.instanceId]??null
    while(!id&&object){id=object.userData.editorOwner??null;object=object.parent}
    if(!id){s.select(null);return}
    if(event.shiftKey){let parent=editor.definitions.find(o=>o.id===id)?.parentId;while(parent){id=parent;parent=editor.definitions.find(o=>o.id===id)?.parentId}}
    if(!editor.get(id).visible)return
    event.stopPropagation();s.select(id)
    if(s.mode!=='translate')return
    const start=event.ray.intersectPlane(plane,new Vector3())
    if(!start)return
    const world=editor.get(id)
    direct.current={id,pointerId:event.pointerId,start,origin:world.position.clone(),rotationY:world.rotationY}
    s.beginGesture(id)
    gl.domElement.setPointerCapture(event.pointerId)
  }
  return <>
    <group onPointerDown={pointerDown}>{children}</group>
    <primitive object={box} visible={false} />
    <primitive object={proxy} />
    <TransformControls ref={controls} object={proxy} domElement={gl.domElement} mode={mode==='height'?'translate':mode} space="world" size={.85}
      enabled={!!canTransform&&!(dragging&&direct.current)} showX={mode==='translate'||mode==='scale'} showY={mode!=='translate'} showZ={mode==='translate'||mode==='scale'}
      onMouseDown={()=>{if(selectedId)editor.store.getState().beginGesture(selectedId)}}
      onObjectChange={()=>{
        const s=editor.store.getState()
        if(s.dragging&&s.selectedId&&!direct.current){
          const axis=(controls.current as unknown as {axis:string|null}|null)?.axis??null
          applyGizmoTransform(editor,proxy,axis)
        }
      }}
      onMouseUp={()=>editor.store.getState().commitGesture()} />
  </>
}
