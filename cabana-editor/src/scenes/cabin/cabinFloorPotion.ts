import { Matrix4, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'
import type { BufferGeometry } from 'three'
import type { CabinBatch } from './buildCabinLayout.ts'

/** Transfer the already-fitted liquid through the two instances of the SAME
 * imported cauldron. Its rim clearance is preserved under translation/scale. */
export function addFloorPotion(batches:CabinBatch[],bowl:CabinBatch,geometries:BufferGeometry[],ownedMaterials:Map<object,MeshStandardMaterial>) {
  const oldIndex=bowl.ownerIds.indexOf('cauldron'),floorIndex=bowl.ownerIds.indexOf('floor-cauldron')
  if(oldIndex<0||floorIndex<0)throw Error('Caldeirão de chão ausente.')
  const transfer=bowl.matrices[floorIndex].clone().multiply(bowl.matrices[oldIndex].clone().invert())
  const material=new MeshStandardMaterial({name:'floorPotion',color:'#8154b6',emissive:'#6e399c',emissiveIntensity:.22,roughness:.82})
  const bubbleMaterial=new MeshStandardMaterial({name:'potionBubble',color:'#c49be5',emissive:'#784da6',emissiveIntensity:.26,roughness:.34,metalness:.04})
  ownedMaterials.set(material,material);ownedMaterials.set(bubbleMaterial,bubbleMaterial)
  let surface:Matrix4|undefined
  for(const batch of [...batches])if(batch.m.name==='potion'){
    const matrices=batch.matrices.flatMap((m,i)=>batch.ownerIds[i]==='cauldron'?[m.clone().premultiply(transfer)]:[])
    if(!matrices.length)continue
    batches.push({...batch,key:batch.key+'-floor',m:material,matrices,ownerIds:matrices.map(()=> 'floor-cauldron')})
    if(batch.g.type==='CircleGeometry')surface=matrices[0]
  }
  if(!surface)throw Error('Superfície da poção ausente.')
  const g=new SphereGeometry(1,10,6);geometries.push(g)
  const matrix=surface,center=new Vector3().setFromMatrixPosition(matrix)
  const sx=Math.hypot(matrix.elements[0],matrix.elements[1],matrix.elements[2]),sz=Math.hypot(matrix.elements[4],matrix.elements[5],matrix.elements[6])
  const matrices=Array.from({length:12},(_,i)=>{
    const angle=i*2.399963,r=.309*Math.sqrt((i+.5)/12)*.68
    // Bubbles stay well inside the wall at every point of the animated cycle.
    const p=new Vector3(Math.cos(angle)*r,Math.sin(angle)*r,0).applyMatrix4(matrix)
    p.y=center.y-.003
    const radius=(.017+(i%4)*.004)*Math.min(sx,sz)
    return new Matrix4().makeTranslation(p.x,p.y,p.z).multiply(new Matrix4().makeScale(radius,radius,radius))
  })
  batches.push({key:'floor-potion-bubbles',category:'furniture',g,m:bubbleMaterial,shadow:false,matrices,ownerIds:matrices.map(()=> 'floor-cauldron')})
}
