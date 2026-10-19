import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Box3, Mesh, OrthographicCamera, Raycaster, ShaderLib, UniformsUtils, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { buildCabinLayout } from '../src/scenes/cabin/buildCabinLayout.ts'
import { replaceCabinAssets, prepareAssetMaterial, selectAssetReplacement } from '../src/scenes/cabin/cabinAssetReplacements.ts'
import { createCabinEditorStore } from '../src/editor/editorStore.ts'
import { CabinEditorRuntime } from '../src/editor/editorRuntime.ts'
import { defaultLayout, parseLayout, serializeLayout } from '../src/editor/layoutModel.ts'
import { createPaintedBatchGeometry } from '../src/scenes/cabin/cabinPaintedUv.ts'
import { fitIsometricCamera } from '../src/systems/camera.ts'
import { prepareCabinMaterials } from '../src/scenes/cabin/cabinMaterials.ts'
import { useLabStore } from '../src/stores/labStore.ts'

async function loadGeometryLibrary(){
  const bytes=await readFile(new URL('../public/assets/quaternius/cabin-props.glb',import.meta.url))
  const jsonSize=bytes.readUInt32LE(12),doc=JSON.parse(bytes.toString('utf8',20,20+jsonSize))
  const binStart=20+jsonSize+8,bin=bytes.subarray(binStart)
  doc.buffers[0].uri='data:application/octet-stream;base64,'+bin.toString('base64')
  for(const m of doc.materials??[]){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;delete m.extensions;if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture}}
  delete doc.textures;delete doc.images;delete doc.extensionsUsed;delete doc.extensionsRequired;delete doc.extensions
  if(!globalThis.ProgressEvent)(globalThis as any).ProgressEvent=class extends Event{constructor(type:string,init:object){super(type);Object.assign(this,init)}}
  return (await new GLTFLoader().parseAsync(JSON.stringify(doc),'')).scene
}

test('prepared library has 16 named models, embedded optimized textures and a valid CC0 source',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/assets/quaternius/manifest.json',import.meta.url),'utf8'))
  assert.equal(manifest.models.length,16);assert.equal(manifest.license,'CC0-1.0')
  assert.equal(manifest.textures.length,4)
  assert.ok(manifest.bytes<2_500_000)
  for(const texture of manifest.textures){assert.equal(texture.width,1024);assert.equal(texture.height,1024);assert.equal(texture.mime,'image/webp')}
  const scene=await loadGeometryLibrary()
  for(const {name}of manifest.models)assert.ok(scene.getObjectByName('Asset_'+name),name)
})

test('replacements preserve all IDs, hierarchy, architecture, JSON and editorial exceptions',async()=>{
  const scene=await loadGeometryLibrary(),base=buildCabinLayout(),original=buildCabinLayout()
  try{
    const model=replaceCabinAssets(base,scene)
    assert.deepEqual(model.objects,original.objects)
    assert.deepEqual(defaultLayout(model.objects),defaultLayout(original.objects))
    const arch=(m:typeof base)=>m.batches.filter(b=>b.category==='architecture').map(b=>({material:b.m.name,position:Array.from(b.g.attributes.position.array),matrices:b.matrices.map(x=>x.elements)}))
    assert.deepEqual(arch(model),arch(original))
    for(const id of ['bed','study-desk','study-chair','storage','chest','cauldron','alchemy-shelf-low'])assert.ok(model.replacements.some(r=>r.id===id),id)
    for(const id of ['bookshelf','reading-chair','window','banner-left'])assert.ok(!model.replacements.some(r=>r.id===id),id)
    assert.equal(model.replacements.filter(r=>r.model==='Chandelier').length,3)
    assert.equal(model.replacements.filter(r=>r.model==='CandleStick_Stand').length,2)
    assert.ok(model.replacements.some(r=>r.id==='floor-cauldron'))
    assert.ok(model.replacements.length>70)
    assert.ok(model.replacements.some(r=>r.model==='Candle_1'))
    const initial=defaultLayout(model.objects)
    assert.deepEqual(parseLayout(serializeLayout(initial,original.objects),model.objects),initial)
    // Complete floor candelabra and real modeled textile/fringes stay instanced.
    assert.ok(model.metrics.triangles<100000)
  }finally{base.dispose();original.dispose()}
})

