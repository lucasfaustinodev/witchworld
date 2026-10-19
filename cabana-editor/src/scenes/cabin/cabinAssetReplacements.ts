import { Box3, Matrix4, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three'
import type { Object3D, SkinnedMesh, Material, BufferGeometry } from 'three'
import type { CabinBatch } from './buildCabinLayout.ts'
import { buildCabinLayout } from './buildCabinLayout.ts'
import { candleLightSources, fixtureFlames, fixtureModel, fixtureTransform } from './cabinFixtures.ts'
import { addFloorPotion } from './cabinFloorPotion.ts'

export const CABIN_PROP_LIBRARY='assets/quaternius/cabin-props.glb'
const furniture:Record<string,string>={bed:'Bed_Twin1','study-desk':'Workbench','study-chair':'Chair_1',storage:'Cabinet',chest:'Chest_Wood','alchemy-shelf-low':'Shelf_Simple','alchemy-shelf-high':'Shelf_Simple'}
export function selectAssetReplacement(id:string,material:string):string|null {
  if(fixtureModel(id))return fixtureModel(id)
  if(id.startsWith('lamp-'))return null
  if(furniture[id])return id==='study-desk'&&material==='leather'?null:furniture[id]
  if(id==='cauldron'||id==='floor-cauldron')return material==='metal'?'Cauldron':null
  if(/\/book-\d+$/.test(id))return 'Book_5'
  if(/\/book-stack-\d+$/.test(id))return 'Book_Stack_1'
  const bottle=id.match(/\/bottle-(\d+)$/)
  if(bottle)return ['Potion_1','Potion_2','Potion_4'][Number(bottle[1])%3]
  if(/\/candle-\d+$/.test(id)&&material==='wax')return 'Candle_2'
  return null
}

export function prepareAssetMaterial(source:Material,name:string):MeshStandardMaterial {
  const m=source instanceof MeshStandardMaterial?source.clone():new MeshStandardMaterial()
  const cloth=name.includes('Cloth'),wood=name.includes('Furniture'),metal=name.includes('Metal')
  m.name='asset/'+name;m.roughness=metal?.9:.98;m.metalness=metal?.16:0
  m.normalMap=m.roughnessMap=m.metalnessMap=m.aoMap=null
  m.envMapIntensity=.14
  m.userData={...m.userData,assetSource:'Quaternius Fantasy Props MegaKit Standard',finish:'witchworld-hand-painted-matte'}
  m.onBeforeCompile=shader=>{
    // Retain the authored trim UVs and painting. Palette adjustments are local to
    // these imported materials; the two approved cabin atlases remain unchanged.
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      #ifdef USE_MAP
        ${cloth?`if(vMapUv.x>.245 && vMapUv.x<.605 && vMapUv.y<.245){
          float wwBrush=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*2.0+.55,.55,1.2);
          vec3 wwPlum=vec3(.15,.055,.125);
          diffuseColor.rgb=wwPlum*wwBrush;
        }else{diffuseColor.rgb*=vec3(.94,.84,.88);}`:wood?`diffuseColor.rgb*=vec3(.83,.76,.78);`:metal?`diffuseColor.rgb*=vec3(.88,.83,.91);`:`float wwValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(vec3(wwValue),diffuseColor.rgb,.83);`}
      #endif`)
  }
  m.customProgramCacheKey=()=>`witchworld-quaternius-matte-v1-${cloth?'cloth':wood?'wood':metal?'metal':'props'}`
  return m
}

type CabinModel=ReturnType<typeof buildCabinLayout>
interface Replacement {id:string;model:string;bounds:Box3;pieces:{batch:CabinBatch;index:number}[]}

/** Swap visual buffers only: definitions and local transforms stay byte-for-byte
 * compatible with exported v1/v2/v3 layouts. Imported pieces use the existing
 * instanced renderer, editor owners, duplicates and selection bounds. */
export function replaceCabinAssets(base:CabinModel,library:Object3D) {
  library.updateMatrixWorld(true)
  const replacements=new Map<string,Replacement>()
  for(const batch of base.batches)if(batch.category==='furniture')batch.ownerIds.forEach((id,index)=>{
    if(!id)return
    // The old candle child keeps its ID and transform, but its saucer, wax and
    // flame are replaced together with the fixture to avoid overlapping lamps.
    const fixtureId=id.split('/')[0],fixture=fixtureModel(fixtureId)
    const model=fixture??selectAssetReplacement(id,batch.m.name)
    if(!model)return
    const targetId=fixture?fixtureId:id
    if(!replacements.has(targetId))replacements.set(targetId,{id:targetId,model,bounds:new Box3(),pieces:[]})
    const r=replacements.get(targetId)!
    batch.g.computeBoundingBox();r.bounds.union(batch.g.boundingBox!.clone().applyMatrix4(batch.matrices[index]));r.pieces.push({batch,index})
  })
  const removed=new Map<CabinBatch,Set<number>>()
  for(const r of replacements.values())for(const p of r.pieces){if(!removed.has(p.batch))removed.set(p.batch,new Set());removed.get(p.batch)!.add(p.index)}
  const batches:CabinBatch[]=base.batches.flatMap(batch=>{
    const omit=removed.get(batch);if(!omit)return [batch]
    const indices=batch.matrices.map((_,i)=>i).filter(i=>!omit.has(i))
    return indices.length?[{...batch,matrices:indices.map(i=>batch.matrices[i]),ownerIds:indices.map(i=>batch.ownerIds[i]),paintIndices:indices}]:[]
  })
  const geometries:BufferGeometry[]=[],materials=new Map<Material,MeshStandardMaterial>(),prepared=new Map<string,{g:BufferGeometry;m:MeshStandardMaterial;bounds:Box3}[]>()
  const source=(name:string)=>{
    if(prepared.has(name))return prepared.get(name)!
    const root=library.getObjectByName('Asset_'+name)
    if(!root)throw Error(`Asset ausente na biblioteca: ${name}`)
    const parts:{g:BufferGeometry;m:MeshStandardMaterial;bounds:Box3}[]=[]
    root.traverse(object=>{
      if(!(object instanceof Mesh))return
      const g=object.geometry.clone(),p=g.attributes.position,point=new Vector3()
      if((object as SkinnedMesh).isSkinnedMesh){
        const skinned=object as SkinnedMesh;skinned.skeleton.update()
        for(let i=0;i<p.count;i++){point.fromBufferAttribute(p,i);skinned.applyBoneTransform(i,point);p.setXYZ(i,point.x,point.y,point.z)}
      }
      g.applyMatrix4(object.matrixWorld)
      const sourceMaterial=Array.isArray(object.material)?object.material[0]:object.material
      if(name==='Book_5')g.applyMatrix4(new Matrix4().makeRotationZ(Math.PI/2))
      if(name==='Chair_1')g.applyMatrix4(new Matrix4().makeRotationY(Math.PI))
      const positions=g.attributes.position
      if(name==='Bed_Twin1'&&!sourceMaterial.name.includes('Cloth'))for(let i=0;i<positions.count;i++)if(positions.getZ(i)>.95&&positions.getY(i)>.3)positions.setY(i,.3+(positions.getY(i)-.3)*.35)
      // Topology is retained; recalculate normal direction only for the edited profiles.
      if(name==='Bed_Twin1')g.computeVertexNormals()
      g.computeBoundingBox();geometries.push(g)
      if(!materials.has(sourceMaterial))materials.set(sourceMaterial,prepareAssetMaterial(sourceMaterial,sourceMaterial.name))
      parts.push({g,m:materials.get(sourceMaterial)!,bounds:g.boundingBox!.clone()})
    })
    prepared.set(name,parts);return parts
  }
  const assetBatches=new Map<BufferGeometry,CabinBatch>()
  for(const r of replacements.values()){
    if(r.model==='Candle_2'&&r.bounds.getSize(new Vector3()).y<.19)r.model='Candle_1'
    const parts=source(r.model),bounds=new Box3();for(const p of parts)bounds.union(p.bounds)
    const target=r.bounds.clone()
    if(r.id==='bed'){target.min.y=.035;target.max.y=1.04}
    if(r.model==='Shelf_Simple')target.min.y=target.max.y-.27
    const size=bounds.getSize(new Vector3()),desired=target.getSize(new Vector3()),scale=desired.divide(size)
    if(r.id==='floor-cauldron')scale.setScalar(.9/Math.max(size.x,size.z))
    const isFixture=!!fixtureModel(r.id),pivot=base.objects.find(o=>o.id===r.id)!.position
    const matrix=isFixture?fixtureTransform(r.model,pivot):new Matrix4().makeTranslation(target.min.x,target.min.y,target.min.z).multiply(new Matrix4().makeScale(scale.x,scale.y,scale.z)).multiply(new Matrix4().makeTranslation(-bounds.min.x,-bounds.min.y,-bounds.min.z))
    for(const part of parts){
      if(!assetBatches.has(part.g))assetBatches.set(part.g,{key:'asset-'+r.model+'-'+part.g.uuid,category:'furniture',g:part.g,m:part.m,shadow:true,matrices:[],ownerIds:[],uvMode:'authored'})
      const batch=assetBatches.get(part.g)!;batch.matrices.push(matrix.clone());batch.ownerIds.push(isFixture&&part.m.name.includes('Props')?`${r.id}/candle-001`:r.id)
    }
    if(isFixture){
      const original=base.batches.find(b=>b.m.name==='flame')!
      let flames=batches.find(b=>b.m.name==='flame')
      if(!flames){flames={...original,matrices:[],ownerIds:[]};batches.push(flames)}
      // Retained batches may still reference base arrays; detach before appending.
      if(flames===original){flames={...flames,matrices:[...flames.matrices],ownerIds:[...flames.ownerIds]};batches[batches.indexOf(original)]=flames}
      const fixtureScale=new Vector3().setFromMatrixScale(matrix).x
      for(const position of fixtureFlames(r.model,matrix)){
        flames.matrices.push(new Matrix4().makeTranslation(...position.toArray()).multiply(new Matrix4().makeScale(.022*fixtureScale,.055*fixtureScale,.022*fixtureScale)))
        flames.ownerIds.push(`${r.id}/candle-001`)
      }
    }
  }
  // Match the existing liquid and meniscus to the imported bowl's INNER section,
  // rather than assuming its external bounding box describes the opening.
  const bowl=[...assetBatches.values()].find(b=>b.ownerIds.includes('cauldron'))
  const liquid=batches.find(b=>b.m.name==='potion'&&b.g.type==='CircleGeometry')
  if(bowl&&liquid){
    const mesh=new Mesh(bowl.g,bowl.m),index=bowl.ownerIds.indexOf('cauldron')
    mesh.matrixAutoUpdate=false;mesh.matrix.copy(bowl.matrices[index]);mesh.updateMatrixWorld(true)
    const center=new Vector3().setFromMatrixPosition(liquid.matrices[0]),ray=new Raycaster()
    const distance=(x:number,z:number)=>{ray.set(center,new Vector3(x,0,z));return ray.intersectObject(mesh)[0]?.distance}
    const x=[distance(1,0),distance(-1,0)],z=[distance(0,1),distance(0,-1)]
    if([...x,...z].every(n=>n!==undefined&&Number.isFinite(n)&&n>.1)){
      const sx=Math.min(...x as number[])*.995/.309,sz=Math.min(...z as number[])*.995/.309
      const fit=new Matrix4().makeTranslation(center.x,center.y,center.z).multiply(new Matrix4().makeScale(sx,1,sz)).multiply(new Matrix4().makeTranslation(-center.x,-center.y,-center.z))
      for(const b of batches)if(b.m.name==='potion')b.matrices=b.matrices.map((m,i)=>b.ownerIds[i]==='cauldron'?m.clone().premultiply(fit):m)
    }else throw Error('Não foi possível ajustar a poção à abertura do caldeirão.')
  }
  if(bowl)addFloorPotion(batches,bowl,geometries,materials)
  batches.push(...assetBatches.values())
  const allMaterials={...base.materials,...Object.fromEntries([...materials.values()].map((m,i)=>[m.name==='floorPotion'||m.name==='potionBubble'?m.name:'asset-'+i,m]))}
  const metrics={...base.metrics,meshes:batches.length,instances:0,triangles:0,geometries:base.geometries.length+geometries.length,materials:Object.keys(allMaterials).length}
  for(const b of batches){metrics.instances+=b.matrices.length;metrics.triangles+=(b.g.index?.count??b.g.attributes.position.count)/3*b.matrices.length}
  let disposed=false
  return {...base,batches,materials:allMaterials,geometries:[...base.geometries,...geometries],metrics,candleLights:candleLightSources(batches),replacements:[...replacements.values()].map(r=>({id:r.id,model:r.model})),dispose(){if(disposed)return;disposed=true;base.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())}}
}
