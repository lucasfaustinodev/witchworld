import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { PointLight, SpotLight, Texture } from 'three'
import type { CabinEditorRuntime } from '../../editor/editorRuntime.ts'
import { useCabinEditor } from '../../editor/editorStore.ts'
import { useLabStore } from '../../stores/labStore.ts'
import type { CandleLightSource } from './cabinFixtures.ts'

interface PointSpec {position:readonly [number,number,number];color:string;power:number;distance:number;speed:number;phase:number;amount:number;warm:boolean}
const cauldron:PointSpec={position:[4.08,1.92,-2.81],color:'#b78ce5',power:1.5,distance:2.2,speed:.8,phase:.4,amount:.035,warm:false}

function OwnedPoint({editor,id,spec}:{editor?:CabinEditorRuntime;id:string;spec:PointSpec}) {
  const light=useRef<PointLight>(null),time=useRef(0)
  const position=useMemo(()=>new Vector3(...spec.position),[spec])
  useFrame((_,delta)=>{
    const ref=light.current;if(!ref)return
    if(editor&&!editor.store.getState().getLiveLayout()[id]){ref.intensity=0;return}
    const state=useLabStore.getState(),world=editor?.get(id)
    if(state.animate)time.current+=Math.min(delta,.1)
    ref.position.copy(position);if(world)ref.position.applyMatrix4(world.delta)
    ref.intensity=world&&!world.visible?0:spec.power*(spec.warm?state.warm/15:1)*(1+spec.amount*Math.sin(time.current*spec.speed+spec.phase))
    ref.distance=spec.distance*(world?.scale??1)
  })
  return <pointLight ref={light} position={[...spec.position]} color={spec.color} intensity={spec.power} distance={spec.distance} decay={2} />
}

function OwnedWindow({editor,id,map}:{editor?:CabinEditorRuntime;id:string;map:Texture}) {
  const light=useRef<SpotLight>(null)
  const position=useMemo(()=>new Vector3(-4.68,2.18,-1.46),[]),target=useMemo(()=>new Vector3(-.65,.05,.1),[])
  useFrame(()=>{
    const ref=light.current;if(!ref)return
    if(editor&&!editor.store.getState().getLiveLayout()[id]){ref.intensity=0;return}
    const world=editor?.get(id)
    ref.position.copy(position);ref.target.position.copy(target)
    if(world){ref.position.applyMatrix4(world.delta);ref.target.position.applyMatrix4(world.delta)}
    ref.target.updateMatrixWorld()
    ref.intensity=world&&!world.visible?0:useLabStore.getState().moon*7
    ref.distance=10*(world?.scale??1)
  })
  return <spotLight ref={light} position={position} color="#829dff" intensity={0} distance={10} angle={.61} penumbra={.45} decay={2} map={map} />
}

/** Every original candle/fixture has real local illumination. Multiple candles in
 * one imported fixture share an emitter. No additional shadow maps are allocated.
 * Limit extra emitters to 12 to keep an imported composition from exhausting shader limits.
 * Every copy retains its emissive flame even beyond that lighting budget. */
export function EditableFixtureLights({editor,map,candleLights=[]}:{editor?:CabinEditorRuntime;map:Texture;candleLights?:readonly CandleLightSource[]}) {
  const layout=useCabinEditor(s=>s.layout)
  const points=useMemo(()=>Object.fromEntries([['cauldron',cauldron],...candleLights.map((c,i)=>[c.id,{...c,color:'#ffc27b',speed:1.15,phase:i*1.7,amount:.025,warm:true}])]) as Record<string,PointSpec>,[candleLights])
  const copies=Object.entries(layout).filter(([,o])=>o.copy&&o.visible&&!o.deleted&&(o.copy.sourceId==='window'||Object.hasOwn(points,o.copy.sourceId))).slice(0,12)
  return <>
    <OwnedWindow editor={editor} id="window" map={map} />
    {Object.entries(points).map(([id,spec])=><OwnedPoint key={id} editor={editor} id={id} spec={spec} />)}
    {editor&&copies.map(([id,o])=>o.copy!.sourceId==='window'?<OwnedWindow key={id} editor={editor} id={id} map={map} />:<OwnedPoint key={id} editor={editor} id={id} spec={points[o.copy!.sourceId]} />)}
  </>
}