test('preserved potion meets the imported cauldron inner wall without a visible gap',async()=>{
  const base=buildCabinLayout(),scene=await loadGeometryLibrary(),model=replaceCabinAssets(base,scene)
  try{
    const body=model.batches.find(b=>b.key.startsWith('asset-Cauldron'))!,mesh=new Mesh(body.g,body.m)
    mesh.matrixAutoUpdate=false;mesh.matrix.copy(body.matrices[0]);mesh.updateMatrixWorld(true)
    const liquid=model.batches.find(b=>b.m.name==='potion'&&b.g.type==='CircleGeometry')!,matrix=liquid.matrices[0],center=new Vector3().setFromMatrixPosition(matrix)
    const radiusX=.309*Math.hypot(matrix.elements[0],matrix.elements[1],matrix.elements[2]),radiusZ=.309*Math.hypot(matrix.elements[4],matrix.elements[5],matrix.elements[6])
    for(const [direction,radius]of[[new Vector3(1,0,0),radiusX],[new Vector3(-1,0,0),radiusX],[new Vector3(0,0,1),radiusZ],[new Vector3(0,0,-1),radiusZ]] as const){
      const hits=new Raycaster(center,direction,0,2).intersectObject(mesh)
      assert.ok(hits.length>0);assert.ok(hits[0].distance-radius<.012&&hits[0].distance-radius>-.003,`wall gap ${hits[0].distance-radius}`)
    }
  }finally{model.dispose()}
})

test('replacement geometry fits the retained desktop and mobile camera',async()=>{
  const base=buildCabinLayout(),scene=await loadGeometryLibrary()
  const model=replaceCabinAssets(base,scene),camera=new OrthographicCamera(),point=new Vector3()
  try{
    for(const [width,height]of[[1440,900],[390,524],[844,390]]){
      fitIsometricCamera(camera,width,height)
      for(const batch of model.batches){
        batch.g.computeBoundingBox()
        for(const matrix of batch.matrices){
          const b=batch.g.boundingBox!.clone().applyMatrix4(matrix)
          for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z]){
            point.set(x,y,z).project(camera)
            assert.ok(Math.abs(point.x)<=1&&Math.abs(point.y)<=1&&Math.abs(point.z)<=1,`${batch.key} crops at ${width}x${height}`)
          }
        }
      }
    }
  }finally{model.dispose()}
})

test('asset UVs stay authored; potion is retained and fixture flames match the new candle count',async()=>{
  const base=buildCabinLayout(),original=buildCabinLayout(),scene=await loadGeometryLibrary()
  try{
    const model=replaceCabinAssets(base,scene)
    for(const batch of model.batches.filter(b=>b.uvMode==='authored')){
      const g=createPaintedBatchGeometry(batch)
      try{assert.deepEqual(g.attributes.uv.array,batch.g.attributes.uv.array);assert.ok(!g.getAttribute('cabinPaintCrop'))}finally{g.dispose()}
    }
    for(const name of ['flame','potion']){
      const count=(m:typeof base)=>m.batches.filter(b=>b.m.name===name).reduce((n,b)=>n+b.matrices.length,0)
      // Three eight-candle chandeliers and two eight-candle stands replace five
      // single-candle lamps. No old fixture flame may survive underneath them.
      assert.equal(count(model),count(original)+(name==='flame'?35:0))
    }
    assert.equal(selectAssetReplacement('reading-chair','wood'),null)
  }finally{base.dispose();original.dispose()}
})

test('new geometry supports parent transforms, selection bounds, duplicates and undo/redo',async()=>{
  const base=buildCabinLayout(),scene=await loadGeometryLibrary(),store=createCabinEditorStore()
  try{
    const model=replaceCabinAssets(base,scene),s=()=>store.getState();s().initialize(model.objects)
    const runtime=new CabinEditorRuntime(model,store)
    s().updateObject('study-desk',{position:[1,.5,-2.8],rotationY:.4,scale:1.3})
    const before=runtime.selectionBounds('study-desk',new Box3()).getSize(new Vector3())
    const copied=s().duplicateObject('study-desk')!
    const size=runtime.selectionBounds(copied,new Box3()).getSize(new Vector3())
    assert.ok(size.distanceTo(before)<1e-8)
    const doc=serializeLayout(s().layout,model.objects);assert.deepEqual(parseLayout(doc,model.objects),s().layout)
    s().undo();assert.ok(!s().layout[copied]);s().redo();assert.ok(s().layout[copied])
    for(const b of model.batches)for(const matrix of b.matrices)assert.ok(matrix.elements.every(Number.isFinite)&&Math.abs(matrix.determinant())>1e-10)
  }finally{base.dispose()}
})

