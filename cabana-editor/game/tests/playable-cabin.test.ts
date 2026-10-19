import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { buildPlayableCabin } from '../buildPlayableCabin.ts'
import { createGardenNavigation } from '../../../dist/garden-navigation.js'
import { createCabinTravel } from '../../../dist/cabin-travel.js'

async function geometryAsset(path:string){
  const bytes=await readFile(new URL(path,import.meta.url)),jsonSize=bytes.readUInt32LE(12),doc=JSON.parse(bytes.toString('utf8',20,20+jsonSize))
  const bin=bytes.subarray(20+jsonSize+8);doc.buffers[0].uri='data:application/octet-stream;base64,'+bin.toString('base64')
  for(const m of doc.materials??[]){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;delete m.extensions;if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture}}
  delete doc.textures;delete doc.images;delete doc.extensionsUsed;delete doc.extensionsRequired;delete doc.extensions
  if(!globalThis.ProgressEvent)(globalThis as any).ProgressEvent=class extends Event{constructor(type:string,init:object){super(type);Object.assign(this,init)}}
  return (await new GLTFLoader().parseAsync(JSON.stringify(doc),'')).scene
}
const setup=(async()=>{
  const [assets,skull,layout]=await Promise.all([geometryAsset('../../../dist/assets/quaternius/cabin-props.glb'),geometryAsset('../../../dist/assets/ritual-skull.glb'),readFile(new URL('../../src/scenes/cabin/approved-cabin-layout-v3.json',import.meta.url),'utf8')])
  return {assets,skull,layout}
})()
const make=async()=>{const s=await setup;return buildPlayableCabin(s.assets,s.skull,{wood:new THREE.Texture(),surfaces:new THREE.Texture()},s.layout)}

test('playable scene uses all approved objects, copied instances, actual candles and the approved rug without editor UI',async()=>{
 const cabin=await make()
 try{
  assert.equal(cabin.metrics().objects,149);assert.equal(cabin.metrics().editorUI,false)
  let bubbles=0,copyInstances=0,lights=0
  cabin.scene.traverse((o:any)=>{
   if(o.isInstancedMesh){assert.ok(o.count>0);for(const n of o.instanceMatrix.array)assert.ok(Number.isFinite(n));if(o.material.name==='potionBubble')bubbles+=o.count;copyInstances+=o.userData.ownerIds.filter((id:string)=>id?.includes('~copy-')).length}
   if(o.isLight)lights++
  })
  assert.equal(bubbles,12);assert.ok(copyInstances>0);assert.ok(lights>5)
  const rug=cabin.scene.children.find((o:any)=>o.isInstancedMesh&&o.material.name==='roundRug') as THREE.InstancedMesh
  assert.ok(rug);assert.match((rug.material as THREE.Material).customProgramCacheKey(),/center-moon-v8/)
  cabin.update(.05);cabin.setSize(1440,900);assert.ok(Number.isFinite(cabin.camera.projectionMatrix.elements[0]))
 }finally{cabin.dispose()}
})

test('real Rapier floor allows walking and keeps the entry and exit clear in the approved composition',async()=>{
 const cabin=await make(),support=new THREE.Mesh(new THREE.PlaneGeometry(10.4,8.4),new THREE.MeshBasicMaterial());support.rotation.x=-Math.PI/2;support.position.y=.028
 const nav=await createGardenNavigation({surfaces:[support],obstacles:cabin.obstacles,outline:[[-5.1,-4.1],[5.1,-4.1],[5.1,4.1],[-5.1,4.1]],start:cabin.spawn,flatFloor:true})
 try{
  for(const p of[cabin.spawn,cabin.exit])for(const obstacle of cabin.obstacles){const minX=obstacle.position[0]-obstacle.size[0]/2,maxX=obstacle.position[0]+obstacle.size[0]/2,minZ=obstacle.position[2]-obstacle.size[2]/2,maxZ=obstacle.position[2]+obstacle.size[2]/2;assert.ok(Math.hypot(p.x-Math.max(minX,Math.min(p.x,maxX)),p.z-Math.max(minZ,Math.min(p.z,maxZ)))>.31,`door blocked by ${JSON.stringify(obstacle)}`)}
  const position=cabin.spawn.clone(),velocity=new THREE.Vector3(0,0,-1)
  for(let i=0;i<60;i++)nav.move(position,new THREE.Vector3(0,0,-.02),velocity,1/60)
  assert.ok(position.z<cabin.spawn.z-.2,'character actually walks into the cabin')
  assert.ok(Math.abs(position.y-cabin.spawn.y)<.02,'feet remain on the known cabin floor')
  assert.equal(nav.snapshot().movementCalls,60)
 }finally{nav.dispose();support.geometry.dispose();support.material.dispose();cabin.dispose()}
})

