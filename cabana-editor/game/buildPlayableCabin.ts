import * as THREE from 'three'
import { buildCabinLayout } from '../src/scenes/cabin/buildCabinLayout.ts'
import { replaceCabinAssets } from '../src/scenes/cabin/cabinAssetReplacements.ts'
import { prepareCabinMaterials } from '../src/scenes/cabin/cabinMaterials.ts'
import { prepareReferenceRug } from '../src/scenes/cabin/cabinReferenceRug.ts'
import { createPaintedBatchGeometry } from '../src/scenes/cabin/cabinPaintedUv.ts'
import { CabinEditorRuntime } from '../src/editor/editorRuntime.ts'
import { expandBatchInstances } from '../src/editor/instanceCopies.ts'
import { parseLayout } from '../src/editor/layoutModel.ts'
import { fitIsometricCamera } from '../src/systems/camera.ts'
import { createLabEnvironment } from '../src/assets/labEnvironment.ts'
import type { PaintedCabinAtlases } from '../src/scenes/cabin/cabinSurfaceLibrary.ts'

/** Approved scene data only. No React, editor UI, event handlers or render loop. */
export function buildPlayableCabin(assets:THREE.Group, skull:THREE.Group, textures:PaintedCabinAtlases, layoutText:string) {
  const model=replaceCabinAssets(buildCabinLayout(),assets)
  const clock=prepareCabinMaterials(model.materials,textures)
  prepareReferenceRug(model.materials)
  const layout=parseLayout(layoutText,model.objects)
  const frozenStore={getState:()=>({getRevision:()=>0,getLiveLayout:()=>layout})}
  const runtime=new CabinEditorRuntime(model,frozenStore as unknown as ConstructorParameters<typeof CabinEditorRuntime>[1])
  const scene=new THREE.Scene();scene.name='cabin-interior-approved-v14';scene.background=new THREE.Color('#10192b')
  const environment=createLabEnvironment();scene.environment=environment;scene.environmentIntensity=.15
  const camera=new THREE.OrthographicCamera(-8,8,5,-5,.1,80)
  const collidable=new Map<string,THREE.Box3>(),matrix=new THREE.Matrix4(),geometries:THREE.BufferGeometry[]=[]
  const definitions=new Map(runtime.definitions.map(o=>[o.id,o]))
  for(const batch of model.batches) {
    const entries=expandBatchInstances(batch,runtime.definitions).filter(e=>!e.ownerId||runtime.get(e.ownerId).visible)
    if(!entries.length)continue
    const geometry=createPaintedBatchGeometry(batch,entries.map(e=>e.sourceIndex));geometries.push(geometry)
    const mesh=new THREE.InstancedMesh(geometry,batch.m,entries.length)
    mesh.name=`cabin-${batch.category}-${batch.m.name}`;mesh.userData.ownerIds=entries.map(e=>e.ownerId);mesh.castShadow=batch.shadow;mesh.receiveShadow=true
    batch.g.computeBoundingBox()
    entries.forEach((entry,i)=>{
      matrix.copy(batch.matrices[entry.sourceIndex])
      if(entry.ownerId)matrix.premultiply(runtime.get(entry.ownerId).delta)
      mesh.setMatrixAt(i,matrix)
      if(entry.ownerId){
        // Children can be placed far from their parent (e.g. copied candles).
        // Keep collision bounds per object; never bridge empty space between them.
        const root=entry.ownerId
        if(!collidable.has(root))collidable.set(root,new THREE.Box3())
        collidable.get(root)!.union(batch.g.boundingBox!.clone().applyMatrix4(matrix))
      }
    })
    mesh.computeBoundingBox();mesh.computeBoundingSphere();scene.add(mesh)
  }
  for(const o of runtime.definitions.filter(o=>(o.sourceId??o.id)==='library-skull'&&runtime.get(o.id).visible)){
    const root=skull.clone(true);root.getObjectByName('Cube')?.removeFromParent()
    root.traverse(n=>{if((n as THREE.Mesh).isMesh){(n as THREE.Mesh).castShadow=true;(n as THREE.Mesh).receiveShadow=true}})
    const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3()),scale=.29/Math.max(size.x,size.y,size.z)
    const normalize=new THREE.Group();normalize.scale.setScalar(scale);normalize.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);normalize.add(root)
    const base=new THREE.Group();base.position.set(-2.12,1.30,-3.38);base.rotation.y=.12;base.add(normalize)
    const owner=new THREE.Group();owner.matrixAutoUpdate=false;owner.matrix.copy(runtime.get(o.id).delta);owner.add(base);scene.add(owner)
  }
  scene.add(new THREE.HemisphereLight('#a3b2d0','#3a2634',.30))
  const key=new THREE.SpotLight('#ffd0a0',38,16,.90,.82,2);key.position.set(-2.6,5.4,4.1);key.target.position.set(-.9,0,1.1)
  key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.near=.5;key.shadow.camera.far=18;key.shadow.normalBias=.035;key.shadow.bias=-.00015;scene.add(key,key.target)
  const hearth=new THREE.PointLight('#ff9d51',18,4.3,2);hearth.position.set(4.05,.8,-2.31);scene.add(hearth)
  const addPoint=(id:string,p:readonly number[],color:string,power:number,distance:number)=>{
    const world=runtime.get(id);if(!world.visible)return
    const light=new THREE.PointLight(color,power,distance*world.scale,2);light.position.fromArray(p).applyMatrix4(world.delta);scene.add(light)
  }
  const maskData=new Uint8Array(64*64*4)
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const edge=Math.min(x,y,63-x,63-y),bar=Math.abs(x-31.5)<2||Math.abs(y-31.5)<2
    const value=bar?16:Math.min(255,Math.max(0,edge-4)*45)
    maskData.set([value,value,value,255],(y*64+x)*4)
  }
  const windowMask=new THREE.DataTexture(maskData,64,64,THREE.RGBAFormat,THREE.UnsignedByteType);windowMask.needsUpdate=true
  const points=new Map(model.candleLights.map(c=>[c.id,c]));
  for(const o of runtime.definitions){
    const source=o.sourceId??o.id,c=points.get(source)
    if(c)addPoint(o.id,c.position,'#ffc27b',c.power,c.distance)
    if(source==='cauldron')addPoint(o.id,[4.08,1.92,-2.81],'#b78ce5',1.5,2.2)
    if(source==='window'&&runtime.get(o.id).visible){
      const world=runtime.get(o.id),light=new THREE.SpotLight('#829dff',18.2,10*world.scale,.61,.45,2)
      light.map=windowMask;light.position.set(-4.68,2.18,-1.46).applyMatrix4(world.delta);light.target.position.set(-.65,.05,.1).applyMatrix4(world.delta)
      scene.add(light,light.target)
    }
  }
  const obstacles:{kind:'box';name:string;position:[number,number,number];size:[number,number,number]}[]=[]
  for(const [id,bounds]of collidable){
    const source=definitions.get(id)?.sourceId??id,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3())
    // Painted floor textiles and wall/ceiling decorations do not block walking.
    if(/rug|window|curtain|banner/.test(source)||bounds.min.y>1.35||bounds.max.y<.12||size.x<.22||size.z<.22)continue
    obstacles.push({kind:'box',name:id,position:center.toArray() as [number,number,number],size:size.toArray() as [number,number,number]})
  }
  const spawn=new THREE.Vector3(0,.038,3.15),exit=new THREE.Vector3(0,.038,3.50)
  const pointsOfInterest={study:{id:'veil-study',x:0,z:-2.10},meditation:{id:'levitation-training',x:1.44,z:.02},rest:{id:'witch-rest',x:-3.5,z:-1.5},storage:{id:'witch-storage',x:4.12,z:2.86}}
  scene.updateMatrixWorld(true)
  return {scene,camera,spawn,exit,points:pointsOfInterest,obstacles,
    setSize(w:number,h:number){fitIsometricCamera(camera,w,h)},
    update(dt:number){clock.boil.value+=Math.min(Math.max(dt,0),.1)},
    metrics(){return {...model.metrics,objects:Object.keys(layout).length,layoutVersion:3,artVersion:14,editorUI:false}},
    dispose(){clock.dispose();model.dispose();for(const g of geometries)g.dispose();environment.dispose();windowMask.dispose()},
  }
}