test('adapted material keeps the source painting and uses matte shading and a plum cloth region',()=>{
  const source=new Mesh().material as any
  const material=prepareAssetMaterial(source,'MI_Trim_Cloth')
  try{
    assert.ok(material.roughness>=.9);assert.ok(material.metalness<=.18)
    const shader={uniforms:UniformsUtils.clone(ShaderLib.standard.uniforms),vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader}
    material.onBeforeCompile(shader as any,{} as any)
    assert.ok(shader.fragmentShader.includes('wwPlum'))
  }finally{material.dispose()}
})

test('fixture geometry, candles and local lights follow height, size, copies, deletion and undo',async()=>{
  const model=replaceCabinAssets(buildCabinLayout(),await loadGeometryLibrary()),store=createCabinEditorStore(),s=()=>store.getState()
  try{
    s().initialize(model.objects);const runtime=new CabinEditorRuntime(model,store)
    for(const [id,count]of[['lamp-library',8],['lamp-study',8],['lamp-hearth',8],['lamp-entry-left',8],['lamp-entry-right',8]] as const){
      const child=id+'/candle-001',flames=model.batches.filter(b=>b.m.name==='flame').flatMap(b=>b.ownerIds.flatMap((owner,i)=>owner===child?[b.matrices[i]]:[]))
      assert.equal(flames.length,count)
      const body=model.batches.filter(b=>b.ownerIds.includes(id))
      assert.ok(body.length>0&&body.every(b=>b.key.startsWith('asset-')),'old lamp cage and saucer are gone')
      assert.ok(model.batches.filter(b=>b.ownerIds.includes(child)&&b.m.name!=='flame').every(b=>b.key.startsWith('asset-')))
      const source=model.candleLights.find(c=>c.id===child)!
      assert.ok(source&&source.power>0&&source.distance>0)
      const centroid=flames.reduce((v,m)=>v.add(new Vector3().setFromMatrixPosition(m)),new Vector3()).divideScalar(count)
      assert.ok(centroid.distanceTo(new Vector3(...source.position))<1e-8)
      s().updateObject(id,{position:[2,3,1],scale:1.4,rotationY:.8})
      const expected=new Vector3(...source.position).applyMatrix4(runtime.get(child).delta)
      assert.ok(expected.y>2)
      const copy=s().duplicateObject(id)!,copyChild=runtime.definitions.find(o=>o.sourceId===child&&o.parentId===copy)!.id
      const copiedLight=new Vector3(...source.position).applyMatrix4(runtime.get(copyChild).delta)
      assert.ok(Math.abs(copiedLight.y-expected.y)<1e-8&&copiedLight.distanceTo(expected)>.1)
      s().updateObject(copy,{deleted:true});assert.equal(runtime.get(copyChild).visible,false)
      s().undo();assert.equal(runtime.get(copyChild).visible,true)
      s().updateObject(child,{visible:false});assert.equal(runtime.get(child).visible,false)
    }
    assert.deepEqual(parseLayout(serializeLayout(s().layout,model.objects),model.objects),s().layout)
    const looseCandles=model.objects.filter(o=>/\/candle-\d+$/.test(o.id)&&!o.id.startsWith('lamp-'))
    for(const candle of looseCandles)assert.ok(model.candleLights.some(c=>c.id===candle.id),candle.id)
    const bowl=model.batches.find(b=>b.key.startsWith('asset-Cauldron')&&b.ownerIds.includes('floor-cauldron'))!
    const index=bowl.ownerIds.indexOf('floor-cauldron'),matrix=bowl.matrices[index],size=new Vector3().setFromMatrixScale(matrix)
    assert.ok(Math.abs(size.x-size.y)<1e-8&&Math.abs(size.y-size.z)<1e-8,'floor cauldron keeps the pack proportions')
    bowl.g.computeBoundingBox();assert.ok(Math.abs(bowl.g.boundingBox!.clone().applyMatrix4(matrix).min.y-.035)<1e-5)
    s().updateObject('floor-cauldron',{position:[3.8,0,-.1]});assert.ok(!runtime.selectionBounds('floor-cauldron',new Box3()).isEmpty())
  }finally{model.dispose()}
})