test('existing E travel completes three enter/leave cycles and returns the same actor, camera and navigation to the garden',async()=>{
 const cabin=await make(),gardenScene=new THREE.Scene(),gardenCamera=new THREE.OrthographicCamera(),gardenNavigation={id:'garden'}
 const root=new THREE.Group();root.position.set(-4.77,.04,-2.68);gardenScene.add(root)
 let locked=false,currentNavigation:any=gardenNavigation,currentScene:any=gardenScene,currentCamera:any=gardenCamera
 const witch={root,isStable:()=>true,setExternalFocus:(s:any)=>locked=s.locked,setNavigation:(n:any)=>currentNavigation=n,placeAt:(p:THREE.Vector3,yaw:number)=>{root.position.copy(p);root.rotation.y=yaw}}
 ;(globalThis as any).document={createElement:()=>({className:'',hidden:true,style:{opacity:'0'},setAttribute(){}}),body:{append(){}}}
 const playable={...cabin,navigation:{id:'cabin'}},hint={hidden:true,textContent:''}
 const travel=createCabinTravel({witch,cabin:playable,gardenScene,gardenCamera,gardenNavigation,pipeline:{setWorld:(s:any,c:any)=>{currentScene=s;currentCamera=c}},canTravel:()=>true,hint})
 try{
  const start=root.position.clone()
  for(let cycle=0;cycle<3;cycle++){
   assert.ok(travel.start());assert.ok(locked)
   for(let f=0;f<70;f++)travel.update(1/60)
   assert.equal(travel.isGarden(),false);assert.equal(root.parent,cabin.scene);assert.equal(currentScene,cabin.scene);assert.equal(currentCamera,cabin.camera);assert.equal(currentNavigation,playable.navigation);assert.equal(locked,false)
   root.position.copy(cabin.exit);assert.ok(travel.start())
   for(let f=0;f<70;f++)travel.update(1/60)
   assert.equal(travel.isGarden(),true);assert.equal(root.parent,gardenScene);assert.equal(currentScene,gardenScene);assert.equal(currentCamera,gardenCamera);assert.equal(currentNavigation,gardenNavigation);assert.deepEqual(root.position.toArray(),start.toArray());assert.equal(locked,false)
  }
  assert.equal(travel.snapshot().visits,3)
 }finally{cabin.dispose();delete(globalThis as any).document}
})

test('production entry is the game, and the interior bundle has no editor shell, second renderer or input loop',async()=>{
 const index=await readFile(new URL('../../../dist/index.html',import.meta.url),'utf8'),bundle=await readFile(new URL('../../../dist/cabin-interior.js',import.meta.url),'utf8')
 assert.match(index,/import\('\.\/main\.js'\)/);assert.ok(!index.includes('id="root"'))
 for(const pattern of [/TransformControls/,/EditorPanel/,/from ["']react/,/WebGLRenderer/,/requestAnimationFrame\(/,/addEventListener\(/,/localStorage/])assert.ok(!pattern.test(bundle),String(pattern))
 assert.match(bundle,/createCabinInterior/);assert.match(bundle,/createGardenNavigation/)
})