test('older v3 compositions retain every transform, deletion and duplicate when floor cauldron is added',()=>{
  const model=buildCabinLayout(),store=createCabinEditorStore(),s=()=>store.getState()
  try{
    s().initialize(model.objects)
    s().updateObject('central-rug',{position:[-.8,.01,1.1],scale:.85,rotationY:1.2})
    s().updateObject('lamp-study',{position:[.4,2.9,-1.2],scale:1.2,rotationY:.6})
    s().updateObject('storage',{deleted:true});s().duplicateObject('study-desk')
    const doc=JSON.parse(serializeLayout(s().layout,model.objects));doc.objects=doc.objects.filter((o:any)=>o.id!=='floor-cauldron')
    const imported=parseLayout(JSON.stringify(doc),model.objects)
    for(const [id,value]of Object.entries(s().layout))assert.deepEqual(imported[id],value,id)
    const noBed=structuredClone(doc);noBed.objects=noBed.objects.filter((o:any)=>o.id!=='bed')
    assert.throws(()=>parseLayout(JSON.stringify(noBed),model.objects))
  }finally{model.dispose()}
})

test('round rug has continuous painted cloth and modeled fringe',()=>{
  const model=buildCabinLayout()
  try{
    const round=model.batches.find(b=>b.m.name==='roundRug')!
    assert.deepEqual(round.ownerIds,['central-rug'])
    assert.ok(!model.batches.some(b=>b.m.name==='rug'&&b.ownerIds.includes('central-rug')))
    assert.ok(model.batches.some(b=>b.m.name==='rug'&&b.ownerIds.includes('bed-rug')))
    const mesh=new Mesh(round.g,round.m);mesh.matrixAutoUpdate=false;mesh.matrix.copy(round.matrices[0]);mesh.updateMatrixWorld(true)
    for(let i=0;i<128;i++)for(const radius of[0,.8,1.59]){
      const a=(i+.371)*Math.PI*2/128,ray=new Raycaster(new Vector3(Math.sin(a)*radius,.3,.36+Math.cos(a)*radius),new Vector3(0,-1,0),0,.4)
      const hit=ray.intersectObject(mesh)[0];assert.ok(hit&&hit.point.y>.0315&&hit.point.y<.040,'thin cloth stays above the floor and follows gentle textile folds')
    }
    const moons=model.batches.filter(b=>b.m.name==='bannerMoon').flatMap(b=>b.ownerIds.flatMap((id,i)=>id==='central-rug'?[{b,m:b.matrices[i]}]:[]))
    assert.equal(moons.length,0)
    for(const material of ['rugEdge','rugFringe','rugFringeLight'])assert.ok(model.batches.some(b=>b.m.name===material&&b.ownerIds.includes('central-rug')))
    const fringes=model.batches.filter(b=>b.m.name==='rugFringe'||b.m.name==='rugFringeLight')
    assert.equal(fringes.reduce((n,b)=>n+b.matrices.length,0),64)
    assert.ok(fringes.every(b=>!b.shadow&&b.ownerIds.every(id=>id==='central-rug')))
    assert.ok(!model.batches.some(b=>b.m.name==='rugThread'),'painted symbols share the cloth surface')
  }finally{model.dispose()}
})

test('entry has only complete movable pack candelabra on the floor, without fixed stone or wood pedestals',async()=>{
  const model=replaceCabinAssets(buildCabinLayout(),await loadGeometryLibrary()),store=createCabinEditorStore()
  try{
    store.getState().initialize(model.objects);const runtime=new CabinEditorRuntime(model,store)
    for(const b of model.batches.filter(b=>b.category==='architecture'))for(const m of b.matrices){
      const p=new Vector3().setFromMatrixPosition(m)
      assert.ok(!(Math.abs(Math.abs(p.x)-1.02)<1e-7&&Math.abs(p.z-3.98)<1e-7&&[.27,.78].some(y=>Math.abs(p.y-y)<1e-7)),'old fixed entrance pedestal must be removed')
    }
    for(const id of ['lamp-entry-left','lamp-entry-right']){
      const parts=model.batches.filter(b=>b.key.startsWith('asset-CandleStick_Stand')&&b.ownerIds.includes(id))
      assert.ok(parts.length>0)
      const bounds=new Box3()
      for(const b of parts){b.g.computeBoundingBox();bounds.union(b.g.boundingBox!.clone().applyMatrix4(b.matrices[b.ownerIds.indexOf(id)]))}
      assert.ok(Math.abs(bounds.min.y-.035)<1e-5,'the imported metal base sits on the floor')
      const before=runtime.selectionBounds(id,new Box3()).getCenter(new Vector3())
      const initial=store.getState().layout[id].position
      store.getState().updateObject(id,{position:[initial[0]+.5,initial[1]+.2,initial[2]-.3]})
      const after=runtime.selectionBounds(id,new Box3()).getCenter(new Vector3())
      assert.ok(after.sub(before).distanceTo(new Vector3(.5,.2,-.3))<1e-8,'the whole pack stand moves as one editable assembly')
    }
  }finally{model.dispose()}
})

test('floor potion and twelve animated bubbles fit the imported bowl and follow the editor as one object',async()=>{
  const model=replaceCabinAssets(buildCabinLayout(),await loadGeometryLibrary()),store=createCabinEditorStore(),clock=prepareCabinMaterials(model.materials)
  try{
    store.getState().initialize(model.objects);const runtime=new CabinEditorRuntime(model,store)
    const liquid=model.batches.find(b=>b.m.name==='floorPotion'&&b.g.type==='CircleGeometry')!,bubbles=model.batches.find(b=>b.key==='floor-potion-bubbles')!
    assert.deepEqual(liquid.ownerIds,['floor-cauldron']);assert.equal(bubbles.matrices.length,12)
    assert.ok(bubbles.ownerIds.every(id=>id==='floor-cauldron'))
    const body=model.batches.find(b=>b.key.startsWith('asset-Cauldron')&&b.ownerIds.includes('floor-cauldron'))!,mesh=new Mesh(body.g,body.m)
    mesh.matrixAutoUpdate=false;mesh.matrix.copy(body.matrices[body.ownerIds.indexOf('floor-cauldron')]);mesh.updateMatrixWorld(true)
    const matrix=liquid.matrices[0],center=new Vector3().setFromMatrixPosition(matrix)
    const rx=.309*Math.hypot(matrix.elements[0],matrix.elements[1],matrix.elements[2]),rz=.309*Math.hypot(matrix.elements[4],matrix.elements[5],matrix.elements[6])
    for(const [direction,radius]of[[new Vector3(1,0,0),rx],[new Vector3(-1,0,0),rx],[new Vector3(0,0,1),rz],[new Vector3(0,0,-1),rz]] as const){
      const hit=new Raycaster(center,direction,0,2).intersectObject(mesh)[0];assert.ok(hit&&hit.distance-radius<.015&&hit.distance-radius>-.003)
    }
    for(const m of bubbles.matrices){
      const p=new Vector3().setFromMatrixPosition(m),r=new Vector3().setFromMatrixScale(m).x
      assert.ok(((p.x-center.x)/rx)**2+((p.z-center.z)/rz)**2<.5)
      assert.ok(r<Math.min(rx,rz)*.15)
    }
    for(const name of ['floorPotion','potionBubble']){
      const shader={uniforms:UniformsUtils.clone(ShaderLib.standard.uniforms),vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader}
      model.materials[name].onBeforeCompile(shader as any,{} as any)
      assert.equal(shader.uniforms.uCabinTime,clock.boil)
      if(name==='potionBubble')assert.ok(shader.vertexShader.includes('boilPhase')&&shader.vertexShader.includes('USE_INSTANCING'))
    }
    const saved={animate:useLabStore.getState().animate,boil:useLabStore.getState().boil};useLabStore.setState({animate:false,boil:true})
    assert.equal(useLabStore.getState().boil,true)
    useLabStore.getState().toggleAnimation();useLabStore.getState().toggleAnimation()
    assert.equal(useLabStore.getState().boil,false);useLabStore.setState({animate:saved.animate,boil:saved.boil})
    store.getState().updateObject('floor-cauldron',{position:[2,.5,1],scale:1.7,rotationY:.8})
    const copy=store.getState().duplicateObject('floor-cauldron')!
    assert.ok(runtime.selectionBounds(copy,new Box3()).getSize(new Vector3()).distanceTo(runtime.selectionBounds('floor-cauldron',new Box3()).getSize(new Vector3()))<1e-8)
    store.getState().updateObject(copy,{deleted:true});assert.equal(runtime.get(copy).visible,false)
  }finally{clock.dispose();model.dispose()}
})
